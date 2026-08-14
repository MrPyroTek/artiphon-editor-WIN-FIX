const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Find webpack module that contains Fingerboard - get module id from surrounding
const f = b.indexOf("'Fingerboard Thresholds'");
const modStart = b.lastIndexOf('function(N,I,U)', f);
// Look for N.exports and previous function(N - the module is registered as U(NNN)
// Search backwards for ,function(N,I,U) pattern count from bootstrap... hard.

// Instead: which parent page includes the fingerboard component by searching unique nearby string usage
// The fingerboard component connects to fingerboard_press_threshold - find if General page imports it

const gen = b.indexOf('I.GeneralDevelopmentSettings=Ne');
console.log('General Dev full module imports+render');
console.log(b.slice(gen - 600, gen + 100));

const br = b.indexOf("'Bridgeboard Thresholds'");
console.log('\nBridgeboard near exports');
console.log(b.slice(br + 350, br + 700));

// App layout - left nav items
for (const s of [
  'InstrumentEditor',
  'GeneralDevelopmentSettings',
  'DevelopmentTools',
  'active_info.connected',
  'devcontainer',
  'selectedView',
  'currentView',
  'showDev',
]) {
  let i = 0,
    c = 0;
  while ((i = b.indexOf(s, i)) >= 0 && c < 5) {
    if (s === 'InstrumentEditor' || s === 'GeneralDevelopmentSettings' || s === 'DevelopmentTools') {
      // only when used as JSX/component child
      const snip = b.slice(Math.max(0, i - 100), i + 80);
      if (snip.includes('.default') || snip.includes('U(')) {
        console.log('\n', s, i);
        console.log(snip);
      }
    }
    i += s.length;
    c++;
  }
}

// Main app component render
const app = b.indexOf('Artiphon');
console.log('\nArtiphon refs');
let p = 0,
  c = 0;
while ((p = b.indexOf('Artiphon', p)) >= 0 && c < 10) {
  console.log(p, b.slice(p - 30, p + 80));
  p += 7;
  c++;
}

// Look for tab buttons in main
for (const lab of ['Editor', 'Instrument', 'Dev', 'Info', 'Upgrade', 'About']) {
  const i = b.indexOf("void 0,'" + lab + "'");
  console.log('btn', lab, i);
  if (i >= 0) console.log(b.slice(i - 80, i + 120));
}
