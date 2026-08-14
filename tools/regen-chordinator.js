/** Regen Auto Chordinator bank with better octaves + push C/F/G/Am to device. Close Editor. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JZZ = require('./node-probe/node_modules/jzz');

// Re-use generators by evaluating the functions from auto-chordinator - simpler: spawn full script
// Instead inline minimal

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'auto-chordinator');

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
const QUALITY = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };

function voiceChord(rootPc, quality, octaveBase = 3, inversion = 0) {
  const iv = QUALITY[quality] || QUALITY.maj;
  const pool = [];
  for (let oct = octaveBase; oct <= octaveBase + 3; oct++) {
    for (const i of iv) pool.push(12 * oct + rootPc + i);
  }
  const start = inversion % iv.length;
  const ordered = [];
  for (let k = 0; k < 6; k++) ordered.push(pool[start + k] || pool[pool.length - 1]);
  for (let i = 1; i < ordered.length; i++) while (ordered[i] < ordered[i - 1]) ordered[i] += 12;
  return ordered.map((n) => Math.max(36, Math.min(96, n)));
}

function fingerboardSameChord(rootPc, quality) {
  const fb = new Array(72);
  for (let f = 0; f < 12; f++) {
    const v = voiceChord(rootPc, quality, 3 + Math.floor(f / 4), f % 3);
    for (let s = 0; s < 6; s++) fb[s * 12 + f] = v[s];
  }
  return fb;
}

function fingerboardProgression(rootPc, degrees) {
  const fb = new Array(72);
  for (let f = 0; f < 12; f++) {
    const deg = degrees[f % degrees.length];
    const v = voiceChord((rootPc + deg.d) % 12, deg.q, 3, f % 3);
    for (let s = 0; s < 6; s++) fb[s * 12 + f] = v[s];
  }
  return fb;
}

async function main() {
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outn = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
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

  const template = (await cmd('get', { preset: { id: 3 } })).data.preset;
  const bank = [];
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
  for (const [root, q] of chords) {
    const name = `AC ${root} ${q}`;
    const rootPc = NOTE[root];
    const preset = Object.assign({}, template, {
      preset_name: name,
      tuning_name: name,
      fingerboard_mode: 'keyboard',
      bridge_mode: 'press',
      fretless: false,
      hammer_on: false,
      pulloff_open_string: false,
      string_flip: 'always_right',
      sound_profile: 2,
      bridgeboard_tuning: voiceChord(rootPc, q, 3, 0),
      fingerboard_tuning: fingerboardSameChord(rootPc, q),
    });
    delete preset.id;
    bank.push(preset);
    fs.writeFileSync(path.join(outDir, `${root}_${q}.json`), JSON.stringify(preset, null, 2));
    console.log(name, 'col0', [0, 1, 2, 3, 4, 5].map((s) => preset.fingerboard_tuning[s * 12]));
  }
  for (const key of ['C', 'G', 'D', 'A', 'F']) {
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
    const name = `AC Key of ${key}`;
    const preset = Object.assign({}, template, {
      preset_name: name,
      tuning_name: name,
      fingerboard_mode: 'keyboard',
      bridge_mode: 'press',
      fretless: false,
      hammer_on: false,
      pulloff_open_string: false,
      string_flip: 'always_right',
      sound_profile: 2,
      bridgeboard_tuning: voiceChord(NOTE[key], 'maj', 3, 0),
      fingerboard_tuning: fingerboardProgression(NOTE[key], degrees),
    });
    delete preset.id;
    bank.push(preset);
    fs.writeFileSync(path.join(outDir, `key_${key}.json`), JSON.stringify(preset, null, 2));
  }
  fs.writeFileSync(path.join(outDir, 'bank.json'), JSON.stringify(bank, null, 2));

  for (const [id, file] of [
    [5, 'C_maj'],
    [6, 'F_maj'],
    [7, 'G_maj'],
    [8, 'A_min'],
  ]) {
    const preset = JSON.parse(fs.readFileSync(path.join(outDir, file + '.json'), 'utf8'));
    preset.id = id;
    await cmd('set', { preset });
    console.log('slot', id, preset.preset_name, 'OK');
  }
  await cmd('activate', { preset: { id: 5 } });

  // re-seed editor folder
  require('child_process').execSync('node "' + path.join(__dirname, 'seed-auto-chordinator-folder.js') + '"', {
    stdio: 'inherit',
  });

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
