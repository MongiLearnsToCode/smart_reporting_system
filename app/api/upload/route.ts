import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';

const BUCKET = 'uploads';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Map([
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);

function validateMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  if (mimeType === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    for (let i = 0; i < Math.min(buffer.byteLength, 512); i++) {
      if (bytes[i] === 0x00) return false;
    }
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`upload:${getClientIp(request)}`, { limit: 15, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const header = await file.slice(0, 512).arrayBuffer();
    if (!validateMagicBytes(header, file.type)) {
      return NextResponse.json({ error: 'File content does not match declared type' }, { status: 415 });
    }

    const ext = ALLOWED_TYPES.get(file.type);
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
    if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 });

    const { data, error: signedUrlError } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signedUrlError || !data?.signedUrl) {
      return NextResponse.json({ error: 'Upload link creation failed' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl, path, mimeType: file.type });
  } catch (error) {
    return toErrorResponse(error);
  }
}
