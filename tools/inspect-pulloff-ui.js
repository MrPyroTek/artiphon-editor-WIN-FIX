const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf("'Pulloff Open String'");
console.log('pulloff UI', i);
console.log(b.slice(i - 200, i + 450));

// Where is it shown - techniques panel
const j = b.indexOf('techniquesSetPulloffOpenString');
console.log('\nsetPulloff', b.slice(j - 50, j + 200));
