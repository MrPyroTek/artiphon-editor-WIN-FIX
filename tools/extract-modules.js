const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Format: module.exports=function(N){function I(q){...}var U={};return I.m=N,I.c=U,I.p="",I(0)}([modules...])
const endBootstrap = b.indexOf('I.p=""');
console.log('I.p', endBootstrap, b.slice(endBootstrap, endBootstrap + 80));
const callOpen = b.indexOf('}([', endBootstrap);
console.log('callOpen', callOpen, b.slice(callOpen, callOpen + 60));

// If that fails try I(0)}(
const alt = b.indexOf('I(0)}([');
console.log('alt', alt);
const start = alt >= 0 ? alt + 'I(0)}('.length : callOpen + 2;

// Extract module sources for specific IDs by walking the array with a paren counter
function extractModules(src, fromIdx) {
  // fromIdx points to '['
  const modules = [];
  let i = fromIdx + 1;
  while (i < src.length) {
    // skip whitespace/comma
    while (i < src.length && /[\s,]/.test(src[i])) i++;
    if (src[i] === ']') break;
    if (src.slice(i, i + 8) === 'function') {
      const startFn = i;
      // find matching end of function - track braces from first {
      const braceStart = src.indexOf('{', i);
      let depth = 0;
      let j = braceStart;
      for (; j < src.length; j++) {
        const ch = src[j];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        } else if (ch === '"' || ch === "'" || ch === '`') {
          // skip strings
          const q = ch;
          j++;
          while (j < src.length) {
            if (src[j] === '\\') {
              j += 2;
              continue;
            }
            if (src[j] === q) break;
            j++;
          }
        }
      }
      modules.push(src.slice(startFn, j));
      i = j;
    } else {
      console.log('unexpected at', i, src.slice(i, i + 40));
      break;
    }
  }
  return modules;
}

const bracket = b.indexOf('[', alt + 4);
console.log('bracket', bracket);
const modules = extractModules(b, bracket);
console.log('module count', modules.length);

for (const id of [518, 521, 531, 538, 539, 554, 536, 537, 540, 511, 512, 320]) {
  const m = modules[id];
  if (!m) {
    console.log(id, 'MISSING');
    continue;
  }
  const label = m.match(/sectionLabel\},void 0,'([^']+)'/);
  const label2 = m.match(/void 0,'([^']+)'/);
  const h2 = m.match(/h2',\{\},void 0,'([^']+)'/);
  console.log(id, 'len', m.length, 'label', label && label[1], 'h2', h2 && h2[1], 'firstStr', label2 && label2[1]);
}
