import { createClient } from '@supabase/supabase-js';

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://rumhswjoqgbtyxqovsvt.supabase.co';
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bWhzd2pvcWdidHl4cW92c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjQ0OTksImV4cCI6MjA5MTI0MDQ5OX0.OvHl3RRwajnbsF2E_szQXGvw2VR1PnF0FbqQ8LO96Pg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
