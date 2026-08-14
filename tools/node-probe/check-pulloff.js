/** Check pulloff / release re-trigger on active presets. Close Editor first. */
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

  console.log('=== presets pulloff / hammer ===');
  for (let id = 1; id <= 8; id++) {
    const p = (await cmd('get', { preset: { id } })).data.preset;
    console.log(
      `#${id}`,
      p.preset_name,
      'pulloff=' + p.pulloff_open_string,
      'hammer=' + p.hammer_on,
      'fl=' + p.fretless,
      'fb=' + p.fingerboard_mode,
      'br=' + p.bridge_mode,
      'rest=' + p.hammerdown_resting_threshold,
      'active=' + p.hammerdown_active_threshold
    );
  }

  // Disable pulloff on all string presets (1,2,5 typically)
  for (const id of [1, 2, 5, 6]) {
    const p = (await cmd('get', { preset: { id } })).data.preset;
    if (!p) continue;
    if (p.fingerboard_mode !== 'string' && id !== 5) continue;
    const body = Object.assign({}, p, {
      id,
      pulloff_open_string: false,
      hammer_on: false,
    });
    console.log('set', id, p.preset_name, await cmd('set', { preset: body }));
    const v = (await cmd('get', { preset: { id } })).data.preset;
    console.log(' verify pulloff', v.pulloff_open_string, 'hammer', v.hammer_on);
  }

  await cmd('activate', { preset: { id: 5 } });
  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
