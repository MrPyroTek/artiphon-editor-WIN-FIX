const fs = require('fs');
const { execSync } = require('child_process');
const mainPath = require('path').join(__dirname, 'app-extracted', 'main.js');
let main = fs.readFileSync(mainPath, 'utf8');
const old =
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}}]}';
const neu =
  '{label:"Save to INSTRUMENT 1 User 4",accelerator:"Command+4",click:function(){G.webContents.send("save-preset-to-instrument",4)}},{type:"separator"},{label:"Load Presets from INSTRUMENT 1",click:function(){G.webContents.send("load-presets-from-instrument")}}]}';
if (!main.includes(old)) {
  if (main.includes('Command+4') && main.includes('load-presets-from-instrument')) {
    // maybe already on mac too via coincidence - check
    const i = main.indexOf('Command+4');
    console.log(main.slice(i, i + 280));
  }
  console.error('mac pattern not found or already patched');
  process.exit(main.includes('accelerator:"Command+4"') && main.slice(main.indexOf('Command+4'), main.indexOf('Command+4') + 400).includes('load-presets') ? 0 : 1);
}
main = main.replace(old, neu);
fs.writeFileSync(mainPath, main);
execSync('npx --yes @electron/asar pack "' + require('path').join(__dirname, 'app-extracted') + '" "' + require('path').join(__dirname, 'app.asar') + '"', {
  stdio: 'inherit',
});
console.log('mac menu patched + repacked');
