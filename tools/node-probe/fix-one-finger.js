/** Rewrite User1 as One Finger Chords with keyboard mode (chord grid). */
const fs = require('fs');
const path = require('path');
const JZZ = require('jzz');

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function main() {
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outn = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const input = await midi.openMidiIn(inn);
  const output = await midi.openMidiOut(outn);
  let buf = [];
  const inbox = [];
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
    while (Date.now() - t0 < 4000) {
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

  const basePath = path.join(__dirname, '..', 'preset-dumps', 'preset-5.json');
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  // Also try keyboard variant of same tuning (chord grids use keyboard like Piano/Organism)
  const body = Object.assign({}, base, {
    id: 5,
    preset_name: 'One Finger Chords',
    tuning_name: 'Scaled Chords',
    fingerboard_mode: 'keyboard',
    bridge_mode: 'press',
    fretless: false,
    sound_profile: 2, // piano-like, closer to chord playing than guitar=0
  });
  console.log('Writing User1 keyboard/press...');
  console.log('set', await cmd('set', { preset: body }));
  console.log('activate', await cmd('activate', { preset: { id: 5 } }));
  const v = await cmd('get', { preset: { id: 5 } });
  const p = v && v.data && v.data.preset;
  console.log('VERIFY', p && p.preset_name, p && p.fingerboard_mode, p && p.bridge_mode, p && p.sound_profile, p && p.tuning_name);
  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
