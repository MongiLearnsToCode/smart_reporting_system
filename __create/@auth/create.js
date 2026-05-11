import { createClient } from '../../utils/supabase/server';

export default function CreateAuth() {
  const auth = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      user: { id: user.id, email: user.email, name: user.user_metadata?.name ?? null },
    };
  };
  return { auth };
}
