const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf('BANK_ADD_FOLDER');
console.log(b.slice(i, i + 400));
const j = b.indexOf('bankAddFolder=function');
console.log('\naddFolder', b.slice(j, j + 200));
const k = b.indexOf('users_presets');
console.log('\nusers', b.slice(k - 80, k + 200));
// initial state banks
const m = b.indexOf('is_factory_preset:!0');
console.log('\nfactory banks area');
let p = b.indexOf('presets:[');
console.log('presets at', p, b.slice(p, p + 150));
