import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://elbbobgygirxcwczackk.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kjI--dS1qxwYmFooDKRqLA_8N2rb3W9";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
