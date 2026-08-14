/**
 * Seed Auto Chordinator folder into Artiphon editor user presets.
 * Close the Editor before running.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const bankPath = path.join(__dirname, 'auto-chordinator', 'bank.json');
const userFile = path.join(
  process.env.APPDATA,
  'Artiphon INSTRUMENT 1 Editor',
  '1_1_0_users_presets.json'
);

function uuid() {
  return crypto.randomUUID();
}

function toEditor(p) {
  return {
    json_version: '1.0.1',
    preset_name: p.preset_name,
    tuning_name: p.tuning_name || p.preset_name,
    mode: 'grid',
    method: 'press',
    fingerboard_tuning: p.fingerboard_tuning,
    bridgeboard_tuning: p.bridgeboard_tuning,
    fret_pressure_message: p.fret_pressure_message || 'poly_press',
    string_flip: p.string_flip || 'always_right',
    transpose_step: p.transpose_step != null ? p.transpose_step : 1,
    arpeggiator: !!p.arpeggiator,
    sound_profile: p.sound_profile != null ? p.sound_profile : 2,
    twelve_string: !!p.twelve_string,
    hammer_on: false,
    pulloff_open_string: false,
    channel_mode: 'six_channel',
    strum_channel: p.strum_channel != null ? p.strum_channel : 0,
    fret_channel: p.fret_channel != null ? p.fret_channel : 0,
    bridge_decay_time: p.bridge_decay_time,
    hammerdown_resting_threshold: p.hammerdown_resting_threshold,
    hammerdown_active_threshold: p.hammerdown_active_threshold,
    note_on_bezier: p.note_on_bezier,
    sustain_bezier: p.sustain_bezier,
    aftertouch_bezier: p.aftertouch_bezier,
    hammerdown_old_bezier: p.hammerdown_old_bezier,
    hammerdown_new_bezier: p.hammerdown_new_bezier,
    pulloff_bezier: p.pulloff_bezier,
    is_factory_preset: false,
    id: uuid(),
  };
}

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
let folders = [];
if (fs.existsSync(userFile)) {
  folders = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  if (!Array.isArray(folders)) folders = [];
}

// Remove previous Auto Chordinator folder if re-run
folders = folders.filter((f) => f.name !== 'Auto Chordinator');

const folder = {
  name: 'Auto Chordinator',
  id: uuid(),
  collapsed: false,
  is_factory_preset: false,
  presets: bank.map(toEditor),
};

folders.push(folder);
fs.writeFileSync(userFile, JSON.stringify(folders, null, 2));
console.log('Wrote', folder.presets.length, 'presets to', userFile);
console.log(
  'Presets:',
  folder.presets.map((p) => p.preset_name).join(', ')
);
console.log('Restart Artiphon Editor — look for folder "Auto Chordinator" in the preset list.');
