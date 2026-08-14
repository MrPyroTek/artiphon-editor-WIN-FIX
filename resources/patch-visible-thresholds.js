/**
 * Surface touch-detection sliders under Method Sensitivity (visible Instrument 1 Settings).
 * Clarify labels + tooltips for the screen the user already has open.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bundlePath = path.join(__dirname, 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    console.error(oldStr.slice(0, 200));
    process.exit(1);
  }
  console.log('OK', label);
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
}

// 1) Replace Method Sensitivity component with clearer label + fingerboard/bridgeboard sliders
const oldMethod =
  "de.sensitivity_level,ce=de.actions;return $('div',{className:ue.default.settingContainer},void 0,$('div',{className:ue.default.settingPart},void 0,$('label',{className:ue.default.sectionLabel},void 0,'Method Sensitivity')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:0,defaultValue:pe,value:pe,max:3,marks:{0:'Low',1:'Medium',2:'High',3:'Very High'},step:null,onChange:me=>{ce.setGeneralSensitivity(me,!1)},onAfterChange:me=>{ce.setGeneralSensitivity(me,!0)}})))),$('div',{className:ue.default.settingPart},void 0,' '))}}I.default=(0,Z.connect)(function(de){return{sensitivity_level:de.general.general_sensitivity}},function(de){return{actions:(0,J.bindActionCreators)(ae,de)}})(le),N.exports=I['default']}";

if (!b.includes(oldMethod)) {
  // find current method sensitivity block
  const i = b.indexOf("'Method Sensitivity'");
  console.log('current Method Sens context:');
  console.log(b.slice(i - 120, i + 550));
  process.exit(1);
}

const newMethod =
  "de.sensitivity_level,ce=de.actions;" +
  "var fbPress=de.fingerboard_press_threshold,fbRel=de.fingerboard_release_threshold;" +
  "var bbPress=de.bridgeboard_press_threshold,bbRel=de.bridgeboard_release_threshold;" +
  "var fbVals=(fbPress!=null&&fbRel!=null)?[fbRel,fbPress]:[1,2];" +
  "var bbVals=(bbPress!=null&&bbRel!=null)?[bbRel,bbPress]:[1,2];" +
  "var rangeSlider=se.default.createSliderWithTooltip?se.default.createSliderWithTooltip(se.default.Range):null;" +
  // Prefer Range from rc-slider if available via se - Method Sens uses se.default as Slider.
  // Use two number inputs if Range unavailable - but Instrument settings already imports Range elsewhere.
  // We'll use plain Slider marks for method, and HTML range-like dual via existing pattern from Fingerboard (ce=Range).
  // Actually Method Sens module only has se=Slider. Inject simple number inputs + labels for thresholds.
  "return $('div',{},void 0," +
  // Method Sensitivity
  "$('div',{className:ue.default.settingContainer},void 0,$('div',{className:ue.default.settingPart},void 0,$('label',{className:ue.default.sectionLabel,title:'How easy it is to trigger notes overall. If you must press hard, move this toward High / Very High.'},void 0,'Touch Sensitivity'),$('div',{className:ue.default.smaller},void 0,'was: Method Sensitivity')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:0,defaultValue:pe,value:pe,max:3,marks:{0:'Low',1:'Medium',2:'High',3:'Very High'},step:null,onChange:me=>{ce.setGeneralSensitivity(me,!1)},onAfterChange:me=>{ce.setGeneralSensitivity(me,!0)}})))),$('div',{className:ue.default.settingPart},void 0,' '))," +
  // Fingerboard press threshold (single slider 0-40 for usability)
  "$('div',{className:ue.default.settingContainer},void 0,$('div',{className:ue.default.settingPart},void 0,$('label',{className:ue.default.sectionLabel,title:'Neck/fret touch detection. LOWER = easier to trigger (more sensitive).'},void 0,'Neck Touch Threshold'),$('div',{className:ue.default.smaller},void 0,'Fingerboard press (lower=easier)')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:0,max:40,step:1,value:fbPress!=null?fbPress:3,marks:{0:'0',10:'10',20:'20',40:'40'},onChange:me=>{ce.setFingerboardThresholds(me,Math.min(me,fbRel!=null?fbRel:1),!1)},onAfterChange:me=>{ce.setFingerboardThresholds(me,Math.min(me,fbRel!=null?fbRel:1),!0)}})))),$('div',{className:ue.default.settingPart},void 0,' '))," +
  // Bridgeboard
  "$('div',{className:ue.default.settingContainer},void 0,$('div',{className:ue.default.settingPart},void 0,$('label',{className:ue.default.sectionLabel,title:'Bridge/string touch detection. LOWER = easier to trigger.'},void 0,'Bridge Touch Threshold'),$('div',{className:ue.default.smaller},void 0,'Bridge press (lower=easier)')),$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0,$('div',{className:ue.default.sliderContainer},void 0,$(se.default,{min:0,max:40,step:1,value:bbPress!=null?bbPress:3,marks:{0:'0',10:'10',20:'20',40:'40'},onChange:me=>{ce.setBridgeboardThresholds(me,Math.min(me,bbRel!=null?bbRel:1),!1)},onAfterChange:me=>{ce.setBridgeboardThresholds(me,Math.min(me,bbRel!=null?bbRel:1),!0)}})))),$('div',{className:ue.default.settingPart},void 0,' '))" +
  ")}}I.default=(0,Z.connect)(function(de){return{sensitivity_level:de.general.general_sensitivity,fingerboard_press_threshold:de.general.fingerboard_press_threshold,fingerboard_release_threshold:de.general.fingerboard_release_threshold,bridgeboard_press_threshold:de.general.bridgeboard_press_threshold,bridgeboard_release_threshold:de.general.bridgeboard_release_threshold}},function(de){return{actions:(0,J.bindActionCreators)(ae,de)}})(le),N.exports=I['default']}";

mustReplace('method+thresholds', oldMethod, newMethod);

// 2) Clarify Hammer-On Sensitivity label on this same screen
mustReplace(
  'hammer-sens-label-clarify',
  "void 0,'Hammer-On Sensitivity'),le,$('div',{className:ue.default.smaller},void 0,'Fretted Strum')",
  "void 0,'Hammer-On Sensitivity'),le,$('div',{className:ue.default.smaller},void 0,'Fretted Strum — keep Off to avoid frets playing alone')"
);

fs.writeFileSync(bundlePath, b);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
console.log('SYNTAX OK');
execSync(
  'npx --yes @electron/asar pack "' +
    path.join(__dirname, 'app-extracted') +
    '" "' +
    path.join(__dirname, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');
console.log('has Touch Sensitivity', b.includes("'Touch Sensitivity'"));
console.log('has Neck Touch', b.includes("'Neck Touch Threshold'"));
console.log('has Bridge Touch', b.includes("'Bridge Touch Threshold'"));
