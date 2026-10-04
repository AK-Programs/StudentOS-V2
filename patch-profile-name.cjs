const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const handleSaveProfile = async \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*if \(\!currentUser\) return;/;
const replacement = `const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const nameRegex = /^[A-Za-z\\s\\-]+$/;
    const proposedName = profileNameInput.trim() || currentUser.name;
    if (!nameRegex.test(proposedName)) {
      showNotification('Full name must contain only letters, spaces, and hyphens.');
      return;
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);
console.log('Patched handleSaveProfile');
