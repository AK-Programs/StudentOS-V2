const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    if (!validateEmail(regEmail)) {
      showNotification('Please provide a valid email format.');
      return;
    }`;

const newTarget = `    if (!validateEmail(regEmail)) {
      showNotification('Please provide a valid email format.');
      return;
    }
    if (!/^[a-zA-Z\\s]+$/.test(regName.trim()) || regName.trim().length < 2) {
      showNotification('Please provide a valid Full Name (letters and spaces only).');
      return;
    }`;

if (code.includes(target)) {
  code = code.replace(target, newTarget);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Added name validation');
} else {
  console.log('Name validation target not found');
}
