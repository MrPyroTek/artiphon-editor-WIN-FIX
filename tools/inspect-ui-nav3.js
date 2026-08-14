const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Where GeneralDevelopmentSettings is used
let p = 0,
  c = 0;
while ((p = b.indexOf('GeneralDevelopmentSettings', p)) >= 0 && c < 8) {
  console.log('GDS', p, b.slice(p - 80, p + 120));
  p += 10;
  c++;
}

// InstrumentEditor children - map module numbers
// Ne=W(me.default - string flip?
// From I1 page: me, he, ye/be, de, ce, ke, se = settings components
const i1 = b.indexOf("I.InstrumentEditor=Fe");
console.log('\nI1 imports area', b.slice(i1 - 800, i1));

// Hammer On techniques - which parent renders it
const h = b.indexOf("'Hammer On'");
console.log('\nHammer On parent context', b.slice(h - 500, h + 50));

// Look for technique panel title
for (const t of [
  'Technique Settings',
  'TECHNIQUE',
  'Behaviors',
  'Play Mode',
  'Mode & Method',
  'Development',
  'Dev Settings',
  'Advanced Settings',
]) {
  console.log(t, b.indexOf("'" + t + "'"), b.indexOf(t));
}

// Find where techniques UI is composed
const tech = b.indexOf('techniquesSetHammerOn');
console.log('\ntech hammer usage parents');
// find export of the Hammer On component and who imports U(xxx)
const hamComp = b.lastIndexOf('function(N,I,U)', h);
console.log(b.slice(hamComp, hamComp + 200));

// Search for Development in UI
p = 0;
c = 0;
while ((p = b.indexOf('Development', p)) >= 0 && c < 15) {
  const snip = b.slice(p - 40, p + 80);
  if (!snip.includes('node_modules') && !snip.includes('__DEV__')) {
    console.log('Dev', p, snip);
  }
  p += 10;
  c++;
}
