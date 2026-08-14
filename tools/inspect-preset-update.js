const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// How active preset fields are updated
const needles = [
  'PRESET_UPDATE_VALUES',
  'setActivePreset',
  'UPDATE_ACTIVE',
  'hammer_on:',
  'active_preset:',
  "values:{hammer_on",
];
for (const n of needles) {
  let i = 0,
    c = 0;
  console.log('\n####', n);
  while ((i = b.indexOf(n, i)) >= 0 && c < 4) {
    console.log(i, b.slice(Math.max(0, i - 50), i + 150));
    i += n.length;
    c++;
  }
}

// preset update action that sends midi
const i = b.indexOf('PRESET_UPDATE_VALUES=');
console.log('\nPRESET_UPDATE', b.slice(i, i + 300));
