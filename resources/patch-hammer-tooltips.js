/**
 * Fix hammer-on sync to device, general threshold save, tooltips, fingerboard help.
 * Windows Artiphon Editor pack.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const bundlePath = path.join(root, 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    console.error(oldStr.slice(0, 180));
    process.exit(1);
  }
  console.log('OK', label);
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
}

// 1) Technique MIDI send: also sync hammer_on/pulloff/thresholds onto active user preset slot
const oldW =
  "function W(ae,oe,ue){(0,te.midi_send_cmd)('set',{technique_settings:ue}),(0,te.midi_send_cmd)('save',{technique_settings:{mode:ae,method:oe}})}";
const newW =
  "function W(ae,oe,ue){(0,te.midi_send_cmd)('set',{technique_settings:ue}),(0,te.midi_send_cmd)('save',{technique_settings:{mode:ae,method:oe}});try{if(typeof window!=='undefined'&&window.__artiphonSyncTechnique)window.__artiphonSyncTechnique(ue)}catch(err){console.log('syncTechnique',err)}}";
mustReplace('technique-W-sync', oldW, newW);

// 2) General live updates: persist with save {general:true}
const oldGen =
  "case $.GENERAL_UPDATE_VALUES:return!J.fromDevice&&J.send_midi&&(0,X.midi_send_cmd)('set',{general:J.values}),console.log(J.values),Object.assign({},Q,J.values);";
const newGen =
  "case $.GENERAL_UPDATE_VALUES:if(!J.fromDevice&&J.send_midi){(0,X.midi_send_cmd)('set',{general:J.values});(0,X.midi_send_cmd)('save',{general:!0})}console.log(J.values);return Object.assign({},Q,J.values);";
mustReplace('general-save', oldGen, newGen);

// 3) Add __artiphonSyncTechnique helper next to dbg helpers
const oldDbgMark = "dumpPresets:function(){";
if (!b.includes('__artiphonSyncTechnique=function') && !b.includes('syncTechnique:function')) {
  // Insert syncTechnique into __artiphonDbg object after getPreset
  const anchor =
    "getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})},fromDevice:function(p){";
  if (!b.includes(anchor)) {
    console.error('FAIL dbg anchor');
    const i = b.indexOf('getPreset:function');
    console.log(b.slice(i, i + 200));
    process.exit(1);
  }
  const syncFn =
    "getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})}," +
    "syncTechnique:function(tech){try{if(!tech||!tech.behaviors)return;var bh=tech.behaviors;var patch={};if(bh.hammer_on!==undefined)patch.hammer_on=!!bh.hammer_on;if(bh.pulloff_open_string!==undefined)patch.pulloff_open_string=!!bh.pulloff_open_string;if(!Object.keys(patch).length)return;var st=be.store&&be.store.getState&&be.store.getState();var ap=st&&st.active_preset;var id=ap&&ap.id;if(!id||id==='edit_buffer'){console.log('syncTechnique: no user slot id',id);return}id=parseInt(id,10);if(!(id>=1&&id<=8)){console.log('syncTechnique: skip non-slot',id);return}console.log('syncTechnique patch slot',id,patch);return be.sendCmd('get',{preset:{id:id}}).then(function(got){var base=got&&got.data&&got.data.preset;if(!base)throw got;var body=Object.assign({},base,patch,{id:id});return be.sendCmd('set',{preset:body}).then(function(res){console.log('syncTechnique set',res);return be.sendCmd('activate',{preset:{id:id}})}).then(function(){if(be.store&&be.store.dispatch)be.store.dispatch({type:'PRESET_UPDATE_VALUES',values:patch,send_midi:!1});return be.sendCmd('get',{preset:{id:id}})}).then(function(v){var p=v&&v.data&&v.data.preset;console.log('syncTechnique VERIFY hammer_on=',p&&p.hammer_on,'pulloff=',p&&p.pulloff_open_string)})})}catch(e){console.log('syncTechnique error',e)}}," +
    "fromDevice:function(p){";
  mustReplace('syncTechnique-helper', anchor, syncFn);
  // also expose as window.__artiphonSyncTechnique
  const oldMidiAssign = 'window.__artiphonMidi=be;window.__artiphonDbg=';
  const newMidiAssign =
    "window.__artiphonMidi=be;window.__artiphonSyncTechnique=function(t){return window.__artiphonDbg&&window.__artiphonDbg.syncTechnique&&window.__artiphonDbg.syncTechnique(t)};window.__artiphonDbg=";
  mustReplace('expose-sync', oldMidiAssign, newMidiAssign);
} else {
  console.log('SKIP syncTechnique (exists)');
}

// 4) On Save: merge technique hammer_on into editor src before toDevice
const oldSaveLog =
  "INSTRUMENT',slot,src.preset_name,src.mode,src.method);var send=fe.midi_send_cmd;function toDevice";
const newSaveLog =
  "INSTRUMENT',slot,src.preset_name,src.mode,src.method);" +
  "try{var _st=fe.midi_send_cmd&&window.__artiphonMidi&&window.__artiphonMidi.store&&window.__artiphonMidi.store.getState&&window.__artiphonMidi.store.getState();if(_st&&_st.techniques&&src.mode&&src.method){var _tech=null;for(var _i=0;_i<_st.techniques.length;_i++){var _t=_st.techniques[_i];if(_t&&_t.mode===src.mode&&_t.method===src.method){_tech=_t;break}}if(_tech&&_tech.behaviors){if(_tech.behaviors.hammer_on!==undefined){src.hammer_on=!!_tech.behaviors.hammer_on;console.log('save merge hammer_on',src.hammer_on)}if(_tech.behaviors.pulloff_open_string!==undefined){src.pulloff_open_string=!!_tech.behaviors.pulloff_open_string;console.log('save merge pulloff',src.pulloff_open_string)}}}}catch(_e){console.log('save merge tech',_e)}" +
  "var send=fe.midi_send_cmd;function toDevice";
mustReplace('save-merge-tech', oldSaveLog, newSaveLog);

// 5) Tooltips on key labels
mustReplace(
  'tip-hammer-on',
  "X('label',{className:ie.default.sectionLabel},void 0,'Hammer On')",
  "X('label',{className:ie.default.sectionLabel,title:'On = pressing frets triggers notes without strumming. Off = frets only select pitch; you must hit the bridge/strings to play. Changes are written to the active User preset.'},void 0,'Hammer On')"
);

mustReplace(
  'tip-pulloff',
  "X('label',{className:ie.default.sectionLabel},void 0,'Pulloff Open String')",
  "X('label',{className:ie.default.sectionLabel,title:'When On, lifting a finger can re-trigger the open string note.'},void 0,'Pulloff Open String')"
);

mustReplace(
  'tip-fingerboard-thresh',
  "$('label',{className:ue.default.sectionLabel},void 0,'Fingerboard Thresholds')",
  "$('label',{className:ue.default.sectionLabel,title:'Touch detection on the neck. LOWER = more sensitive (easier trigger). Left handle = release, right handle = press. Range 0–127.'},void 0,'Fingerboard Thresholds')"
);

mustReplace(
  'tip-bridgeboard-thresh',
  "$('label',{className:ue.default.sectionLabel},void 0,'Bridgeboard Thresholds')",
  "$('label',{className:ue.default.sectionLabel,title:'Touch detection on the bridge/strings. LOWER = more sensitive. Left = release, right = press.'},void 0,'Bridgeboard Thresholds')"
);

mustReplace(
  'tip-hammer-sens-general',
  "$('label',{className:ue.default.sectionLabel},void 0,'Hammer-On Sensitivity'),le,$('div',{className:ue.default.smaller},void 0,'Fretted Strum')",
  "$('label',{className:ue.default.sectionLabel,title:'Global hammer-on strength for Fretted Strum. Off disables global hammer-ons. Separate from the per-technique Hammer On switch.'},void 0,'Hammer-On Sensitivity'),le,$('div',{className:ue.default.smaller},void 0,'Fretted Strum')"
);

// Optional: tip on preset-level Hammer-On Sensitivity label if present as simple label
if (b.includes("$('label',{className:ue.default.sectionLabel},void 0,'Hammer-On Sensitivity'))")) {
  mustReplace(
    'tip-hammer-sens-preset',
    "$('label',{className:ue.default.sectionLabel},void 0,'Hammer-On Sensitivity'))",
    "$('label',{className:ue.default.sectionLabel,title:'How hard you must press a fret for hammer-on / fret detect. Related to resting threshold.'},void 0,'Hammer-On Sensitivity'))"
  );
}

fs.writeFileSync(bundlePath, b);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
console.log('SYNTAX OK');
execSync(
  'npx --yes @electron/asar pack "' +
    path.join(root, 'app-extracted') +
    '" "' +
    path.join(root, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');

// verify
const v = fs.readFileSync(bundlePath, 'utf8');
[
  '__artiphonSyncTechnique',
  'syncTechnique:function',
  'save merge hammer_on',
  'save',
  '{general:!0}',
  'LOWER = more sensitive',
].forEach((s) => console.log(v.includes(s) ? 'VERIFY OK' : 'VERIFY FAIL', s));
