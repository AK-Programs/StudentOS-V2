const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/redirectTo: window\.location\.origin \+ '\/auth\/callback'/g, "redirectTo: window.location.origin");

const insertCode = `
  useEffect(() => {
    if (window.opener && window.location.hash.includes('access_token=')) {
      window.opener.postMessage({
        type: 'SUPABASE_AUTH_SUCCESS',
        hash: window.location.hash
      }, window.location.origin);
      setTimeout(() => window.close(), 500);
    }
  }, []);
`;

code = code.replace("export default function App() {", "export default function App() {\n" + insertCode);
fs.writeFileSync('src/App.tsx', code);
console.log("Fixed Auth Popup Part 2!");
