/**
 * Fix Windows editor sanitize: allow one_channel + six_channel.
 * Map legacy single_channel -> one_channel.
 * Repack app.asar.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const bundlePath = path.join(root, 'app-extracted', 'dist', 'bundle.js');
let b = fs.readFileSync(bundlePath, 'utf8');

const oldSan =
  "if(out.channel_mode!=='six_channel'){console.log('sanitize channel_mode',out.channel_mode,'-> six_channel');out.channel_mode='six_channel';}";

const newSan =
  "if(out.channel_mode==='single_channel'||out.channel_mode==='mono'){console.log('sanitize channel_mode',out.channel_mode,'-> one_channel');out.channel_mode='one_channel';}" +
  "else if(out.channel_mode!=='six_channel'&&out.channel_mode!=='one_channel'){console.log('sanitize channel_mode',out.channel_mode,'-> six_channel');out.channel_mode='six_channel';}";

if (!b.includes(oldSan)) {
  if (b.includes("single_channel'||out.channel_mode==='mono'")) {
    console.log('already patched');
  } else {
    console.error('sanitize block not found');
    const i = b.indexOf('sanitize channel_mode');
    console.log(b.slice(i - 40, i + 200));
    process.exit(1);
  }
} else {
  b = b.replace(oldSan, newSan);
  console.log('OK channel_mode sanitize (one_channel + six_channel)');
}

// Ensure Windows Ctrl save menu still has Load Presets
const mainPath = path.join(root, 'app-extracted', 'main.js');
const main = fs.readFileSync(mainPath, 'utf8');
const winOk =
  main.includes('accelerator:"Ctrl+1"') &&
  main.includes('accelerator:"Ctrl+4"') &&
  main.includes('Load Presets from INSTRUMENT 1') &&
  main.includes('load-presets-from-instrument');
console.log('Windows menu OK:', winOk);
if (!winOk) process.exit(1);

// Ensure grid->keyboard still there
if (!b.includes("case'grid':out.fingerboard_mode='keyboard'")) {
  console.error('grid mapping missing');
  process.exit(1);
}
console.log('grid->keyboard OK');

fs.writeFileSync(bundlePath, b);
execSync('node --check "' + bundlePath + '"', { stdio: 'pipe' });
execSync(
  'npx --yes @electron/asar pack "' +
    path.join(root, 'app-extracted') +
    '" "' +
    path.join(root, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');
