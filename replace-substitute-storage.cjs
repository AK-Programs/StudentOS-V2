const fs = require('fs');
let code = fs.readFileSync('src/components/SubstituteHub.tsx', 'utf8');

const targetLoad = `  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('s_os_substitute_assignments');
      if (saved) {
        setAssignments(JSON.parse(saved));
      } else {
        const initial: SubstituteAssignment[] = [
          {
            id: 'sub-1', classGrade: 'Grade 10 Solara', period: 'Period 3 (10:30 - 11:30)',
            subject: 'Physics', absentTeacherName: 'Dr. Sarah Jenkins', substituteTeacherName: 'Prof. Alex Mercer',
            workAssigned: 'Complete Worksheet on Newton\\'s Laws. Solve questions 1 to 15.',
            status: 'Assigned', date: new Date().toISOString().split('T')[0]
          },
          {
            id: 'sub-2', classGrade: 'Grade 9 Astra', period: 'Period 5 (12:30 - 13:30)',
            subject: 'Mathematics', absentTeacherName: 'Mrs. Clara Higgins', substituteTeacherName: currentUser?.name || 'Mr. Raj Patel',
            workAssigned: 'Revision of Quadratic Equations. Past paper 2023.',
            status: 'Assigned', date: new Date().toISOString().split('T')[0]
          }
        ];
        setAssignments(initial);
        localStorage.setItem('s_os_substitute_assignments', JSON.stringify(initial));
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);`;

const newLoad = `  // Load from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase.from('notes').select('*').eq('id', 'global_substitutes').single();
        if (data && data.content) {
          setAssignments(JSON.parse(data.content));
        } else {
          const initial: SubstituteAssignment[] = [
            {
              id: 'sub-1', classGrade: 'Grade 10 Solara', period: 'Period 3 (10:30 - 11:30)',
              subject: 'Physics', absentTeacherName: 'Dr. Sarah Jenkins', substituteTeacherName: 'Prof. Alex Mercer',
              workAssigned: 'Complete Worksheet on Newton\\'s Laws. Solve questions 1 to 15.',
              status: 'Assigned', date: new Date().toISOString().split('T')[0]
            },
            {
              id: 'sub-2', classGrade: 'Grade 9 Astra', period: 'Period 5 (12:30 - 13:30)',
              subject: 'Mathematics', absentTeacherName: 'Mrs. Clara Higgins', substituteTeacherName: currentUser?.name || 'Mr. Raj Patel',
              workAssigned: 'Revision of Quadratic Equations. Past paper 2023.',
              status: 'Assigned', date: new Date().toISOString().split('T')[0]
            }
          ];
          setAssignments(initial);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadFromSupabase();
  }, [currentUser]);`;

const targetSave = `  const saveAssignments = (list: SubstituteAssignment[]) => {
    setAssignments(list);
    localStorage.setItem('s_os_substitute_assignments', JSON.stringify(list));
  };`;

const newSave = `  const saveAssignments = async (list: SubstituteAssignment[]) => {
    setAssignments(list);
    try {
      await supabase.from('notes').upsert({
        id: 'global_substitutes',
        title: 'Substitute Hub Data',
        subject: 'System',
        content: JSON.stringify(list),
        created_at: new Date().toISOString()
      });
    } catch (e) {}
  };`;

if (code.includes(targetSave)) {
  code = code.replace(targetLoad, newLoad);
  code = code.replace(targetSave, newSave);
  if (!code.includes('import { supabase }')) {
     code = `import { supabase } from '../lib/supabaseClient';\n` + code;
  }
  fs.writeFileSync('src/components/SubstituteHub.tsx', code);
  console.log('Migrated SubstituteHub to Supabase');
} else {
  console.log('Failed to find SubstituteHub storage targets');
}
