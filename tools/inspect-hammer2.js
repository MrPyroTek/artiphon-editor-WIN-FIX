const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

function show(label, idx, before = 100, after = 500) {
  console.log('\n===', label, idx);
  if (idx >= 0) console.log(b.slice(Math.max(0, idx - before), idx + after));
}

// Hammer On UI buttons
show('Hammer On UI', b.indexOf("'Hammer On')"));
show('preset hammer sensitivity', b.indexOf("Hammer-On Sensitivity')"));
show('general sensitivity', b.indexOf('setGeneralSensitivity'));
show('bridgeboard_press', b.indexOf('bridgeboard_press_threshold'));
show('general_sensitivity label', b.indexOf('General Sensitivity'));
show('Sensitivity label', b.indexOf("'Sensitivity'"));

// How techniques send midi for hammer_on
show('techniquesSetHammerOn', b.indexOf('techniquesSetHammerOn=function'));

// Is live technique send blocked?
const blockIdx = b.indexOf('skip live');
show('skip live', blockIdx);

// find midi send for techniques / hammer
let i = 0;
let c = 0;
while ((i = b.indexOf('hammer_on', i)) >= 0 && c < 15) {
  const snip = b.slice(i - 30, i + 80);
  if (snip.includes('send') || snip.includes('midi') || snip.includes('setHammer') || snip.includes('preset')) {
    console.log('\nhammer@', i, snip);
  }
  i += 8;
  c++;
}

// preset-level setHammerOn
show('setHammerOn action', b.indexOf('I.setHammerOn=function'));

// Convert techniques -> preset fields when saving
show('hammerdown_active in converter', b.indexOf('hammerdown_active_threshold'));

// findSensitivity
show('findSensitivity def', b.indexOf('findSensitivity=function'));
show('findSensitivity=', b.indexOf('findSensitivity:'));
