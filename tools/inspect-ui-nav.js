const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

const labels = [
  'PRESET SETTINGS',
  'INSTRUMENT 1 SETTINGS',
  'INSTRUMENT 1 MIDI SETUP',
  'Fingerboard Thresholds',
  'Bridgeboard Thresholds',
  'Method Sensitivity',
  'Hammer-On Sensitivity',
  'Aftertouch Sensitivity',
  'Hammer On',
  'TECHNIQUES',
  'Techniques',
  'GENERAL',
  'Advanced',
  'Settings',
];

for (const lab of labels) {
  const i = b.indexOf("'" + lab + "'");
  const j = b.indexOf('"' + lab + '"');
  const k = b.indexOf('>' + lab + '<');
  const idx = i >= 0 ? i : j >= 0 ? j : k;
  console.log('\n###', lab, idx);
  if (idx >= 0) console.log(b.slice(Math.max(0, idx - 120), idx + 250));
}

// Find Method Sensitivity component wiring
const m = b.indexOf("'Method Sensitivity'");
console.log('\n=== Method Sensitivity full ===');
console.log(b.slice(m - 200, m + 500));

// Find which parent page renders Fingerboard Thresholds
const f = b.indexOf("'Fingerboard Thresholds'");
console.log('\n=== Fingerboard parent ===');
console.log(b.slice(f - 400, f + 100));

// Tab / nav structure
for (const t of ['activeTab', 'selectedTab', 'settingsTab', 'page:', 'SETTINGS_PAGE', 'generalPage']) {
  const x = b.indexOf(t);
  if (x >= 0) console.log(t, x, b.slice(x - 40, x + 100));
}
