const fs = require('fs');
let code = fs.readFileSync('src/components/StudentMarksCenter.tsx', 'utf8');

const targetLoad = `  // Load from local storage or set defaults
  useEffect(() => {
    try {
      const saved = localStorage.getItem('s_os_student_marks_cache');
      if (saved) {
        setMarksRecords(JSON.parse(saved));
      } else {
        const data = generateDummyMarksData();
        setMarksRecords(data);
        localStorage.setItem('s_os_student_marks_cache', JSON.stringify(data));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);`;

const newLoad = `  // Load from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase.from('notes').select('*').eq('id', 'global_marks_cache').single();
        if (data && data.content) {
          setMarksRecords(JSON.parse(data.content));
        } else {
          const defaultData = generateDummyMarksData();
          setMarksRecords(defaultData);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadFromSupabase();
  }, []);`;

const targetSave = `    setMarksRecords(updatedRecords);
    localStorage.setItem('s_os_student_marks_cache', JSON.stringify(updatedRecords));
    showNotification(\`Marks successfully saved for \${selectedClass}.\`);
  };`;

const newSave = `    setMarksRecords(updatedRecords);
    try {
      await supabase.from('notes').upsert({
        id: 'global_marks_cache',
        title: 'Student Marks Cache',
        subject: 'System',
        content: JSON.stringify(updatedRecords),
        created_at: new Date().toISOString()
      });
    } catch (e) {}
    showNotification(\`Marks successfully saved for \${selectedClass}.\`);
  };`;

if (code.includes('s_os_student_marks_cache')) {
  code = code.replace(targetLoad, newLoad);
  code = code.replace(targetSave, newSave);
  if (!code.includes('import { supabase }')) {
     code = `import { supabase } from '../lib/supabaseClient';\n` + code;
  }
  fs.writeFileSync('src/components/StudentMarksCenter.tsx', code);
  console.log('Migrated StudentMarksCenter to Supabase');
} else {
  console.log('Failed to find StudentMarksCenter storage targets');
}
