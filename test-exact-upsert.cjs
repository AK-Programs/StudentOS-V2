const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zwpoutanhsujezglbson.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const targetId = '8d423985-236b-4e00-ba5f-b52f672322a4';
  const upsertData = {
    id: targetId,
    uid: targetId,
    email: 'exact@example.com',
    name: 'Exact Test',
    role: 'student',
    grade: 'Grade 10',
    section: 'Solara',
    house: 'Ruby',
    department: null,
    subjects: [],
    specialty_subject: null,
    designation: null,
    photo_url: null,
    requested_role: 'student',
    account_status: 'approved',
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(upsertData, { onConflict: 'id' })
    .select()
    .single();

  console.log('Result:', data, error);
}
run();
