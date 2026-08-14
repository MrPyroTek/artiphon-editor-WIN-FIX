const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf('pitch_bend_range');
console.log('count', b.split('pitch_bend_range').length - 1);
let p = 0,
  c = 0;
while ((p = b.indexOf('pitch_bend_range', p)) >= 0 && c < 8) {
  console.log('\n', p, b.slice(p - 60, p + 100));
  p += 10;
  c++;
}
const j = b.indexOf("'MIDI Pitch Bend Range'");
console.log('\nUI', b.slice(j - 50, j + 400));
