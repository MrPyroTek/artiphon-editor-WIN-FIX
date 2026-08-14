const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

// Find class definition with sendCmd and dispatch
const markers = ['this.dispatch=', 'this.store=', 'sendCmd=function', 'sendCmd(', 'midiMiddleware'];
for (const m of markers) {
  let i = 0;
  let count = 0;
  while ((i = b.indexOf(m, i)) >= 0 && count < 5) {
    console.log('\n===', m, i);
    console.log(b.slice(Math.max(0, i - 100), i + 200));
    i += m.length;
    count++;
  }
}

// Full __artiphonDbg block end
const start = b.indexOf('window.__artiphonDbg=');
const end = b.indexOf('}}', start);
// find better - look for tryMinSet end
const t = b.indexOf('tryMinSet', start);
console.log('\n=== dbg around tryMinSet');
console.log(b.slice(start, start + 2500));
