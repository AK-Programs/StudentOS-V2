const fs = require('fs');
let code = fs.readFileSync('src/components/SportsActivitiesPortal.tsx', 'utf8');

const targetLoad = `  useEffect(() => {
    // Load from local storage
    if (currentUser?.uid) {
      const uid = currentUser.uid;
      const p = localStorage.getItem(\`s_os_sports_part_\${uid}\`);
      const e = localStorage.getItem(\`s_os_sports_ev_\${uid}\`);
      const c = localStorage.getItem(\`s_os_sports_comp_\${uid}\`);
      const a = localStorage.getItem(\`s_os_sports_ach_\${uid}\`);

      if (p) {
        setParticipations(JSON.parse(p));
      } else {
        const defaults = [{
          id: 'sp-1', studentName: currentUser.name, activity: 'Basketball', role: 'Captain', practiceHours: 42,
          attendanceRate: 95, coachName: 'Coach Carter'
        }];
        setParticipations(defaults);
        localStorage.setItem(\`s_os_sports_part_\${uid}\`, JSON.stringify(defaults));
      }

      if (e) {
        setEvents(JSON.parse(e));
      } else {
        const defaults = [{
          id: 'ev-1', name: 'Inter-House Basketball Final', date: '2026-08-15',
          location: 'Main Court', isMandatory: true, status: 'upcoming'
        }];
        setEvents(defaults);
        localStorage.setItem(\`s_os_sports_ev_\${uid}\`, JSON.stringify(defaults));
      }

      if (c) {
        setCompetitions(JSON.parse(c));
      } else {
        const defaults = [{
          id: 'cp-1', title: 'Regional Athletics Meet', level: 'State',
          date: '2026-07-20', performance: '1st Place in 100m Dash', pointsAwarded: 50
        }];
        setCompetitions(defaults);
        localStorage.setItem(\`s_os_sports_comp_\${uid}\`, JSON.stringify(defaults));
      }

      if (a) {
        setAchievements(JSON.parse(a));
      } else {
        const defaults = [{
          id: 'ac-1', title: 'MVP of the Year', description: 'Awarded for outstanding performance in Varsity Basketball',
          date: '2026-05-10', badgeIcon: '🏆'
        }];
        setAchievements(defaults);
        localStorage.setItem(\`s_os_sports_ach_\${uid}\`, JSON.stringify(defaults));
      }
    }
  }, [currentUser]);`;

const newLoad = `  useEffect(() => {
    if (currentUser?.uid) {
      const uid = currentUser.uid;
      
      const loadFromSupabase = async () => {
        try {
          const { data } = await supabase.from('notes').select('*').eq('id', \`sports_\${uid}\`).single();
          if (data && data.content) {
            const parsed = JSON.parse(data.content);
            setParticipations(parsed.participations || []);
            setEvents(parsed.events || []);
            setCompetitions(parsed.competitions || []);
            setAchievements(parsed.achievements || []);
          } else {
            const dp = [{ id: 'sp-1', studentName: currentUser.name, activity: 'Basketball', role: 'Captain', practiceHours: 42, attendanceRate: 95, coachName: 'Coach Carter' }];
            const de = [{ id: 'ev-1', name: 'Inter-House Basketball Final', date: '2026-08-15', location: 'Main Court', isMandatory: true, status: 'upcoming' }];
            const dc = [{ id: 'cp-1', title: 'Regional Athletics Meet', level: 'State', date: '2026-07-20', performance: '1st Place in 100m Dash', pointsAwarded: 50 }];
            const da = [{ id: 'ac-1', title: 'MVP of the Year', description: 'Awarded for outstanding performance in Varsity Basketball', date: '2026-05-10', badgeIcon: '🏆' }];
            setParticipations(dp);
            setEvents(de);
            setCompetitions(dc);
            setAchievements(da);
          }
        } catch (e) {
          console.error("Failed to load sports data", e);
        }
      };
      loadFromSupabase();
    }
  }, [currentUser]);`;

const targetSave = `  // Save states helper
  const saveState = (key: string, data: any) => {
    const uid = currentUser?.uid || 'guest';
    localStorage.setItem(\`s_os_sports_\${key}_\${uid}\`, JSON.stringify(data));
  };`;

const newSave = `  // Save states helper
  const saveState = (key: string, data: any) => {
    // handled by effect
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    const saveToSupabase = async () => {
      try {
        await supabase.from('notes').upsert({
          id: \`sports_\${uid}\`,
          title: 'Sports Data',
          subject: 'System',
          content: JSON.stringify({ participations, events, competitions, achievements }),
          created_at: new Date().toISOString()
        });
      } catch (e) {}
    };
    if (participations.length > 0 || events.length > 0 || competitions.length > 0 || achievements.length > 0) {
      const timer = setTimeout(saveToSupabase, 1000);
      return () => clearTimeout(timer);
    }
  }, [participations, events, competitions, achievements, currentUser]);`;

if (code.includes(targetSave)) {
  code = code.replace(targetLoad, newLoad);
  code = code.replace(targetSave, newSave);
  if (!code.includes('import { supabase }')) {
     code = `import { supabase } from '../lib/supabaseClient';\n` + code;
  }
  fs.writeFileSync('src/components/SportsActivitiesPortal.tsx', code);
  console.log('Migrated Sports to Supabase');
} else {
  console.log('Failed to find Sports storage targets');
}
