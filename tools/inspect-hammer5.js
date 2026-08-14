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

function showAll(label, needle, before = 80, after = 200, max = 10) {
  let i = 0;
  let n = 0;
  console.log('\n########', label, '########');
  while ((i = b.indexOf(needle, i)) >= 0 && n < max) {
    console.log('---', n, 'at', i);
    console.log(b.slice(Math.max(0, i - before), i + after));
    console.log('');
    i += Math.max(needle.length, 1);
    n++;
  }
}

showAll('setHammerOnThreshold', 'setHammerOnThreshold', 100, 250, 10);
showAll('HammerOnThreshold', 'HammerOnThreshold', 80, 200, 10);

// CSS module U(115) near TechniqueSettings - find exports near offset 333980 imports
// ye=U(115) - search webpack module 115 definition is hard; find class near PresetEditor Technique
showAll('render TechniqueSettings component', 'TechniqueSettings', 150, 300, 10);

// Search for where Pe / TechniqueSettings is used as child
show('Instrument settings tabs', b.indexOf("'TECHNIQUE SETTINGS'"), 100, 200);
showAll('Settings nav labels', "void 0,'Settings'", 60, 150, 10);
showAll('General Settings header', 'GENERAL SETTINGS', 80, 250, 5);
showAll('INSTRUMENT SETTINGS', 'INSTRUMENT SETTINGS', 80, 250, 5);
showAll('PRESET SETTINGS', 'PRESET', 40, 100, 20);

// Map Aftertouch Sensitivity handler Y()
show('Aftertouch Sensitivity handler Y', b.indexOf("void 0,'Aftertouch Sensitivity'") - 800, 0, 900);

// Fingerboard thresholds full UI for ranges
show('Fingerboard Thresholds UI', b.indexOf("void 0,'Fingerboard Thresholds'"), 200, 700);
show('Bridgeboard Thresholds UI', b.indexOf("void 0,'Bridgeboard Thresholds'"), 200, 700);

// title= HTML attr on elements (not modal title)
let count = 0;
let i = 0;
console.log('\n===== title= HTML attrs (sample) =====');
while ((i = b.indexOf('title=', i)) >= 0 && count < 20) {
  const ctx = b.slice(Math.max(0, i - 30), i + 80);
  if (!ctx.includes("title:'") && !ctx.includes('title:')) {
    console.log(count, i, ctx);
    count++;
  }
  i += 6;
}

// Dual storage: behaviors.hammer_on vs preset.hammer_on
showAll('behaviors:{hammer_on', 'behaviors:{hammer_on', 40, 100, 5);
show('preset hammer in active_preset updates', b.indexOf("values:{hammer_on"), 80, 200);

// CSS for TechniqueSettings - module 115 around imports: ye=U(115)
// Find nearby CSS with 'main' used by TechniqueSettings - search "TECHNIQUE SETTINGS" parent CSS
// Look at be.default.main - ye=U(115)
show('module near 1087800 PresetEditor', 1087800, 0, 200);

// Find which CSS module has keys used only by TechniqueSettings
showAll('sectionLabel CSS', "sectionLabel:", 40, 200, 5);
showAll('smaller CSS class', "smaller:", 40, 150, 8);

// valid ranges probe tests
const probe = fs.readFileSync(path.join(__dirname, 'node-probe', 'full-param-test.js'), 'utf8');
const m = probe.match(/hammerdown[\s\S]{0,400}/g);
console.log('\n===== probe tests =====');
console.log(m && m.join('\n---\n'));

// Check if TechniqueSettings gates children by mode - read full render again - already know it doesn't
// Check fretted-only note on Hammer-On Sensitivity general
show('Hammer-On Sensitivity Fretted note', b.indexOf("'Fretted Strum'"), 100, 200);

// setPressureSensitivity MIDI path - PRESET_UPDATE_VALUES
show('PRESET_UPDATE_VALUES reducer pressure', b.indexOf('pressure_sensitivity'), 200, 400);
showAll('PRESET_UPDATE_VALUES case', 'PRESET_UPDATE_VALUES:', 100, 500, 5);
