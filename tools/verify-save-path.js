/**
 * Confirm Windows save path copies all device-accepted fields.
 * Reads toDevice from bundle (no MIDI).
 */
const fs = require('fs');
const path = require('path');
const b = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app-extracted', 'dist', 'bundle.js'), 'utf8');

const i = b.indexOf('function toDevice');
const chunk = b.slice(i, i + 2800);
console.log(chunk);

// Extract copy list
const m = chunk.match(/var copy=\[([^\]]+)\]/);
if (m) {
  const keys = m[1].split(',').map((s) => s.replace(/'/g, '').trim());
  console.log('\nCOPY KEYS (' + keys.length + '):');
  keys.forEach((k) => console.log(' -', k));
}

const deviceKeys = [
  'preset_name',
  'tuning_name',
  'bridgeboard_tuning',
  'fingerboard_tuning',
  'fretless',
  'bridge_mode',
  'fingerboard_mode',
  'fret_pressure_message',
  'string_flip',
  'transpose_step',
  'arpeggiator',
  'sound_profile',
  'twelve_string',
  'hammer_on',
  'pulloff_open_string',
  'channel_mode',
  'strum_channel',
  'fret_channel',
  'bridge_decay_time',
  'hammerdown_resting_threshold',
  'hammerdown_active_threshold',
  'note_on_bezier',
  'sustain_bezier',
  'aftertouch_bezier',
  'hammerdown_old_bezier',
  'hammerdown_new_bezier',
  'pulloff_bezier',
];

const missing = deviceKeys.filter((k) => {
  if (k === 'fretless' || k === 'bridge_mode' || k === 'fingerboard_mode') return !chunk.includes(k);
  return !m[1].includes("'" + k + "'") && !chunk.includes(k + '=');
});
console.log('\nMissing from toDevice?', missing.length ? missing : 'none');

console.log('\nWindows IPC save:', b.includes("save-preset-to-instrument") ? 'OK' : 'MISSING');
console.log('Windows IPC load:', b.includes("load-presets-from-instrument") ? 'OK' : 'MISSING');
console.log('direct set slot:', chunk.includes('DIRECT set slot') || b.includes('DIRECT set slot') ? 'OK' : 'MISSING');
