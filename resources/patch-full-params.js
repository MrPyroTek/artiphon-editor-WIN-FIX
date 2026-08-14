/**
 * Patch editor: correct mode mapping + sanitize rejected firmware params.
 * Then pack app.asar.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname);
const bundlePath = path.join(root, 'app-extracted', 'dist', 'bundle.js');
const mainPath = path.join(root, 'app-extracted', 'main.js');

let b = fs.readFileSync(bundlePath, 'utf8');
let main = fs.readFileSync(mainPath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    console.error('looking for:', oldStr.slice(0, 200));
    process.exit(1);
  }
  if (b.indexOf(oldStr, i + 1) >= 0) {
    console.warn('WARN multiple matches for', label, '- replacing first only');
  }
  console.log('OK', label);
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
}

// 1) grid -> keyboard (One Finger Chords / Piano-style chord grids)
mustReplace(
  'grid->keyboard',
  "case'grid':out.fingerboard_mode='pad';break;",
  "case'grid':out.fingerboard_mode='keyboard';out.fretless=false;break;"
);

// 2) Replace toDevice copy+sanitize so rejected values cannot brick a save
const oldToDeviceTail =
  "var copy=['preset_name','tuning_name','bridgeboard_tuning','fingerboard_tuning','fret_pressure_message','string_flip','transpose_step','arpeggiator','sound_profile','twelve_string','hammer_on','pulloff_open_string','channel_mode','strum_channel','fret_channel','bridge_decay_time','hammerdown_resting_threshold','hammerdown_active_threshold','note_on_bezier','sustain_bezier','aftertouch_bezier','hammerdown_old_bezier','hammerdown_new_bezier','pulloff_bezier'];copy.forEach(function(k){if(editor[k]!==undefined)out[k]=editor[k]});out.id=targetId;delete out.mode;delete out.method;delete out.json_version;delete out.is_factory_preset;delete out.factory_folder;delete out.delay_enabled;delete out.reverb_enabled;delete out.ibow_enabled;delete out.arpeggiator_subdivider;delete out.bridge_pressure_message;delete out.pressure_sensitivity;return out}";

const newToDeviceTail =
  "var copy=['preset_name','tuning_name','bridgeboard_tuning','fingerboard_tuning','fret_pressure_message','string_flip','transpose_step','arpeggiator','sound_profile','twelve_string','hammer_on','pulloff_open_string','channel_mode','strum_channel','fret_channel','bridge_decay_time','hammerdown_resting_threshold','hammerdown_active_threshold','note_on_bezier','sustain_bezier','aftertouch_bezier','hammerdown_old_bezier','hammerdown_new_bezier','pulloff_bezier'];copy.forEach(function(k){if(editor[k]!==undefined)out[k]=editor[k]});" +
  // firmware 1.0.23: only six_channel accepted
  "if(out.channel_mode!=='six_channel'){console.log('sanitize channel_mode',out.channel_mode,'-> six_channel');out.channel_mode='six_channel';}" +
  // only poly_press and none stick; channel_press is silently ignored
  "if(out.fret_pressure_message!=='poly_press'&&out.fret_pressure_message!=='none'){console.log('sanitize fret_pressure_message',out.fret_pressure_message,'-> poly_press');out.fret_pressure_message='poly_press';}" +
  // clamp channels 0-5
  "if(typeof out.strum_channel==='number')out.strum_channel=Math.max(0,Math.min(5,out.strum_channel|0));" +
  "if(typeof out.fret_channel==='number')out.fret_channel=Math.max(0,Math.min(5,out.fret_channel|0));" +
  "if(typeof out.transpose_step==='number')out.transpose_step=Math.max(0,Math.min(12,out.transpose_step|0));" +
  "if(typeof out.sound_profile==='number')out.sound_profile=Math.max(0,Math.min(127,out.sound_profile|0));" +
  "out.id=targetId;delete out.mode;delete out.method;delete out.json_version;delete out.is_factory_preset;delete out.factory_folder;delete out.delay_enabled;delete out.reverb_enabled;delete out.ibow_enabled;delete out.arpeggiator_subdivider;delete out.bridge_pressure_message;delete out.pressure_sensitivity;return out}";

mustReplace('toDevice-sanitize', oldToDeviceTail, newToDeviceTail);

// 3) Expand debug helpers for dump/load
const oldDbgStart = "window.__artiphonDbg={ping:function(){return be.sendCmd('get',{identity:{}})},activate:function(id){return be.sendCmd('activate',{preset:{id:id}})},recover:function(){console.log('recover: activate 1 then 5');return be.sendCmd('activate',{preset:{id:1}}).then(function(r){console.log(r);return be.sendCmd('activate',{preset:{id:5}})})},getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})},";

if (b.includes(oldDbgStart) && !b.includes('dumpPresets:function')) {
  const newDbgStart =
    "window.__artiphonDbg={ping:function(){return be.sendCmd('get',{identity:{}})},activate:function(id){return be.sendCmd('activate',{preset:{id:id}})},recover:function(){console.log('recover: activate 1 then 5');return be.sendCmd('activate',{preset:{id:1}}).then(function(r){console.log(r);return be.sendCmd('activate',{preset:{id:5}})})},getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})}," +
    "fromDevice:function(p){if(!p)return null;var out=Object.assign({},p);switch(p.fingerboard_mode){case'string':out.mode=p.fretless?'fretless_string':'fretted_string';break;case'keyboard':out.mode='grid';break;case'pad':out.mode='pad';break;default:out.mode='fretted_string'}switch(p.bridge_mode){case'pluck':out.method='strum';break;case'press':out.method='press';break;case'bow':out.method='bow';break;case'slide':out.method='slide';break;default:out.method='press'}out.json_version='1.0.1';out.is_factory_preset=!1;delete out.fingerboard_mode;delete out.bridge_mode;return out}," +
    "dumpPresets:function(){var results={},chain=Promise.resolve();[1,2,3,4,5,6,7,8].forEach(function(id){chain=chain.then(function(){return be.sendCmd('get',{preset:{id:id}}).then(function(r){var p=r&&r.data&&r.data.preset;results[id]=p;if(p)console.log('#'+id,p.preset_name,'fb='+p.fingerboard_mode,'br='+p.bridge_mode,'fl='+p.fretless);else console.log('#'+id,'FAIL',r);return results})})});return chain.then(function(){window.__artiphonLastDump=results;console.log('DUMP DONE');return results})}," +
    "loadPresets:function(){return window.__artiphonDbg.dumpPresets().then(function(results){var bankId='instrument1-builtins';Object.keys(results).forEach(function(id){var p=results[id];if(!p)return;var ed=window.__artiphonDbg.fromDevice(p);ed.id=parseInt(id,10);if(be.store&&be.store.dispatch)be.store.dispatch({type:'BANK_SET_PRESET',bankId:bankId,preset:ed});else if(be.dispatch)be.dispatch({type:'BANK_SET_PRESET',bankId:bankId,preset:ed});console.log('UI',ed.id,ed.preset_name,ed.mode,ed.method)});console.log('LOAD INTO UI DONE');return results})},";
  mustReplace('dbg-helpers', oldDbgStart, newDbgStart);
} else if (b.includes('dumpPresets:function')) {
  console.log('SKIP dbg-helpers (already present)');
} else {
  console.error('FAIL dbg-helpers start not found');
  const i = b.indexOf('window.__artiphonDbg=');
  console.log(b.slice(i, i + 300));
  process.exit(1);
}

// 4) IPC load presets
if (!b.includes("load-presets-from-instrument")) {
  mustReplace(
    'ipc-load',
    "pe.ipcRenderer.on('save-preset-to-instrument',",
    "pe.ipcRenderer.on('load-presets-from-instrument',function(){window.__artiphonDbg&&window.__artiphonDbg.loadPresets&&window.__artiphonDbg.loadPresets()}),pe.ipcRenderer.on('save-preset-to-instrument',"
  );
}

// 5) Menu items
function addMenu(label, oldEnd, newEnd) {
  if (main.includes('load-presets-from-instrument')) {
    console.log('SKIP main', label, '(already)');
    return;
  }
  if (!main.includes(oldEnd)) {
    console.error('FAIL main', label);
    process.exit(1);
  }
  main = main.replace(oldEnd, newEnd);
  console.log('OK main', label);
}

addMenu(
  'win',
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Ctrl+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}}]}',
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Ctrl+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}},{type:"separator"},{label:"Load Presets from INSTRUMENT 1",click:function(){G.webContents.send("load-presets-from-instrument")}}]}'
);
addMenu(
  'mac',
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}}]}',
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}},{type:"separator"},{label:"Load Presets from INSTRUMENT 1",click:function(){G.webContents.send("load-presets-from-instrument")}}]}'
);

fs.writeFileSync(bundlePath, b);
fs.writeFileSync(mainPath, main);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
execSync('node --check "' + mainPath + '"', { stdio: 'pipe' });
console.log('SYNTAX OK');

execSync(
  'npx --yes @electron/asar pack "' +
    path.join(root, 'app-extracted') +
    '" "' +
    path.join(root, 'app.asar') +
    '"',
  { stdio: 'inherit', cwd: root }
);
console.log('PACKED app.asar');

// verify mapping in packed content
const verify = fs.readFileSync(bundlePath, 'utf8');
if (!verify.includes("case'grid':out.fingerboard_mode='keyboard'")) {
  console.error('VERIFY FAIL grid mapping');
  process.exit(1);
}
if (!verify.includes("sanitize channel_mode")) {
  console.error('VERIFY FAIL sanitize');
  process.exit(1);
}
console.log('VERIFY OK');
