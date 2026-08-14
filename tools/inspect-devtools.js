const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

const d = b.indexOf('I.DevelopmentTools=');
console.log('DevTools', b.slice(d - 900, d + 200));

// Who imports DevelopmentTools
let p = 0,
  c = 0;
while ((p = b.indexOf('DevelopmentTools', p)) >= 0 && c < 12) {
  console.log(p, b.slice(p - 60, p + 100));
  p += 10;
  c++;
}

// Preset settings page - what shows Hammer On
const ps = b.indexOf("G('h2',{},void 0,'PRESET SETTINGS')");
console.log('\nPRESET SETTINGS page', b.slice(ps, ps + 900));

// Search for where hammer on component is included in a parent list
const hamExport = b.indexOf("void 0,'Hammer On'))");
// module number - look at N.exports after component
const after = b.indexOf('N.exports=I', hamExport);
console.log('\nafter hammer component', b.slice(hamExport, after + 80));
