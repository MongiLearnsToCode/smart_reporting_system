import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, toErrorResponse } from '@/utils/api/guards';

const BUCKET = 'uploads';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Map([
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`upload:${getClientIp(request)}`, { limit: 15, windowMs: 60_000 });

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
