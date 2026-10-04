const fs = require('fs');
let code = fs.readFileSync('src/components/AdminCenter.tsx', 'utf8');

if (!code.includes("import UserImportCSV")) {
  code = code.replace("import { supabase } from '../lib/supabase';", "import { supabase } from '../lib/supabase';\nimport UserImportCSV from './UserImportCSV';");
}

if (!code.includes("<UserImportCSV />")) {
  const insertStr = "</div>\n      {adminSubTab === 'requests' ? (";
  const replacement = "</div>\n\n      {adminSubTab === 'users' && currentUser.role === 'super_admin' && (\n        <div className=\"mb-8\">\n          <UserImportCSV />\n        </div>\n      )}\n\n      {adminSubTab === 'requests' ? (";
  code = code.replace(insertStr, replacement);
  fs.writeFileSync('src/components/AdminCenter.tsx', code);
  console.log("Added UserImportCSV to AdminCenter");
} else {
  console.log("Already added.");
}
