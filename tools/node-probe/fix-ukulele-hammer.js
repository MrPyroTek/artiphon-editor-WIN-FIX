/** Force Ukulele (#5) hammer_on=false and softer fingerboard thresholds. Close Editor. */
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
  if (!inn) throw new Error('device not found — close Editor');
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

  const p5 = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('before', p5.preset_name, 'hammer', p5.hammer_on, 'fl', p5.fretless);
  const body = Object.assign({}, p5, {
    id: 5,
    hammer_on: false,
    pulloff_open_string: false,
  });
  console.log('set', await cmd('set', { preset: body }));
  await cmd('activate', { preset: { id: 5 } });
  const v = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('VERIFY', v.preset_name, 'hammer', v.hammer_on, 'pulloff', v.pulloff_open_string);

  const g = (await cmd('get', { general: {} })).data.general;
  // More sensitive neck: press=2, release=1 (was 3/2). Don't go to 0 — can false-trigger.
  const g2 = Object.assign({}, g, {
    fingerboard_press_threshold: 2,
    fingerboard_release_threshold: 1,
    bridgeboard_press_threshold: 2,
    bridgeboard_release_threshold: 1,
  });
  console.log('set general', await cmd('set', { general: g2 }));
  console.log('save general', await cmd('save', { general: true }));
  const g3 = (await cmd('get', { general: {} })).data.general;
  console.log('thresholds fb', g3.fingerboard_press_threshold, g3.fingerboard_release_threshold);
  console.log('thresholds bb', g3.bridgeboard_press_threshold, g3.bridgeboard_release_threshold);

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
