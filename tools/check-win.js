const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');
const m = fs.readFileSync(path.join('resources', 'app-extracted', 'main.js'), 'utf8');
const p1 = JSON.parse(fs.readFileSync(path.join('tools', 'preset-dumps', 'preset-1.json'), 'utf8'));

console.log('grid->kb', b.includes("fingerboard_mode='keyboard'"));
console.log('sanitize', b.includes('sanitize channel_mode'));
console.log('dumpPresets', b.includes('dumpPresets'));
console.log('loadPresets', b.includes('loadPresets'));
console.log('Load menu', m.includes('Load Presets from INSTRUMENT'));
console.log('Ctrl+1', m.includes('accelerator:"Ctrl+1"'));
console.log('Ctrl+4 load nearby:');
const i = m.indexOf('accelerator:"Ctrl+4"');
console.log(m.slice(i, i + 400));

console.log('\nbezier sample note_on:');
console.log(JSON.stringify(p1.note_on_bezier));
console.log('sustain:', JSON.stringify(p1.sustain_bezier));
console.log('keys bezier:', Object.keys(p1).filter((k) => k.includes('bezier')));
