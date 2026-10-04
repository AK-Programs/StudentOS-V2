const fs = require('fs');
let code = fs.readFileSync('src/components/SubstituteHub.tsx', 'utf8');

code = code.replace(/Grade 9-A/g, 'Grade 9 Astra');
code = code.replace(/Grade 9-B/g, 'Grade 9 Elara');
code = code.replace(/Grade 10-A/g, 'Grade 10 Solara');
code = code.replace(/Grade 10-B/g, 'Grade 10 Vega');
code = code.replace(/Grade 11-A/g, 'Grade 11 Astra');
code = code.replace(/Grade 11-B/g, 'Grade 11 Elara');
code = code.replace(/Grade 12-A/g, 'Grade 12 Solara');
code = code.replace(/Grade 12-B/g, 'Grade 12 Vega');

fs.writeFileSync('src/components/SubstituteHub.tsx', code);
console.log('Fixed substitute hub sections');
