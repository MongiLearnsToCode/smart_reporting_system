import { createClient } from '../../../../utils/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      jwt: session.access_token,
      user: { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.name ?? null },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
