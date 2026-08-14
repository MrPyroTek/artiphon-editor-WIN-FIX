const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
// Check CSS module class names used near Method/Touch Sensitivity
const i = b.indexOf("'Touch Sensitivity'");
console.log(b.slice(i - 100, i + 50));
// Find settingButton in style modules near ue
const j = b.indexOf('settingButtonCurrent');
console.log('settingButtonCurrent count', b.split('settingButtonCurrent').length - 1);
console.log('settingButton count', (b.match(/settingButton[^C]/]/g) || []).length);
// Look at css exports
const k = b.indexOf('settingButton:');
console.log('settingButton:', k, b.slice(k, k + 80));
