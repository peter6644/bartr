import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

/* The app shows a setup screen when these are missing, so `sb` is only used once configured. */
export const sb: SupabaseClient = configured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : (null as unknown as SupabaseClient);

export const mediaUrl = (path?: string | null) =>
  path ? sb.storage.from('media').getPublicUrl(path).data.publicUrl : '';
