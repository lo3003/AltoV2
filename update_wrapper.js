const fs = require('fs');
const content = fs.readFileSync('src/pages/coach/ProgramBuilder.tsx', 'utf8');
const start = content.indexOf('rendered.push(');
const end = content.indexOf('continue;'); // We have two of these, one above, one below.
// Let's find the correct markers.
