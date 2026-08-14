/**
 * Add visible Pulloff Open String On/Off under Instrument 1 Settings
 * (next to Touch Sensitivity), writing to active User preset.
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
    console.error(oldStr.slice(0, 220));
    process.exit(1);
  }
  console.log('OK', label);
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
}

// Find our Touch Sensitivity block end - add Pulloff row before closing
const marker = "$('div',{className:ue.default.settingPart},void 0,' '))" + ")}}I.default=(0,Z.connect)(function(de){return{sensitivity_level:de.general.general_sensitivity,fingerboard_press_threshold:";

if (!b.includes(marker)) {
  // try find Bridge Touch Threshold ending
  const i = b.indexOf("'Bridge Touch Threshold'");
  console.log(b.slice(i, i + 800));
  process.exit(1);
}

const pulloffRow =
  "," +
  "$('div',{className:ue.default.settingContainer},void 0," +
  "$('div',{className:ue.default.settingPart},void 0,$('label',{className:ue.default.sectionLabel,title:'If On, lifting your finger from a fret can re-trigger a note (open string / pulloff). Turn Off to stop the note from playing again when you release.'},void 0,'Pulloff (replay on release)'),$('div',{className:ue.default.smaller},void 0,'Active User preset'))," +
  "$('div',{className:ue.default.settingContentContainer},void 0,$('div',{className:ue.default.settingContent},void 0," +
  "$('button',{className:(de.pulloff_open_string?ue.default.settingButtonCurrent:ue.default.settingButton),onClick:function(){ce.setPulloff&&ce.setPulloff(!0);if(window.__artiphonSetPulloff)window.__artiphonSetPulloff(!0)}},void 0,'On')," +
  "$('button',{className:(!de.pulloff_open_string?ue.default.settingButtonCurrent:ue.default.settingButton),onClick:function(){ce.setPulloff&&ce.setPulloff(!1);if(window.__artiphonSetPulloff)window.__artiphonSetPulloff(!1)}},void 0,'Off')" +
  ")),$('div',{className:ue.default.settingPart},void 0,' '))";

const oldEnd =
  "$('div',{className:ue.default.settingPart},void 0,' '))" +
  ")}}I.default=(0,Z.connect)(function(de){return{sensitivity_level:de.general.general_sensitivity,fingerboard_press_threshold:de.general.fingerboard_press_threshold,fingerboard_release_threshold:de.general.fingerboard_release_threshold,bridgeboard_press_threshold:de.general.bridgeboard_press_threshold,bridgeboard_release_threshold:de.general.bridgeboard_release_threshold}},function(de){return{actions:(0,J.bindActionCreators)(ae,de)}})(le),N.exports=I['default']}";

const newEnd =
  "$('div',{className:ue.default.settingPart},void 0,' '))" +
  pulloffRow +
  ")}}I.default=(0,Z.connect)(function(de){return{sensitivity_level:de.general.general_sensitivity,fingerboard_press_threshold:de.general.fingerboard_press_threshold,fingerboard_release_threshold:de.general.fingerboard_release_threshold,bridgeboard_press_threshold:de.general.bridgeboard_press_threshold,bridgeboard_release_threshold:de.general.bridgeboard_release_threshold,pulloff_open_string:!!(de.active_preset&&de.active_preset.pulloff_open_string)}},function(de){return{actions:(0,J.bindActionCreators)(ae,de)}})(le),N.exports=I['default']}";

mustReplace('pulloff-visible', oldEnd, newEnd);

// Helper __artiphonSetPulloff on window next to syncTechnique
if (!b.includes('__artiphonSetPulloff')) {
  const oldExpo =
    "window.__artiphonSyncTechnique=function(t){return window.__artiphonDbg&&window.__artiphonDbg.syncTechnique&&window.__artiphonDbg.syncTechnique(t)};window.__artiphonDbg=";
  const newExpo =
    "window.__artiphonSyncTechnique=function(t){return window.__artiphonDbg&&window.__artiphonDbg.syncTechnique&&window.__artiphonDbg.syncTechnique(t)};" +
    "window.__artiphonSetPulloff=function(on){try{var be=window.__artiphonMidi;if(!be)return;var st=be.store&&be.store.getState&&be.store.getState();var ap=st&&st.active_preset;var id=ap&&ap.id;id=parseInt(id,10);if(!(id>=1&&id<=8)){console.log('setPulloff: need User/instrument slot 1-8, got',ap&&ap.id);alert('Select a User preset (1-8) first, then toggle Pulloff.');return}console.log('setPulloff',id,on);return be.sendCmd('get',{preset:{id:id}}).then(function(got){var base=got&&got.data&&got.data.preset;if(!base)throw got;var body=Object.assign({},base,{id:id,pulloff_open_string:!!on});return be.sendCmd('set',{preset:body})}).then(function(r){console.log('setPulloff result',r);return be.sendCmd('activate',{preset:{id:id}})}).then(function(){if(be.store&&be.store.dispatch)be.store.dispatch({type:'PRESET_UPDATE_VALUES',values:{pulloff_open_string:!!on},send_midi:!1})})}catch(e){console.log('setPulloff err',e)}};window.__artiphonDbg=";
  mustReplace('setPulloff-helper', oldExpo, newExpo);
}

fs.writeFileSync(bundlePath, b);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
execSync(
  'npx --yes @electron/asar pack "' +
    path.join(__dirname, 'app-extracted') +
    '" "' +
    path.join(__dirname, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');
console.log('has Pulloff replay', b.includes('Pulloff (replay on release)'));
console.log('has setPulloff', b.includes('__artiphonSetPulloff'));
