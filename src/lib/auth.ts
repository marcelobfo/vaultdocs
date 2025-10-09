
import { supabase } from "@/integrations/supabase/client";

export async function getSession(): Promise<{ session: import("@supabase/supabase-js").Session | null }> {
  const { data } = await supabase.auth.getSession();
  return { session: data.session };
}

export async function getUser(): Promise<{ user: import("@supabase/supabase-js").User | null }> {
  const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null };
}

export async function signInWithPassword({ email, password }: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error } as const;
}

export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error } as const;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Novo: cadastro de usuário com redirecionamento após confirmação
export async function signUp({ email, password }: { email: string; password: string }) {
  const redirectUrl = `${window.location.origin}/`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl },
  });
  return { data, error } as const;
}
