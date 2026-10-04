const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zwpoutanhsujezglbson.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const targetId = 'e19d38aa-8ff4-4db3-bcc4-7b445585b001';
  const profile = {
    uid: targetId,
    email: 'test3@example.com',
    name: 'Test Three',
    role: 'teacher',
    department: 'Science',
    subjects: ['Physics', 'Chemistry'],
    specialtySubject: 'Physics'
  };

  const upsertData = {
    id: targetId,
    uid: targetId,
    email: profile.email?.toLowerCase() || '',
    name: profile.name || '',
    role: profile.role || 'student',
    department: profile.department || null,
    subjects: profile.subjects || [],
    specialty_subject: profile.specialtySubject || null,
    account_status: 'approved',
  };

  console.log("Upserting...");
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(upsertData, { onConflict: 'id' })
    .select()
    .single();

  console.log('Result:', data);
  console.log('Error:', error);
}
run();
