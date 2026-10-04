const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Find activeTab === 'whiteboard'
const startIndex = code.indexOf("{activeTab === 'whiteboard' && (");
if (startIndex !== -1) {
  // Find the matching closing bracket for this condition
  let depth = 0;
  let endIndex = -1;
  let started = false;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code.slice(i, i + "{activeTab === 'whiteboard' && (".length) === "{activeTab === 'whiteboard' && (") {
      started = true;
    }
    
    if (started) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    const replacement = `{activeTab === 'whiteboard' && (
                <Whiteboard2 onClose={() => setActiveTab('dashboard')} currentUser={currentUser} />
              )}`;
    code = code.slice(0, startIndex) + replacement + code.slice(endIndex + 1);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Successfully replaced whiteboard section.");
  } else {
    console.log("Could not find end bracket.");
  }
} else {
  console.log("Could not find whiteboard section start.");
}
