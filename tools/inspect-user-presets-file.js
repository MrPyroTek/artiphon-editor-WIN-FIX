const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf('users_presets.json');
console.log(b.slice(i - 200, i + 400));
const p = JSON.parse(
  fs.readFileSync(process.env.APPDATA + '/Artiphon INSTRUMENT 1 Editor/1_1_0_users_presets.json', 'utf8')
);
console.log('\nexisting', JSON.stringify(p, null, 2).slice(0, 800));
