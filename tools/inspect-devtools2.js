const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// DevelopmentTools full render
const d = b.indexOf('I.DevelopmentTools=void 0');
console.log(b.slice(d, d + 1500));

// Find technique editor section - oe.default,{technique:He} in preset settings is Mode/Method picker
// Hammer On is separate - who renders the hammer on module?
// Search for require of hammer module - look at techniques UI container
const techUI = b.indexOf("techniques:le.techniques");
let p = 0,
  c = 0;
while ((p = b.indexOf('techniques:le.techniques', p)) >= 0 && c < 10) {
  console.log('\ntech connect', p);
  console.log(b.slice(p - 100, p + 150));
  p += 10;
  c++;
}

// Look for "technique" panel header in UI
p = 0;
c = 0;
while ((p = b.indexOf('technique', p)) >= 0 && c < 40) {
  const snip = b.slice(p - 20, p + 60);
  if (snip.includes("'") && (snip.includes('h2') || snip.includes('section') || snip.includes('Label') || snip.includes('title'))) {
    console.log('labelish', p, snip);
  }
  p += 9;
  c++;
}

// App shell - where InstrumentEditor and DevelopmentTools mount
for (const name of ['InstrumentEditor', 'GeneralDevelopment', 'DevelopmentTools', 'PresetEditor', 'PresetSettings']) {
  p = 0;
  c = 0;
  while ((p = b.indexOf(name, p)) >= 0 && c < 6) {
    const snip = b.slice(Math.max(0, p - 70), p + 90);
    if (snip.includes('U(') || snip.includes('default') || snip.includes('render')) {
      console.log('\nuse', name, p);
      console.log(snip);
    }
    p += name.length;
    c++;
  }
}
