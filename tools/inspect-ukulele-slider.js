const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const p5 = JSON.parse(fs.readFileSync('tools/preset-dumps/preset-5.json', 'utf8'));

console.log('preset5 keys related', {
  name: p5.preset_name,
  mode: p5.fingerboard_mode,
  fl: p5.fretless,
  br: p5.bridge_mode,
  hammer: p5.hammer_on,
  fpm: p5.fret_pressure_message,
  channel: p5.channel_mode,
});

// UI shown only for fretted / strum
for (const s of [
  'Fretted Strum',
  'Fretted String',
  'fretless_string',
  'fretted_string',
  'pitch_bend',
  'Pitch Bend',
  'string_bend',
  'String Bending',
  'mpe_mode',
  'MPE',
]) {
  let i = 0,
    c = 0;
  console.log('\n###', s);
  while ((i = b.indexOf(s, i)) >= 0 && c < 3) {
    console.log(b.slice(Math.max(0, i - 100), i + 160).replace(/\n/g, ' '));
    i += s.length;
    c++;
  }
}

// Conditional render for technique-specific settings
const i = b.indexOf("'Fretted Strum'");
console.log('\nFretted Strum parents', b.slice(i - 250, i + 100));
