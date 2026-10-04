const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /if \(authData\.user\) \{\s*setLinkedGoogleUid\(authData\.user\.id\);\s*actualUid = authData\.user\.id;\s*\}/;

const replacement = `
      if (authData.user) {
         setLinkedGoogleUid(authData.user.id);
         actualUid = authData.user.id;
         
         if (!authData.session) {
            // Email verification is required
            // Save their profile, but don't log them in automatically
            console.log('Email verification required');
         }
      }
`;

content = content.replace(regex, replacement);

const currentRegex = /setCurrentUser\(newProfile\);\s*updateRecentAccounts\(newProfile\);\s*localStorage\.setItem\('s_os_user', JSON\.stringify\(newProfile\)\);\s*if \(regRole === 'student'\) \{\s*showNotification\(\`Welcome to StudentOS, \$\{newProfile\.name\}!\`\);\s*\} else \{\s*showNotification\(\`Request submitted for \$\{regRole\.toUpperCase\(\)\} approval\. Exploring as Student in the meantime!\`\);\s*\}/;

const currentReplacement = `
      if (!isGoogleLinked && authData && authData.user && !authData.session) {
        showNotification('Please check your email to verify your account. You can log in after verification.');
        setRegStep('login');
        return;
      }

      setCurrentUser(newProfile);
      updateRecentAccounts(newProfile);
      localStorage.setItem('s_os_user', JSON.stringify(newProfile));
      
      if (regRole === 'student') {
        showNotification(\`Welcome to StudentOS, \${newProfile.name}!\`);
      } else {
        showNotification(\`Request submitted for \${regRole.toUpperCase()} approval. Exploring as Student in the meantime!\`);
      }
`;

content = content.replace(currentRegex, currentReplacement);

// Add email validation
const emailRegex = /if \(\!regEmail\.trim\(\)\) \{\s*showNotification\('Please provide a valid school email\.'\);\s*return;\s*\}/;
const emailReplacement = `
    const emailValidation = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!regEmail.trim() || !emailValidation.test(regEmail.trim())) {
      showNotification('Please provide a valid email format.');
      return;
    }
`;

content = content.replace(emailRegex, emailReplacement);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched email validation and verification');
