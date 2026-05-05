import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  // Apenas para uso no browser
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  if (!cached) {
    // Cliente seguro para rodar no browser (NUNCA use service role no client)
    cached = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // A autenticação do app já é via cookie/JWT próprio; para realtime só precisamos de um cliente anônimo.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return cached;
}

export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
