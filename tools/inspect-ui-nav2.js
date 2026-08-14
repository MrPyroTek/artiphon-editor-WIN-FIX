const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// GENERAL page composition
const g = b.indexOf("W('h2',{},void 0,'GENERAL')");
console.log('GENERAL page', b.slice(g - 100, g + 400));

// Which components are Fingerboard / Bridgeboard - module exports near them
const f = b.indexOf("'Fingerboard Thresholds'");
// find I.default= connect before this component ends
console.log('\nFingerboard module end nearby');
console.log(b.slice(f + 400, f + 900));

// Instrument 1 settings page children order
const i1 = b.indexOf("W('h2',{},void 0,'INSTRUMENT 1 SETTINGS')");
console.log('\nI1 SETTINGS page', b.slice(i1, i1 + 700));

// Find nav / sidebar labels
for (const lab of ['Presets', 'General', 'Upgrade', 'MIDI', 'Tech', 'Behaviors', 'Factory', 'User']) {
  let p = 0,
    c = 0;
  while ((p = b.indexOf("'" + lab + "'", p)) >= 0 && c < 3) {
    const snip = b.slice(p - 80, p + 120);
    if (/nav|menu|tab|sidebar|route|link|button|label/i.test(snip) || snip.includes('className')) {
      console.log('\nnav?', lab, p);
      console.log(snip);
    }
    p += lab.length;
    c++;
  }
}

// react-router routes
const r = b.indexOf('Route');
let count = 0,
  idx = 0;
while ((idx = b.indexOf('path:', idx)) >= 0 && count < 30) {
  const snip = b.slice(idx, idx + 80);
  if (snip.includes("'") || snip.includes('"')) {
    console.log('path', snip);
    count++;
  }
  idx += 5;
}

// HashRouter / browserHistory paths
for (const p of ['/general', '/settings', '/presets', '/upgrade', '/midi', '#/']) {
  console.log(p, b.includes(p), b.indexOf(p));
}
