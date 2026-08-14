/**
 * Pitch bend UI: firmware 1.0.23 rejects 48 — only 12/24 work.
 * Also default undefined -> 12 so slider doesn't lie.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');

const root = __dirname;
const bundlePath = path.join(root, 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    console.error(oldStr.slice(0, 160));
    process.exit(1);
  }
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
  console.log('OK', label);
}

// Main MIDI Pitch Bend Range slider (INSTRUMENT 1 MIDI SETUP)
mustReplace(
  'pbr-slider-main',
  "title:'Pitch bend range in semitones (12 / 24 / 48).'},void 0,'MIDI Pitch Bend Range')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:12,defaultValue:pe,value:pe,max:48,marks:{12:'12',24:'24',48:'48'},step:null,onChange:me=>{ce.setPitchRange(me)},onAfterChange:me=>{ce.setPitchRange(me)}}))))",
  "title:'Firmware 1.0.23 only accepts 12 or 24 (48 is rejected). Match this value in Surge/FL.'},void 0,'MIDI Pitch Bend Range')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:12,defaultValue:pe||12,value:pe||12,max:24,marks:{12:'12',24:'24'},step:null,onChange:me=>{ce.setPitchRange(me)},onAfterChange:me=>{ce.setPitchRange(me);console.log('pitch_bend_range set',me)}}))))"
);

// Sanitize setPitchRange / setPitchBendRange to clamp 48 -> 24
mustReplace(
  'setPitchRange-clamp',
  'I.setPitchRange=function(Ee){return me({pitch_bend_range:Ee})}',
  "I.setPitchRange=function(Ee){Ee=Ee>=48?24:Ee<=12?12:24;console.log('setPitchRange clamped',Ee);return me({pitch_bend_range:Ee})}"
);

mustReplace(
  'setPitchBendRange-clamp',
  'I.setPitchBendRange=function(Ee,xe){return me({pitch_bend_range:Ee},!1,xe)}',
  "I.setPitchBendRange=function(Ee,xe){Ee=Ee>=48?24:Ee<=12?12:24;console.log('setPitchBendRange clamped',Ee);return me({pitch_bend_range:Ee},!1,xe)}"
);

try {
  new vm.Script(b);
  console.log('SYNTAX OK');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

fs.writeFileSync(bundlePath, b);
execSync(
  'npx --yes @electron/asar pack "' +
    path.join(root, 'app-extracted') +
    '" "' +
    path.join(root, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');
