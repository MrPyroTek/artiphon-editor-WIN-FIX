const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf('midiMiddleware=function');
console.log(b.slice(i, i + 200));
// find class constructor for MIDI
const j = b.indexOf('function ye(ve)');
const k = b.indexOf('this.store');
console.log('this.store', k, b.slice(k - 40, k + 80));
let p = 0,
  c = 0;
while ((p = b.indexOf('this.dispatch', p)) >= 0 && c < 5) {
  console.log('dispatch', p, b.slice(p - 30, p + 60));
  p += 10;
  c++;
}
// constructor of midi class near deviceOpened
const m = b.indexOf('deviceOpened');
console.log('near deviceOpened', b.slice(m - 200, m + 100));
