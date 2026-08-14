const fs = require('fs');
const b = fs.readFileSync(
  require('path').join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'),
  'utf8'
);
const main = fs.readFileSync(
  require('path').join(__dirname, '..', 'resources', 'app-extracted', 'main.js'),
  'utf8'
);
const needles = [
  "case'grid'",
  '__artiphonDbg',
  "fingerboard_mode='pad'",
  "fingerboard_mode='keyboard'",
  'BANK_SET_PRESET',
  'save-preset-to-instrument',
  'load-presets-from-instrument',
  'setConnected',
  'instrument1-builtins',
  'toDevice',
  'edit_buffer',
  'be.dispatch',
  'bankSetPreset',
];
for (const n of needles) {
  const i = b.indexOf(n);
  console.log('\n===', n, i);
  if (i >= 0) console.log(b.slice(Math.max(0, i - 60), i + 280));
}
console.log('\n=== MAIN save menu', main.indexOf('Save to INSTRUMENT'));
const mi = main.indexOf('Save to INSTRUMENT');
if (mi >= 0) console.log(main.slice(mi - 40, mi + 500));
