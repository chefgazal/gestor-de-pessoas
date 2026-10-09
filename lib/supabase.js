import { createClient } from '@supabase/supabase-js';

let client = null;

/** Cria o cliente uma única vez, só no navegador (as variáveis NEXT_PUBLIC_ entram no build). */
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  client = createClient(url, key);
  return client;
}
