const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zwpoutanhsujezglbson.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('user_profiles').insert([{ id: '8d423985-236b-4e00-ba5f-b52f672322a3', email: 'test@example.com' }]).select();
  console.log(data, error);
}
run();
