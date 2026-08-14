/** Probe debounce + pulloff effect. Close Editor. */
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

  const g = (await cmd('get', { general: {} })).data.general;
  console.log('debounce fb/bb', g.fingerboard_debounce_time, g.bridgeboard_debounce_time);
  console.log('thresholds', g.fingerboard_press_threshold, g.fingerboard_release_threshold);

  // Increase debounce to reduce release re-triggers / chatter
  const g2 = Object.assign({}, g, {
    fingerboard_debounce_time: 35,
    bridgeboard_debounce_time: 35,
    // keep release clearly below press to avoid chatter
    fingerboard_press_threshold: Math.max(g.fingerboard_press_threshold || 2, 2),
    fingerboard_release_threshold: 0,
  });
  console.log('set', await cmd('set', { general: g2 }));
  console.log('save', await cmd('save', { general: true }));
  const g3 = (await cmd('get', { general: {} })).data.general;
  console.log('now debounce', g3.fingerboard_debounce_time, g3.bridgeboard_debounce_time);
  console.log('now thresh', g3.fingerboard_press_threshold, g3.fingerboard_release_threshold);

  // Ensure ukulele pulloff off + activate
  const p5 = (await cmd('get', { preset: { id: 5 } })).data.preset;
  await cmd('set', {
    preset: Object.assign({}, p5, { id: 5, pulloff_open_string: false, hammer_on: false }),
  });
  await cmd('activate', { preset: { id: 5 } });
  const v = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('Ukulele', v.preset_name, 'pulloff', v.pulloff_open_string, 'hammer', v.hammer_on);

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
