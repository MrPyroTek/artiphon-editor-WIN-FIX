const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const bundlePath = path.join(__dirname, 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

console.log('helper def', b.includes('window.__artiphonSetPulloff=function'));
console.log('sync expo', b.includes('window.__artiphonSyncTechnique=function'));

if (!b.includes('window.__artiphonSetPulloff=function')) {
  const oldExpo =
    "window.__artiphonSyncTechnique=function(t){return window.__artiphonDbg&&window.__artiphonDbg.syncTechnique&&window.__artiphonDbg.syncTechnique(t)};window.__artiphonDbg=";
  if (!b.includes(oldExpo)) {
    const i = b.indexOf('window.__artiphonSyncTechnique');
    console.log('sync at', i, b.slice(i, i + 250));
    process.exit(1);
  }
  const newExpo =
    "window.__artiphonSyncTechnique=function(t){return window.__artiphonDbg&&window.__artiphonDbg.syncTechnique&&window.__artiphonDbg.syncTechnique(t)};" +
    "window.__artiphonSetPulloff=function(on){try{var be=window.__artiphonMidi;if(!be)return;var st=be.store&&be.store.getState&&be.store.getState();var ap=st&&st.active_preset;var id=ap&&ap.id;id=parseInt(id,10);if(!(id>=1&&id<=8)){console.log('setPulloff: need slot 1-8',ap&&ap.id);return}console.log('setPulloff',id,on);return be.sendCmd('get',{preset:{id:id}}).then(function(got){var base=got&&got.data&&got.data.preset;if(!base)throw got;var body=Object.assign({},base,{id:id,pulloff_open_string:!!on});return be.sendCmd('set',{preset:body})}).then(function(){return be.sendCmd('activate',{preset:{id:id}})}).then(function(){if(be.store&&be.store.dispatch)be.store.dispatch({type:'PRESET_UPDATE_VALUES',values:{pulloff_open_string:!!on},send_midi:!1})})}catch(e){console.log('setPulloff err',e)}};window.__artiphonDbg=";
  b = b.replace(oldExpo, newExpo);
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
  console.log('helper added + packed');
} else {
  console.log('helper already present');
}

// Check CSS classes used
const i = b.indexOf('Pulloff (replay on release)');
console.log(b.slice(i - 50, i + 600));
