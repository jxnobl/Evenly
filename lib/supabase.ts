import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ndxtjumhcjsdczwykcjl.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5keHRqdW1oY2pzZGN6d3lrY2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTE3NDEsImV4cCI6MjEwNDE2Nzc0MX0.ZJZGCaiEcDui3xHr0hcAthGdJEFQtFA39o4qlrtBiRE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);