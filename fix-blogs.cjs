const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Import BlogsPortal
code = code.replace("import SimpleResourceManager from './components/SimpleResourceManager';", "import SimpleResourceManager from './components/SimpleResourceManager';\nimport { BlogsPortal } from './components/BlogsPortal';");

// Find activeTab === 'premium' (which was changed to blogs)
const searchStr = `
            {activeTab === 'premium' && (
              <div className="space-y-6 animate-fadeIn">
`;

// Replace the entire block with <BlogsPortal />
code = code.replace(/\{activeTab === 'premium' && \([\s\S]*?(?=\{activeTab === 'profile')/, 
`{activeTab === 'premium' && (
  <BlogsPortal 
    currentUser={currentUser} 
    isSuperAdmin={currentUser?.role === 'superadmin' || currentUser?.role === 'principal'} 
    showNotification={showNotification} 
  />
)}

`);

fs.writeFileSync('src/App.tsx', code);
