/**
 * 1) Kill release re-trigger (pulloff/hammer/debounce) on device
 * 2) Build Auto Chordinator chord presets and write to user slots + JSON bank
 * Close Artiphon Editor first.
 */
const fs = require('fs');
const path = require('path');
const JZZ = require('jzz');

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, '..', 'auto-chordinator');

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

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUALITY = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

/** 6-note guitar-ish voicing for a chord */
function voiceChord(rootPc, quality, octaveBase = 3, inversion = 0) {
  const iv = QUALITY[quality] || QUALITY.maj;
  // Build pool of chord tones across octaves
  const pool = [];
  for (let oct = octaveBase; oct <= octaveBase + 3; oct++) {
    for (const i of iv) pool.push(12 * oct + rootPc + i);
  }
  // Rotate for inversion
  const start = inversion % iv.length;
  const ordered = [];
  for (let k = 0; k < 6; k++) {
    ordered.push(pool[start + k] || pool[pool.length - 1]);
  }
  // Keep ascending
  for (let i = 1; i < ordered.length; i++) {
    while (ordered[i] < ordered[i - 1]) ordered[i] += 12;
  }
  return ordered.map((n) => Math.max(24, Math.min(96, n)));
}

/** All 12 fret columns = voicings of same chord (inversions / rising octaves) */
function fingerboardSameChord(rootPc, quality) {
  const fb = new Array(72);
  for (let f = 0; f < 12; f++) {
    const inv = f % 3;
    const oct = 3 + Math.floor(f / 4); // ~C3 and up, rises gently
    const v = voiceChord(rootPc, quality, oct, inv);
    for (let s = 0; s < 6; s++) fb[s * 12 + f] = v[s];
  }
  return fb;
}

/** Key-of progression across 12 frets (columns) */
function fingerboardProgression(rootPc, degrees) {
  // degrees: [{q:'maj', d:0}, {q:'min', d:2}, ...]
  const fb = new Array(72);
  for (let f = 0; f < 12; f++) {
    const deg = degrees[f % degrees.length];
    const pc = (rootPc + deg.d) % 12;
    const v = voiceChord(pc, deg.q, 3, f % 3);
    for (let s = 0; s < 6; s++) fb[s * 12 + f] = v[s];
  }
  return fb;
}

function makeChordPreset(name, rootName, quality, baseTemplate) {
  const rootPc = NOTE[rootName];
  const fb = fingerboardSameChord(rootPc, quality);
  const bridge = voiceChord(rootPc, quality, 3, 0);
  return Object.assign({}, baseTemplate, {
    preset_name: name,
    tuning_name: name,
    fingerboard_mode: 'keyboard',
    bridge_mode: 'press',
    fretless: false,
    hammer_on: false,
    pulloff_open_string: false,
    fret_pressure_message: 'poly_press',
    channel_mode: 'six_channel',
    string_flip: 'always_right',
    arpeggiator: false,
    twelve_string: false,
    transpose_step: 1,
    sound_profile: 2,
    bridgeboard_tuning: bridge,
    fingerboard_tuning: fb,
  });
}

function makeKeyPreset(name, rootName, baseTemplate) {
  const rootPc = NOTE[rootName];
  // I ii iii IV V vi vii° I IV V vi I V
  const degrees = [
    { d: 0, q: 'maj' },
    { d: 2, q: 'min' },
    { d: 4, q: 'min' },
    { d: 5, q: 'maj' },
    { d: 7, q: 'maj' },
    { d: 9, q: 'min' },
    { d: 11, q: 'dim' },
    { d: 0, q: 'maj' },
    { d: 5, q: 'maj' },
    { d: 7, q: 'maj' },
    { d: 9, q: 'min' },
    { d: 0, q: 'maj' },
  ];
  const fb = fingerboardProgression(rootPc, degrees);
  const bridge = voiceChord(rootPc, 'maj', 3, 0);
  return Object.assign({}, baseTemplate, {
    preset_name: name,
    tuning_name: name + ' (I ii iii IV V vi…)',
    fingerboard_mode: 'keyboard',
    bridge_mode: 'press',
    fretless: false,
    hammer_on: false,
    pulloff_open_string: false,
    fret_pressure_message: 'poly_press',
    channel_mode: 'six_channel',
    string_flip: 'always_right',
    arpeggiator: false,
    twelve_string: false,
    transpose_step: 1,
    sound_profile: 2,
    bridgeboard_tuning: bridge,
    fingerboard_tuning: fb,
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outn = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  if (!inn || !outn) throw new Error('INSTRUMENT1 not found — close Editor');

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

  // ===== FIX RELEASE RETRIGGER =====
  console.log('=== Fix release re-trigger ===');
  const g = (await cmd('get', { general: {} })).data.general;
  const g2 = Object.assign({}, g, {
    fingerboard_debounce_time: 50,
    bridgeboard_debounce_time: 45,
    fingerboard_press_threshold: Math.max(g.fingerboard_press_threshold || 3, 3),
    fingerboard_release_threshold: 0,
    bridgeboard_press_threshold: Math.max(g.bridgeboard_press_threshold || 3, 3),
    bridgeboard_release_threshold: 0,
  });
  console.log('set general', await cmd('set', { general: g2 }));
  console.log('save general', await cmd('save', { general: true }));

  for (let id = 1; id <= 8; id++) {
    const p = (await cmd('get', { preset: { id } })).data.preset;
    if (!p) continue;
    const body = Object.assign({}, p, {
      id,
      pulloff_open_string: false,
      hammer_on: false,
    });
    await cmd('set', { preset: body });
    const v = (await cmd('get', { preset: { id } })).data.preset;
    console.log('#' + id, v.preset_name, 'pulloff', v.pulloff_open_string, 'hammer', v.hammer_on);
  }

  // ===== BUILD AUTO CHORDINATOR =====
  console.log('\n=== Build Auto Chordinator presets ===');
  const template = (await cmd('get', { preset: { id: 3 } })).data.preset; // Piano-like base
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
    const preset = makeChordPreset(name, root, q, template);
    delete preset.id;
    bank.push(preset);
    fs.writeFileSync(path.join(outDir, `${root}_${q}.json`), JSON.stringify(preset, null, 2));
    console.log('wrote', name, 'col0', [0, 1, 2, 3, 4, 5].map((s) => preset.fingerboard_tuning[s * 12]));
  }

  for (const key of ['C', 'G', 'D', 'A', 'F']) {
    const name = `AC Key of ${key}`;
    const preset = makeKeyPreset(name, key, template);
    delete preset.id;
    bank.push(preset);
    fs.writeFileSync(path.join(outDir, `key_${key}.json`), JSON.stringify(preset, null, 2));
    console.log('wrote', name);
  }

  fs.writeFileSync(path.join(outDir, 'bank.json'), JSON.stringify(bank, null, 2));
  console.log('bank size', bank.length, '->', outDir);

  // Write 4 useful ones to User slots 5-8 on device
  const toDevice = [
    { id: 5, file: 'C_maj' },
    { id: 6, file: 'F_maj' },
    { id: 7, file: 'G_maj' },
    { id: 8, file: 'A_min' },
  ];
  for (const t of toDevice) {
    const preset = JSON.parse(fs.readFileSync(path.join(outDir, t.file + '.json'), 'utf8'));
    preset.id = t.id;
    console.log('device set', t.id, preset.preset_name, await cmd('set', { preset }));
    const v = (await cmd('get', { preset: { id: t.id } })).data.preset;
    console.log(' verify', v.preset_name, v.fingerboard_mode, v.bridge_mode, 'pulloff', v.pulloff_open_string);
  }

  await cmd('activate', { preset: { id: 5 } });
  console.log('\nActive: AC C maj on User1 (slot 5). Press one fret zone, strum/press bridge — all strings = C major.');
  console.log('How to use: keyboard+press mode — each fret COLUMN is a voicing. For single-chord presets every column is that chord.');

  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
