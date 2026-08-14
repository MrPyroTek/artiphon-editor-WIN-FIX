const fs = require('fs');
const acorn = require('acorn');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Find broken title: patterns - look for title:' with odd quotes
const re = /title:'([^']*)'/g;
let m;
let bad = [];
while ((m = re.exec(b))) {
  // ok
}
// Find title:" 
// Look for title: that isn't properly closed before },void
const re2 = /title:'[^']*\},void/g;
let x;
while ((x = re2.exec(b))) {
  bad.push(x[0].slice(0, 120));
}

// Manual scan for syntax - use vm.Script
const vm = require('vm');
try {
  new vm.Script(b, { filename: 'bundle.js' });
  console.log('OK parse');
} catch (e) {
  console.log(e.message);
  // Extract line:col from message
  const mm = /bundle\.js:(\d+)/.exec(e.stack || '');
  console.log(e.stack.split('\n').slice(0, 5).join('\n'));
}

// Search suspicious: title: without matching
const idx = b.indexOf("title:'Multi Channel");
console.log('midi', b.slice(idx - 20, idx + 200));

const idx2 = b.indexOf("title:'Allow bending");
console.log('bend', b.slice(idx2 - 20, idx2 + 150));

const idx3 = b.indexOf("I1 Tilt Range");
console.log('tilt range', b.slice(idx3 - 40, idx3 + 120));

// Find any title: that contains unescaped apostrophe mid-string by looking for title:'...n't...
const apo = b.match(/title:'[^']*'[a-zA-Z]/);
console.log('broken apo?', apo && apo[0]);
