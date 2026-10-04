const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const validationCode = `
    if (!regName.trim()) {
      showNotification('Please provide a valid name tag.');
      return;
    }
    
    // NEW: Full name validation (only letters, spaces, hyphens)
    const nameRegex = /^[A-Za-z\\s\\-]+$/;
    if (!nameRegex.test(regName.trim())) {
      showNotification('Full name must contain only letters, spaces, and hyphens.');
      return;
    }
`;

content = content.replace(
  /if \(\!regName\.trim\(\)\) \{\s*showNotification\('Please provide a valid name tag\.'\);\s*return;\s*\}/,
  validationCode
);

fs.writeFileSync('src/App.tsx', content);
console.log('Signup validation added');
