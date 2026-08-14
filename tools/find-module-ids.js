const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');

// Find webpackJsonp or modules array start
const start = b.indexOf('function(N,I,U){');
console.log('first module at', start);

// Heuristic: find module containing Fingerboard Thresholds, then walk back to find its index
// by locating in the require map if any: /* 521 */ comments - unlikely in minified.

// Look for asar source maps
const path = require('path');
const dist = path.join('resources', 'app-extracted', 'dist');
console.log(fs.readdirSync(dist).filter((f) => f.includes('map') || f.includes('js')));

// Grep section labels inside modules near General imports - read each module by finding
// unique export after Fingerboard
const fb = b.indexOf("'Fingerboard Thresholds'");
const bb = b.indexOf("'Bridgeboard Thresholds'");
const ms = b.indexOf("'Method Sensitivity'");

function findModuleIdGuess(pos, label) {
  // Search backwards for N.exports of previous and forwards
  // Webpack 1 style: {521:function...} or array
  // Try find ",521:function" or "[521]" patterns near - 
  const before = b.lastIndexOf('function(N,I,U)', pos);
  const after = b.indexOf('N.exports=', pos);
  console.log('\n', label, 'modStart', before, 'exports', after);
  // Look for numeric key before function: ,NNN:function(N,I,U) or NNN:function
  const keyArea = b.slice(Math.max(0, before - 30), before + 20);
  console.log('keyArea', keyArea);
  return before;
}

findModuleIdGuess(fb, 'Fingerboard');
findModuleIdGuess(bb, 'Bridgeboard');
findModuleIdGuess(ms, 'MethodSens');

// Check bundle format at beginning of modules
const boot = b.indexOf('webpackJsonp') >= 0 ? b.indexOf('webpackJsonp') : b.indexOf('modules');
console.log('boot', b.slice(0, 200));
console.log('webpackJsonp', b.indexOf('webpackJsonp'));
console.log('__webpack_require__', b.indexOf('__webpack_require__'));

// Look at how U is defined in an inner closure - the outer is webpackBootstrap
const wr = b.indexOf('function U(N)');
console.log('U def', wr, b.slice(wr, wr + 200));
