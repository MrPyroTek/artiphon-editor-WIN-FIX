const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

function finds(needles, maxPer = 3) {
  for (const n of needles) {
    let i = 0;
    let c = 0;
    console.log('\n########', n);
    while ((i = b.indexOf(n, i)) >= 0 && c < maxPer) {
      console.log('---', i);
      console.log(b.slice(Math.max(0, i - 80), i + 220));
      i += Math.max(1, n.length);
      c++;
    }
    if (c === 0) console.log('(none)');
  }
}

finds(
  [
    'hammer_on',
    'Hammer On',
    'Hammer-On',
    'hammerdown_resting',
    'hammerdown_active',
    'pulloff_open',
    'pressure_sensitivity',
    'Pressure Sensitivity',
    'resting_threshold',
    'active_threshold',
    'title:',
    'Tooltip',
    'data-tip',
    'sensitivity',
  ],
  4
);

// preset 6 ukulele
try {
  const p = JSON.parse(fs.readFileSync('tools/preset-dumps/preset-6.json', 'utf8'));
  console.log('\nUKULELE preset-6', {
    name: p.preset_name,
    hammer_on: p.hammer_on,
    pulloff: p.pulloff_open_string,
    rest: p.hammerdown_resting_threshold,
    active: p.hammerdown_active_threshold,
    fb: p.fingerboard_mode,
    fl: p.fretless,
    br: p.bridge_mode,
  });
} catch (e) {
  console.log('no preset-6', e.message);
}
