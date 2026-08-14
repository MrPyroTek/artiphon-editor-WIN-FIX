const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join('resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

// TECHNIQUES_UPDATE_HAMMER_ON_VALUE handler - what does W() do?
const i = b.indexOf('TECHNIQUES_UPDATE_HAMMER_ON_VALUE');
console.log('=== hammer on reducer', i);
console.log(b.slice(i - 50, i + 450));

// Find function W used in techniques reducer for send
// Looking at: !oe.fromDevice&&oe.send_midi&&W(oe.mode,oe.method,se)
// Need the techniques module's W = midi send
const j = b.indexOf('function(N,I,U){function q(Ae){return Ae&&Ae.__esModule');
// Search for midi send of technique
const markers = [
  'sendArtiphonSysex',
  "cmd:'set',data:{method",
  'method:{',
  'behaviors:{hammer_on',
  'midi_send_cmd',
];

// Find where techniques MIDI is actually sent - look near TECHNIQUES reducers
const k = b.indexOf('!oe.fromDevice&&oe.send_midi&&W(');
console.log('\n=== first send_midi W call context');
console.log(b.slice(k - 200, k + 100));

// Find definition of W in that module - go backwards for var W=
let start = k;
for (let n = 0; n < 5; n++) {
  const prev = b.lastIndexOf('function(N,I,U)', start - 1);
  console.log('\nmodule at', prev);
  console.log(b.slice(prev, prev + 400));
  start = prev;
}

// General settings UI page - what labels exist
for (const lab of [
  'Fingerboard Thresholds',
  'Bridgeboard Thresholds',
  'General Sensitivity',
  'Hammer-On Sensitivity',
  'Debounce',
]) {
  const x = b.indexOf("'" + lab + "'");
  console.log('\nlabel', lab, x);
  if (x >= 0) console.log(b.slice(x - 40, x + 350));
}

// How general is sent to device
const g = b.indexOf("cmd:'set'") ;
let c = 0;
let p = 0;
while ((p = b.indexOf('general', p)) >= 0 && c < 20) {
  const snip = b.slice(p - 40, p + 80);
  if (snip.includes('send') || snip.includes('set') || snip.includes('midi') || snip.includes('get')) {
    console.log('\ngen@', p, snip);
  }
  p += 7;
  c++;
}
