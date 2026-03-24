import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://iylcsmicjhjtwxyxlfyi.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bGNzbWljamhqdHd4eXhsZnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk1MTAsImV4cCI6MjA4ODgzNTUxMH0.YOb3tnb49r2YDv2tpGuQUn0rSm7hN9BYUlNvdLHpeoU";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
