const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

function show(label, idx, before = 80, after = 600) {
  console.log('\n===', label, idx);
  if (idx >= 0) console.log(b.slice(Math.max(0, idx - before), idx + after));
  else console.log('(missing)');
}

show('fingerboard_press', b.indexOf('fingerboard_press_threshold'));
show('Fingerboard', b.indexOf('Fingerboard'));
show('Bridgeboard Threshold', b.indexOf('Bridgeboard'));
show('setFingerboardThresholds', b.indexOf('setFingerboardThresholds'));
show('General Sensitivity slider', b.indexOf('setGeneralSensitivity'));

// How technique midi is sent - search midi_send related to techniques
show('sendTechnique', b.indexOf('sendTechnique'));
show('techniques midi', b.indexOf("cmd:'set'") && b.indexOf('technique'));

// Look for how techniques send_midi is handled in middleware
let i = b.indexOf('send_midi');
let c = 0;
while (i >= 0 && c < 8) {
  const snip = b.slice(i - 100, i + 200);
  if (snip.includes('hammer') || snip.includes('technique') || snip.includes('midi_send') || snip.includes('GENERAL')) {
    console.log('\nsend_midi@', i, snip.replace(/\n/g, ' '));
  }
  i = b.indexOf('send_midi', i + 1);
  c++;
}

// TECHNIQUES_UPDATE_HAMMER_ON reducer / midi
show('TECHNIQUES_UPDATE_HAMMER_ON', b.indexOf("TECHNIQUES_UPDATE_HAMMER_ON='"));

// How preset hammer_on gets set from techniques when saving
show('behaviors.hammer_on', b.indexOf('behaviors.hammer_on'));

// General hammer on sensitivity UI full
show('Hammer-On Sensitivity Fretted', b.indexOf("'Hammer-On Sensitivity'"));

// marks Off Low
show('marks Off', b.indexOf("marks:{0:'Off',1:'Low'"));
