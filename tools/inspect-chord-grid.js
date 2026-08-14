const fs = require('fs');
const path = require('path');

// Compare chord-style presets tunings
for (const id of [3, 5, 6, 7]) {
  const p = JSON.parse(fs.readFileSync(path.join('tools/preset-dumps', `preset-${id}.json`), 'utf8'));
  const fb = p.fingerboard_tuning || [];
  console.log('\n#' + id, p.preset_name, p.fingerboard_mode, p.bridge_mode, 'fl=' + p.fretless);
  console.log('bridge', p.bridgeboard_tuning);
  console.log('fb len', fb.length);
  // show as 6 strings x 12 frets if 72
  if (fb.length >= 72) {
    for (let s = 0; s < 6; s++) {
      const row = fb.slice(s * 12, s * 12 + 12);
      console.log(' str' + s, row.join(','));
    }
  } else {
    console.log('fb', fb.slice(0, 24));
  }
}

// How banks/folders work in editor
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
for (const s of ['BANK_ADD_FOLDER', 'factory_folder', 'Scaled Chords', 'One Finger', 'users_presets', 'addFolder']) {
  const i = b.indexOf(s);
  console.log(s, i);
}
