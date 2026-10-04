const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zwpoutanhsujezglbson.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: users, error: uErr } = await supabase.from('users').select('*').limit(1);
  console.log('users:', users, uErr);
  const { data: profiles, error: pErr } = await supabase.from('user_profiles').select('*').limit(1);
  console.log('user_profiles:', profiles, pErr);
}
run();
