const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// bundle: module.exports=function(N){...}([mod0,mod1,...])
const arrStart = b.indexOf('}([');
if (arrStart < 0) {
  // try }( [ 
  console.log('no }([ at', arrStart);
}
console.log('arrStart candidates', b.indexOf('}(['), b.indexOf('})(['));

// Find the modules array - after bootstrap
const marker = 'G.loaded=!0,G.exports}var U={};return I.m=N,I.c=U,I.p="",I(0)}(';
const m = b.indexOf(marker);
console.log('marker', m);
const open = b.indexOf('[', m + marker.length - 1);
console.log('open', open, b.slice(open, open + 40));

// Parse modules by matching top-level function(N,I,U) or function(N,I) in the array
// Simpler: for ids of interest, use a require simulation

function getModuleSource(id) {
  // Evaluate isn't safe. Count array elements.
  // Use regex to split on },function( at top level - fragile.
}

// Use source map instead
const map = JSON.parse(fs.readFileSync('resources/app-extracted/dist/bundle.js.map', 'utf8'));
console.log('sources sample', map.sources && map.sources.filter((s) => /Fingerboard|Bridgeboard|MethodSensitivity|GeneralDev|InstrumentEditor|HammerOn/i.test(s)).slice(0, 40));

// Map source to module via webpack:// paths
const interesting = (map.sources || []).filter((s) =>
  /threshold|sensitivity|HammerOn|GeneralDevelopment|InstrumentEditor|DevelopmentTools/i.test(s)
);
console.log('\ninteresting sources:');
interesting.forEach((s) => console.log(s));
