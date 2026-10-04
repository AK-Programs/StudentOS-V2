const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace all instances of '/auth/callback' with ''
code = code.replace(/redirectTo: window.location.origin \+ '\/auth\/callback'/g, "redirectTo: window.location.origin + '/'");

// Add the popup check inside the main App component, right after `const [currentSlideIndex, setCurrentSlideIndex] = useState(0);`
const searchStr = "const [currentSlideIndex, setCurrentSlideIndex] = useState(0);";
if (code.includes(searchStr)) {
  const insertCode = `
  useEffect(() => {
    if (window.opener && window.location.hash.includes('access_token=')) {
      console.log('[Auth] Found access_token in popup. Sending message to parent.');
      window.opener.postMessage({
        type: 'SUPABASE_AUTH_SUCCESS',
        hash: window.location.hash
      }, window.location.origin);
      setTimeout(() => window.close(), 500);
      return;
    }
  }, []);
  `;
  code = code.replace(searchStr, searchStr + insertCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Fixed Auth Popup!");
} else {
  console.log("Could not find search string.");
}
