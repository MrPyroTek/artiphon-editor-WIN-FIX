const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bundlePath = path.join(__dirname, 'app-extracted', 'dist', 'bundle.js');
const mainPath = path.join(__dirname, 'app-extracted', 'main.js');
let b = fs.readFileSync(bundlePath, 'utf8');
let main = fs.readFileSync(mainPath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    console.error(oldStr.slice(0, 160));
    process.exit(1);
  }
  console.log('OK', label);
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
}

// 1) grid -> keyboard (chord grids like One Finger Chords / Piano / Organism)
mustReplace(
  'grid-keyboard',
  "case'grid':out.fingerboard_mode='pad';break;",
  "case'grid':out.fingerboard_mode='keyboard';break;"
);

// 2) Expand debug helpers: dumpPresets + loadPresets into Redux instrument bank
const oldDbg = "window.__artiphonDbg={ping:function(){return be.sendCmd('get',{identity:{}})},activate:function(id){return be.sendCmd('activate',{preset:{id:id}})},recover:function(){console.log('recover: activate 1 then 5');return be.sendCmd('activate',{preset:{id:1}}).then(function(r){console.log(r);return be.sendCmd('activate',{preset:{id:5}})})},getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})},";

if (!b.includes(oldDbg)) {
  // find current dbg start
  const i = b.indexOf('window.__artiphonDbg=');
  console.log('dbg at', i, b.substring(i, i + 200));
  process.exit(1);
}

const newDbg =
  "window.__artiphonDbg={ping:function(){return be.sendCmd('get',{identity:{}})},activate:function(id){return be.sendCmd('activate',{preset:{id:id}})},recover:function(){console.log('recover: activate 1 then 5');return be.sendCmd('activate',{preset:{id:1}}).then(function(r){console.log(r);return be.sendCmd('activate',{preset:{id:5}})})},getPreset:function(id){return be.sendCmd('get',{preset:{id:id}})},fromDevice:function(p){if(!p)return null;var out=Object.assign({},p);switch(p.fingerboard_mode){case'string':out.mode=p.fretless?'fretless_string':'fretted_string';break;case'keyboard':out.mode='grid';break;case'pad':out.mode='pad';break;default:out.mode='fretted_string'}switch(p.bridge_mode){case'pluck':out.method='strum';break;case'press':out.method='press';break;case'bow':out.method='bow';break;case'slide':out.method='slide';break;default:out.method='press'}out.json_version='1.0.1';out.is_factory_preset=!1;return out},dumpPresets:function(){var results={},chain=Promise.resolve();[1,2,3,4,5,6,7,8].forEach(function(id){chain=chain.then(function(){return be.sendCmd('get',{preset:{id:id}}).then(function(r){var p=r&&r.data&&r.data.preset;results[id]=p;if(p)console.log('#'+id,p.preset_name,'fb='+p.fingerboard_mode,'br='+p.bridge_mode,'fl='+p.fretless,p.tuning_name,'sound='+p.sound_profile);else console.log('#'+id,'FAIL',r);return results})})});return chain.then(function(){console.log('DUMP DONE',results);window.__artiphonLastDump=results;return results})},loadPresets:function(){return window.__artiphonDbg.dumpPresets().then(function(results){var bankId='instrument1-builtins';Object.keys(results).forEach(function(id){var p=results[id];if(!p)return;var ed=window.__artiphonDbg.fromDevice(p);ed.id=parseInt(id,10);be.dispatch({type:'BANK_SET_PRESET',bankId:bankId,preset:ed});console.log('loaded UI',ed.id,ed.preset_name,ed.mode,ed.method)});be.dispatch({type:'SET_CONNECTED',connected:!0});console.log('LOAD INTO UI DONE');return results})},";

mustReplace('dbg-expand', oldDbg, newDbg);

// 3) Menu item in main.js Windows + Mac for Load presets
if (!main.includes('load-presets-from-instrument')) {
  main = main.replace(
    '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Ctrl+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}}]}',
    '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Ctrl+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}},{type:"separator"},{label:"Load Presets from INSTRUMENT 1",click:function(){G.webContents.send("load-presets-from-instrument")}}]}'
  );
  main = main.replace(
    '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}}]}',
    '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}},{type:"separator"},{label:"Load Presets from INSTRUMENT 1",click:function(){G.webContents.send("load-presets-from-instrument")}}]}'
  );
  console.log('OK main menu items');
  fs.writeFileSync(mainPath, main);
} else {
  console.log('main menu already present');
}

// 4) IPC listener in renderer
if (!b.includes("load-presets-from-instrument")) {
  mustReplace(
    'ipc-load',
    "pe.ipcRenderer.on('save-preset',",
    "pe.ipcRenderer.on('load-presets-from-instrument',function(){window.__artiphonDbg&&window.__artiphonDbg.loadPresets&&window.__artiphonDbg.loadPresets()}),pe.ipcRenderer.on('save-preset',"
  );
}

// Fix SET_CONNECTED - might be wrong action type. Check setConnected
const sc = b.indexOf('setConnected=function');
console.log('setConnected snippet', b.substring(sc, sc + 120));

fs.writeFileSync(bundlePath, b);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
execSync('node --check "' + mainPath + '"', { stdio: 'pipe' });
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
