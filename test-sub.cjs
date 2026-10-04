const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // Sync Remote Lock State
  useEffect(() => {
    if (currentUser?.raw_data?.isLocked && !isLocked) {
      setIsLocked(true);
    }
  }, [currentUser, isLocked]);`;

const replacement = `  // Sync Remote Lock State
  useEffect(() => {
    if (currentUser?.raw_data?.isLocked && !isLocked) {
      setIsLocked(true);
    }
  }, [currentUser, isLocked]);

  // Realtime Subscription for Workspace Lock (cross-device sync)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const channel = supabase.channel('public:user_profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: \`id=eq.\${currentUser.uid}\` },
        (payload) => {
          if (payload.new && payload.new.raw_data) {
            let rd = payload.new.raw_data;
            if (typeof rd === 'string') {
              try { rd = JSON.parse(rd); } catch(e){}
            }
            if (rd.isLocked === true) {
               setIsLocked(true);
               setCurrentUser(prev => prev ? { ...prev, raw_data: rd } : prev);
            } else if (rd.isLocked === false) {
               setIsLocked(false);
               setCurrentUser(prev => prev ? { ...prev, raw_data: rd } : prev);
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.uid]);
`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Added realtime lock subscription');
} else {
  console.log('Target not found');
}
