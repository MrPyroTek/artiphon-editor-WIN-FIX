const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

// Find BANK_SET_PRESET assignment
let i = 0;
while ((i = b.indexOf('BANK_SET_PRESET', i)) >= 0) {
  console.log('---', i);
  console.log(b.slice(i - 40, i + 80));
  i += 1;
}

// How does Midi class expose dispatch / store?
const j = b.indexOf('window.__artiphonMidi=be');
console.log('\n=== midi context', j);
console.log(b.slice(j - 400, j + 900));

// Windows menu for presets
const main = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app-extracted', 'main.js'), 'utf8');
const wi = main.indexOf('Ctrl+4');
console.log('\n=== win menu', wi);
if (wi >= 0) console.log(main.slice(wi - 200, wi + 200));
