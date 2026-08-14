/**
 * Auto Chordinator v2 — OPEN STRING chords (what the user actually wants)
 *
 * Model: each preset = one chord. bridgeboard_tuning = 6 chord tones.
 * Mode string+pluck: strum the bridge → hear the chord. No fret-column hold.
 * Switch chords via User 1-4 presets / Program Change / editor folder.
 *
 * Close Editor first.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JZZ = require('./node-probe/node_modules/jzz');

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'auto-chordinator');
const userFile = path.join(
  process.env.APPDATA,
  'Artiphon INSTRUMENT 1 Editor',
  '1_1_0_users_presets.json'
);

function encode(cmd, data) {
  const mid = msgid++;
  const json = JSON.stringify({ cmd, msgid: mid, data });
  return { mid, bytes: TX.concat([...json].map((c) => c.charCodeAt(0))).concat([0xf7]) };
}
function decode(arr) {
  if (!arr || arr[0] !== 0xf0 || arr[arr.length - 1] !== 0xf7) return null;
  if (arr[1] !== 0 || arr[2] !== 2 || arr[3] !== 3) return null;
  const raw = String.fromCharCode(...arr.slice(4, -1));
  const i = raw.indexOf('{');
  try {
    return JSON.parse(raw.slice(i));
  } catch {
    return null;
  }
}

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, Bb: 10, B: 11 };
const QUALITY = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

/** Classic 6-string open voicing (low → high) */
function openVoicing(rootPc, quality) {
  const iv = QUALITY[quality] || QUALITY.maj;
  // Prefer guitar-like spread: root low, then chord tones ascending
  const pool = [];
  for (let oct = 2; oct <= 5; oct++) {
    for (const i of iv) pool.push(12 * oct + rootPc + i);
  }
  // Pick 6 notes starting near C2-C3 range
  const start = pool.findIndex((n) => n >= 36 + rootPc);
  const s = start < 0 ? 0 : start;
  const notes = [];
  for (let k = 0; k < 6; k++) {
    let n = pool[s + k] || pool[pool.length - 1];
    if (notes.length && n <= notes[notes.length - 1]) n += 12;
    notes.push(Math.max(36, Math.min(84, n)));
  }
  return notes;
}

/**
 * Fingerboard: every fret on every string stays ON the chord
 * (barre-friendly — fretting still chord tones, not chromatic).
 */
function chordFingerboard(openNotes) {
  const fb = new Array(72);
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < 12; f++) {
      // Same chord tone family: open + fret as scale degree steps within chord
      // Simple: open note + fret, then snap to nearest chord tone
      const raw = openNotes[s] + f;
      fb[s * 12 + f] = snapToChord(raw, openNotes);
    }
  }
  return fb;
}

function snapToChord(midi, openNotes) {
  const pcs = [...new Set(openNotes.map((n) => n % 12))];
  let best = midi;
  let bestD = 99;
  for (let d = -6; d <= 6; d++) {
    const cand = midi + d;
    if (pcs.includes(((cand % 12) + 12) % 12) && Math.abs(d) < bestD) {
      best = cand;
      bestD = Math.abs(d);
    }
  }
  return Math.max(24, Math.min(96, best));
}

function makeOpenChordPreset(name, rootName, quality, template) {
  const open = openVoicing(NOTE[rootName], quality);
  return Object.assign({}, template, {
    preset_name: name,
    tuning_name: name + ' (open strings)',
    fingerboard_mode: 'string',
    bridge_mode: 'pluck',
    fretless: false,
    hammer_on: false,
    pulloff_open_string: false,
    fret_pressure_message: 'none', // less release noise
    channel_mode: 'six_channel',
    string_flip: 'accel_flip',
    arpeggiator: false,
    twelve_string: false,
    transpose_step: 1,
    sound_profile: 0,
    bridgeboard_tuning: open,
    fingerboard_tuning: chordFingerboard(open),
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outn = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  if (!inn) throw new Error('Close Editor, plug INSTRUMENT1');

  const input = await midi.openMidiIn(inn);
  const output = await midi.openMidiOut(outn);
  let buf = [],
    inbox = [];
  input.connect((msg) => {
    for (const b of Array.from(msg)) {
      if (b === 0xf0) buf = [0xf0];
      else if (buf.length) {
        buf.push(b);
        if (b === 0xf7) {
          const o = decode(buf);
          buf = [];
          if (o) inbox.push(o);
        }
      }
    }
  });
  async function cmd(c, data) {
    const { bytes, mid } = encode(c, data);
    output.send(bytes);
    const t0 = Date.now();
    let best = null;
    while (Date.now() - t0 < 5000) {
      while (inbox.length) {
        const o = inbox.shift();
        if (o.msgid === mid) {
          if (o.data || o.error) return o;
          best = o;
        }
      }
      await sleep(12);
    }
    return best;
  }

  console.log('=== Auto Chordinator v2: open-string chords ===');
  console.log('Firmware cannot retune live from one fret "button".');
  console.log('Workaround: each chord = 1 preset. Strum open strings = chord.');
  console.log('Switch chord = change User preset (or MIDI Program Change).\n');

  const template = (await cmd('get', { preset: { id: 1 } })).data.preset;
  const chords = [
    ['C', 'maj'],
    ['C', 'min'],
    ['D', 'maj'],
    ['D', 'min'],
    ['E', 'maj'],
    ['E', 'min'],
    ['F', 'maj'],
    ['F', 'min'],
    ['G', 'maj'],
    ['G', 'min'],
    ['A', 'maj'],
    ['A', 'min'],
    ['Bb', 'maj'],
    ['B', 'min'],
  ];

  const bank = [];
  for (const [root, q] of chords) {
    const name = `AC ${root} ${q}`;
    const p = makeOpenChordPreset(name, root, q, template);
    delete p.id;
    bank.push(p);
    fs.writeFileSync(path.join(outDir, `${root}_${q}.json`), JSON.stringify(p, null, 2));
    console.log(name, 'open strings', p.bridgeboard_tuning.join(','));
  }
  fs.writeFileSync(path.join(outDir, 'bank.json'), JSON.stringify(bank, null, 2));

  // Device User 1-4: C F G Am — the "4 buttons"
  for (const [id, file, label] of [
    [5, 'C_maj', 'User1 = C maj button'],
    [6, 'F_maj', 'User2 = F maj button'],
    [7, 'G_maj', 'User3 = G maj button'],
    [8, 'A_min', 'User4 = Am button'],
  ]) {
    const p = JSON.parse(fs.readFileSync(path.join(outDir, file + '.json'), 'utf8'));
    p.id = id;
    await cmd('set', { preset: p });
    const v = (await cmd('get', { preset: { id } })).data.preset;
    console.log(label, '->', v.preset_name, v.bridgeboard_tuning, v.fingerboard_mode, v.bridge_mode);
  }
  await cmd('activate', { preset: { id: 5 } });

  // Editor folder
  function toEditor(p) {
    return {
      json_version: '1.0.1',
      preset_name: p.preset_name,
      tuning_name: p.tuning_name,
      mode: 'fretted_string',
      method: 'strum',
      fingerboard_tuning: p.fingerboard_tuning,
      bridgeboard_tuning: p.bridgeboard_tuning,
      fret_pressure_message: 'none',
      string_flip: p.string_flip || 'accel_flip',
      transpose_step: 1,
      arpeggiator: false,
      sound_profile: 0,
      twelve_string: false,
      hammer_on: false,
      pulloff_open_string: false,
      is_factory_preset: false,
      id: crypto.randomUUID(),
    };
  }

  let folders = [];
  if (fs.existsSync(userFile)) {
    folders = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    if (!Array.isArray(folders)) folders = [];
  }
  folders = folders.filter((f) => f.name !== 'Auto Chordinator');
  folders.push({
    name: 'Auto Chordinator',
    id: crypto.randomUUID(),
    collapsed: false,
    is_factory_preset: false,
    presets: bank.map(toEditor),
  });
  fs.writeFileSync(userFile, JSON.stringify(folders, null, 2));
  console.log('\nEditor folder updated:', folders[folders.length - 1].presets.length, 'presets');
  console.log('HOW TO PLAY:');
  console.log('  1. Select User1 (C) / User2 (F) / User3 (G) / User4 (Am)  ← these ARE your chord buttons');
  console.log('  2. Strum the bridge — do NOT hold a fret column');
  console.log('  3. All 6 open strings = that chord');

  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
