const fs = require('fs');
let code = fs.readFileSync('src/components/StudentOSJarvis.tsx', 'utf8');

code = code.replace(
  /setSearchResults\(data\.text \|\| "No results fetched\."\);/,
  'setSearchResults(data.summary || data.text || "No results fetched.");'
);
code = code.replace(
  /setSearchSources\(data\.sources \|\| \[\]\);/,
  'setSearchSources(data.results || data.sources || []);'
);

fs.writeFileSync('src/components/StudentOSJarvis.tsx', code);
