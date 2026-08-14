const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

// Find channel mode UI values
const needles = ['one_channel', 'six_channel', 'single_channel', 'channel_mode', 'Channel Mode', 'MIDI Channel'];
for (const n of needles) {
  let i = 0;
  let c = 0;
  while ((i = b.indexOf(n, i)) >= 0 && c < 4) {
    console.log('---', n, i);
    console.log(b.slice(Math.max(0, i - 60), i + 140));
    i += n.length;
    c++;
  }
}

// How beziers are stored/edited
const bi = b.indexOf('note_on_bezier');
console.log('\nnote_on context', b.slice(bi - 40, bi + 200));
