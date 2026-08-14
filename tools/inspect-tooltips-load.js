const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

console.log('title= count', (b.match(/title:'/g) || []).length);
console.log('loadPresets', b.includes('loadPresets:function'));
console.log('deviceOpened', b.indexOf('deviceOpened'));

const d = b.indexOf('deviceOpened(){');
console.log(b.slice(d, d + 1200));

// Touch Sensitivity / labels without title
for (const lab of [
  'Touch Sensitivity',
  'Neck Touch Threshold',
  'Bridge Touch Threshold',
  'Pulloff (replay on release)',
  'Aftertouch Sensitivity',
  'Capo Step Size',
  'Method Sensitivity',
  'String Flip',
  'Arpeggiator',
]) {
  const i = b.indexOf("'" + lab + "'");
  console.log('\n', lab, i);
  if (i >= 0) console.log(b.slice(Math.max(0, i - 120), i + 80));
}
