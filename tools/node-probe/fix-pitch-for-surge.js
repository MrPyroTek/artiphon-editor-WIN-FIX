/** Set mpe + pitch bend range correctly for Violin/FL/Surge. Close Editor. */
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

  const keys = [
    { mpe_mode: true },
    { mpe_mode: false },
    { pitch_bend_range: 48 },
    { pitch_bend_range: 12 },
    { pitch_bend_range: 24 },
    { string_bend: true },
    { string_bend: false },
    { string_bend_thresh: 20 },
  ];
  for (const patch of keys) {
    const r = await cmd('set', { general: patch });
    const g = (await cmd('get', { general: {} })).data.general;
    const k = Object.keys(patch)[0];
    console.log(
      'SET',
      JSON.stringify(patch),
      r.error ? 'ERR ' + JSON.stringify(r.error) : 'OK',
      'got',
      k,
      g[k],
      'mpe',
      g.mpe_mode
    );
  }

  // Final recommended for FL+Surge without native MPE: single channel + pbr 48
  // For Surge MPE attempt: multi + 48
  console.log('\n--- Apply FL-friendly: mpe_mode false (single), try pitch 48 ---');
  let r = await cmd('set', { general: { mpe_mode: false } });
  console.log('mpe false', r);
  r = await cmd('set', { general: { pitch_bend_range: 48 } });
  console.log('pbr 48', r);
  await cmd('save', { general: true });
  const g = (await cmd('get', { general: {} })).data.general;
  console.log('FINAL general keys with pitch/mpe/bend:', {
    mpe_mode: g.mpe_mode,
    pitch_bend_range: g.pitch_bend_range,
    string_bend: g.string_bend,
    all: Object.keys(g),
  });

  // Ensure violin active and fretless
  const v = (await cmd('get', { preset: { id: 2 } })).data.preset;
  await cmd('set', {
    preset: Object.assign({}, v, {
      id: 2,
      fingerboard_mode: 'string',
      bridge_mode: 'bow',
      fretless: true,
      hammer_on: false,
      pulloff_open_string: false,
      channel_mode: 'six_channel',
    }),
  });
  await cmd('activate', { preset: { id: 2 } });
  console.log('Violin active fretless=', (await cmd('get', { preset: { id: 2 } })).data.preset.fretless);

  // Monitor pitch bend for 8 seconds
  console.log('\nSlide on the neck now — listening for pitch bend 8s...');
  let pb = 0,
    notes = 0;
  const tEnd = Date.now() + 8000;
  const handler = (msg) => {
    const a = Array.from(msg);
    // channel voice: pitch bend E0-EF
    if (a.length >= 3 && a[0] >= 0xe0 && a[0] <= 0xef) {
      pb++;
      const val = a[1] | (a[2] << 7);
      console.log('PB ch', (a[0] & 0x0f) + 1, 'val', val);
    }
    if (a.length >= 3 && a[0] >= 0x90 && a[0] <= 0x9f && a[2] > 0) {
      notes++;
      console.log('NOTE ON ch', (a[0] & 0x0f) + 1, 'n', a[1], 'v', a[2]);
    }
  };
  input.connect(handler);
  while (Date.now() < tEnd) await sleep(50);
  console.log('Heard pitchbend msgs:', pb, 'noteons:', notes);

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
