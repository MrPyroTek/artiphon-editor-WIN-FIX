const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf("'Method Sensitivity'");
console.log(b.slice(i - 900, i + 200));
console.log('\n--- actions module has setFingerboard? ---');
// Method Sens uses ae from U(?) - look at imports at start of this module
const mod = b.lastIndexOf('function(N,I,U)', i);
console.log(b.slice(mod, mod + 400));
