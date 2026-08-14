const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const d = b.indexOf('deviceOpened(){');
console.log(b.slice(d, d + 2500));

const html = fs.readFileSync('resources/app-extracted/app.html', 'utf8');
console.log('\n=== app.html ===');
console.log(html.slice(0, 800));
