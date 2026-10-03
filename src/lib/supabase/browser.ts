import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Browser Supabase client for the admin area (PROJECT_SPEC §7).
 *
 * The admin is client-side only: it authenticates with the signed-in user's
 * session and every write is authorized by Postgres RLS (`public.is_admin()`),
 * never by hiding UI. Only the public anon key is used — the service_role key
 * must never appear in this bundle.
 *
 * Created lazily so server-side prerendering never touches browser storage.
 */
let client: SupabaseClient<Database> | null = null;

export function supabaseBrowser(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill in your Supabase project values.',
    );
  }

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** True when the signed-in user carries `app_metadata.role = 'admin'` (RLS reads the same claim from the JWT). */
export function isAdminClaim(user: { app_metadata: Record<string, unknown> }): boolean {
  return user.app_metadata.role === 'admin';
}
