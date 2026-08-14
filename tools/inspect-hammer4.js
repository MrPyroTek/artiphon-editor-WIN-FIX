const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

function show(label, idx, before = 80, after = 700) {
  console.log('\n===', label, idx);
  if (idx >= 0) console.log(b.slice(Math.max(0, idx - before), idx + after));
}

// Save path - how src preset is built
show('DIRECT set / save start', b.indexOf('function toDevice'));
show('bankSaveToInstrument', b.indexOf('bankSaveToInstrument'));
show('save-preset-to-instrument handler', b.indexOf("save-preset-to-instrument"));

// Where techniques hammer syncs into preset
show('preset.hammer_on', b.indexOf('hammer_on:me.behaviors'));
show('active_preset hammer', b.indexOf("hammer_on:"));

// Look for merge techniques into preset
const patterns = [
  'behaviors.hammer_on',
  'technique.behaviors',
  'findTechnique',
  'hammerdown_resting_threshold=',
  'active_preset.hammer_on',
  'values.hammer_on',
];
for (const p of patterns) {
  let i = 0,
    c = 0;
  while ((i = b.indexOf(p, i)) >= 0 && c < 3) {
    console.log('\n*', p, i);
    console.log(b.slice(Math.max(0, i - 60), i + 160));
    i += p.length;
    c++;
  }
}

// Fingerboard threshold UI label
show('Fingerboard Press', b.indexOf('Fingerboard Press'));
show('Fingerboard Threshold', b.indexOf('Fingerboard Threshold'));
show('setFingerboardThresholds UI', b.indexOf('setFingerboardThresholds(ge'));

// general get/set identity style for thresholds
show('fingerboard_press_threshold in UI', b.indexOf("fingerboard_press_threshold:"));
