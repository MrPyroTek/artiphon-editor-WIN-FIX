const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bundlePath = path.join('resources', 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

function addTip(labelText, tip) {
  const needle = "},void 0,'" + labelText + "')";
  const i = b.indexOf(needle);
  if (i < 0) return 'missing';
  const prev = b.slice(Math.max(0, i - 120), i);
  if (prev.includes('title:')) return 'already';
  const safe = tip.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const neu = ",title:'" + safe + "'},void 0,'" + labelText + "')";
  b = b.slice(0, i) + neu + b.slice(i + needle.length);
  try {
    new vm.Script(b);
    return 'ok';
  } catch (e) {
    // revert
    b = b.slice(0, i) + needle + b.slice(i + neu.length);
    return 'BROKEN: ' + e.message + ' | ctx=' + b.slice(i - 80, i + needle.length + 40);
  }
}

const tests = [
  ['Aftertouch Sensitivity', 'Pressure after a note is held - controls MIDI aftertouch / expression.'],
  ['Capo Step Size', 'Semitones moved per capo/transpose step. 1 = chromatic, 12 = octave.'],
  ['String Flip', 'Which side is string 1. Automatic follows the accelerometer.'],
  ['String Flip Override', 'Override String Flip for this preset only. No Override uses Instrument setting.'],
  ['Arpeggiator', 'When On, held notes play as an arpeggio based on Global Tempo.'],
  ['Arpeggiator Subdivider', 'Note division for the arpeggiator relative to Global Tempo.'],
  ['String Bending', 'Allow bending notes by sliding sideways on fretted strings.'],
  ['I1 Tilt', 'Enable tilt sensor as a MIDI expression source.'],
  ['MIDI Mode', 'Multi Channel = one MIDI channel per string. Single Channel = all notes on one channel.'],
  ['MIDI Pitch Bend Range', 'Pitch bend range in semitones (12 / 24 / 48).'],
  ['MIDI Program Changes', 'When On, the instrument knob can send MIDI program changes.'],
  ['Global Tempo', 'BPM used by the arpeggiator and tempo-synced features.'],
  ['Pulloff (replay on release)', 'On = lifting a finger re-triggers a note. Turn Off to stop replay when you release.'],
  ['Hammer-On Sensitivity', 'Global hammer-on strength for Fretted Strum. Keep Off to avoid frets playing alone.'],
];

// Also test autoload alone first
const oldConnect =
  "console.log('identity OK - NOT full-sync (avoids bricking USB)');Oe((0,oe.setConnected)(!0));return Ae('activate',{preset:{id:1}}).then(function(r){console.log('activate1',r);return true},function(){return true})";
const newConnect = "console.log('identity OK - loading presets from INSTRUMENT 1');Oe((0,oe.setConnected)(!0));return Promise.resolve(true)";
const bi = b.indexOf(oldConnect);
if (bi >= 0) {
  const nb = b.slice(0, bi) + newConnect + b.slice(bi + oldConnect.length);
  try {
    new vm.Script(nb);
    console.log('autoload stub OK');
    b = nb;
  } catch (e) {
    console.log('autoload stub FAIL', e.message);
  }
}

for (const [lab, tip] of tests) {
  console.log(lab, '->', addTip(lab, tip));
}

// Show all Hammer-On Sensitivity contexts
let p = 0;
while ((p = b.indexOf('Hammer-On Sensitivity', p)) >= 0) {
  console.log('\nHOS@', p, b.slice(p - 100, p + 80));
  p += 10;
}
