import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ndxtjumhcjsdczwykcjl.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_los-dRBGa81tGR__LuF-4A_8mZvr8tO";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);