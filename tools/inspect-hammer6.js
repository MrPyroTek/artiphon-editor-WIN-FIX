const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(
  path.join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'),
  'utf8'
);

function show(label, idx, before = 100, after = 600) {
  console.log('\n========', label, idx, '========');
  if (idx < 0) {
    console.log('NOT FOUND');
    return;
  }
  console.log(b.slice(Math.max(0, idx - before), idx + after));
}

// Aftertouch Sensitivity full module including Y and $ helpers
show(
  'Aftertouch Sensitivity module start',
  b.indexOf("I.setPressureSensitivity=function"),
  0,
  50
);
show(
  'Aftertouch UI helpers',
  b.indexOf('function Y(ge,fe,me)'),
  0,
  200
);
// find Y near Aftertouch Sensitivity
{
  const lab = b.indexOf("void 0,'Aftertouch Sensitivity'");
  show('ctx before Aftertouch Sensitivity label', lab, 1200, 100);
}

// TechniqueSettings imports: Z=572, ae=579, ue=577, se=578, de=571, Q=573, ce=576, me=574, he=575
// Map each module ID to first sectionLabel string nearby by searching webpack bootstrap is hard.
// Instead: locate each child by unique label and print connect mapState

const labels = [
  'Bridge Decay Time',
  'Hammer On',
  'Hammer-On Active Threshold',
  'Hammer-On Resting Threshold',
  'Hammer-On New Bezier',
  'Note On Bezier',
  'Press Bezier',
  'Aftertouch Bezier',
  'Pulloff Open String',
];
console.log('\n===== child components by label =====');
for (const l of labels) {
  const i = b.indexOf("void 0,'" + l) >= 0 ? b.indexOf("void 0,'" + l) : b.indexOf(l);
  console.log('\n--', l, i);
  console.log(b.slice(Math.max(0, i - 80), i + 220));
}

// TechniqueSettings render order from source:
// Z(572), ae(579), ue(577), se(578), de(571), Q(573), ce(576), me(574), he(575)
// Match offsets of labels to guess order by proximity to TechniqueSettings (~334k) vs later (~93x)
console.log('\n===== label offsets (order by file position ~webpack order) =====');
labels
  .map((l) => ({
    l,
    i: b.indexOf("void 0,'" + l) >= 0 ? b.indexOf("void 0,'" + l) : b.indexOf(l),
  }))
  .sort((a, b) => a.i - b.i)
  .forEach((x) => console.log(x.i, x.l));

// Where is TechniqueSettings used? Search for require of its module - exported name usage
// After class Pe definition, only TechniqueSettings=Pe. Search InstrumentEditor / tabs
show('InstrumentEditor main', b.indexOf("InstrumentEditor__main"), 200, 400);
showAll = (n, needle) => {
  let i = 0,
    c = 0;
  console.log('\n##', n);
  while ((i = b.indexOf(needle, i)) >= 0 && c < 8) {
    console.log(c, i, b.slice(Math.max(0, i - 100), i + 200));
    i += needle.length;
    c++;
  }
};
showAll('InstrumentEditor component', 'InstrumentEditor');
showAll('PresetEditor with techniques', 'PresetEditor');

// Find tab that shows technique settings - search h2 MODE and TECHNIQUE
show('MODE selector sibling', b.indexOf("void 0,'MODE'"), 100, 400);
showAll('h2 TECHNIQUE', "'TECHNIQUE");
showAll('Settings tab strings', 'Settings');

// generalSet MIDI for hammer_on_sensitivity
show('generalSet / midi_send general', b.indexOf('GENERAL_UPDATE_VALUES'), 100, 500);
showAll('midi_send_cmd general', "midi_send_cmd)('set',{general", 50, 150, 10);
showAll('general send', '{general:', 40, 120, 15);

// full-test results for thresholds
const fr = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'preset-dumps', 'full-test-results.json'), 'utf8')
);
console.log('\n===== full-test hammer thresholds =====');
fr.params
  .filter((p) => /hammer|pulloff|pressure/i.test(p.key))
  .forEach((p) => console.log(JSON.stringify(p)));
