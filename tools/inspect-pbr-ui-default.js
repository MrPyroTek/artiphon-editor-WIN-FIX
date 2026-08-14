const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf('pitch_range:de.general.pitch_bend_range');
console.log(b.slice(i - 200, i + 350));
const j = b.indexOf('range:fe.general.pitch_bend_range');
console.log('\n---\n', b.slice(j - 200, j + 400));
