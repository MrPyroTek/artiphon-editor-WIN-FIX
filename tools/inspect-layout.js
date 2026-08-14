const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Find main layout that composes editors
const needles = [
  'InstrumentEditor',
  'DevelopmentTools',
  'GeneralDevelopment',
  'PresetSettings',
  'default.main',
  'className:ae.default.app',
  'className:Q.default.app',
  'className:se.default.app',
];

for (const n of needles) {
  let i = 0,
    c = 0;
  while ((i = b.indexOf(n, i)) >= 0 && c < 3) {
    const snip = b.slice(Math.max(0, i - 150), i + 100);
    if (/render|return |U\(|\.default/.test(snip)) {
      console.log('\n', n, i);
      console.log(snip);
    }
    i += n.length;
    c++;
  }
}

// Look for scrollable settings column composition
const idx = b.indexOf("'PRESET SETTINGS'");
// Who renders PresetSettings class ze
const parent = b.indexOf('PresetEditor');
console.log('\nPresetEditor area', b.slice(parent - 200, parent + 400));

// Search for components rendered together
const layout = b.indexOf('connected_i1:Ue.active_info.connected}},null)(Fe)');
console.log('\nafter InstrumentEditor', b.slice(layout, layout + 500));
