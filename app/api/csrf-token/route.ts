import { NextResponse } from 'next/server';

export async function GET() {
  const token = crypto.randomUUID();
  const response = NextResponse.json({ token });
  response.cookies.set('csrf-token', token, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return response;
}
