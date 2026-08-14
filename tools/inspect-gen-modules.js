const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Find module IDs for Fingerboard and Bridgeboard by walking webpack table is hard.
// Find U(XXX) that is Fingerboard: search for unique string then find which parent U() requires it.

// Simpler: find all occurrences of fingerboard_press_threshold in connect maps - only the component itself.
// Find who requires the fingerboard module - look for pattern near GeneralDevelopment - modules 518,521,531,538,539,554

// Dump labels of each of those modules by finding function(N,I,U) that is the Nth... 
// Actually search for sectionLabel nearby each module id usage in General page:
// Ee=W(ie.default) ie=U(554)
// xe=W(le.default) le=U(518)
// Ce=W(pe.default) pe=U(531)
// Pe=W(fe.default) fe=U(521)
// we=W(ye.default) ye=U(539) wait he=U(539), ye=q(he) - we=W(ye)
// Te=W(ge.default) ge=U(538)

function moduleApprox(id) {
  // Find U(id) definitions - webpack: modules are in array, hard.
  // Search for comments or unique - find "U("+id+")" usages
  const needle = 'U(' + id + ')';
  let i = 0,
    c = 0;
  console.log('\n### module', id);
  while ((i = b.indexOf(needle, i)) >= 0 && c < 4) {
    console.log(i, b.slice(i - 30, i + 50));
    i += needle.length;
    c++;
  }
}

[554, 518, 531, 521, 538, 539].forEach(moduleApprox);

// Find where GeneralDevelopmentSettings default is imported - search U(xxx) near GeneralDevelopment filename... 
// Search for .GeneralDevelopmentSettings or require of that module's default in a parent render
const gds = b.indexOf('GeneralDevelopmentSettings');
// The module exports both - who does U(N) where that module is N?
// Look for parent that renders both InstrumentEditor and something

const mainUI = b.indexOf('connected_i1');
let p = 0,
  c = 0;
while ((p = b.indexOf('connected_i1', p)) >= 0 && c < 15) {
  console.log('\nconn', p, b.slice(p - 100, p + 150));
  p += 10;
  c++;
}
