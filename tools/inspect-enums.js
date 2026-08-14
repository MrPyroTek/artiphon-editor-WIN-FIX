const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

function show(label, idx, before = 80, after = 350) {
  console.log('\n===', label, idx);
  if (idx >= 0) console.log(b.slice(Math.max(0, idx - before), idx + after));
}

show('AFTERTOUCH_NONE', b.indexOf("AFTERTOUCH_NONE='none'"));
show('TECHNIQUES_MODES', b.indexOf('TECHNIQUES_MODES='));
show('channel_press', b.indexOf('channel_press'));
show('six_channel const?', b.indexOf("='six_channel'"));
show('MIDI_CHANNELS', b.indexOf('MIDI_CHANNEL'));

// Find all AFTERTOUCH_ assignments
let i = 0;
while ((i = b.indexOf('AFTERTOUCH_', i)) >= 0) {
  const snip = b.slice(i, i + 60);
  if (snip.includes('=')) console.log('AT', snip);
  i += 10;
}

// Find channel related enums near fret_pressure
const j = b.indexOf("AFTERTOUCH_POLYPHONIC='poly_press'");
show('aftertouch block', j, 100, 200);

// Editor default preset channel_mode
show('default preset', b.indexOf("fret_pressure_message:'poly_press'"), 200, 400);

// Valid methods for grid
show('validMethod grid', b.indexOf("case'grid':return"), 20, 100);
