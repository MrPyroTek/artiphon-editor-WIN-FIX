/** Dump MPE / pitch bend related settings. Close Editor first. */
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
  if (!inn) throw new Error('Close Editor + plug I1');
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
  console.log('GENERAL mpe/pitch keys:');
  Object.keys(g)
    .filter((k) => /mpe|pitch|bend|string_bend|channel/i.test(k) || true)
    .forEach((k) => {});
  console.log(JSON.stringify(g, null, 2));

  for (const id of [1, 2, 5]) {
    const p = (await cmd('get', { preset: { id } })).data.preset;
    console.log('\n#' + id, p.preset_name, {
      fb: p.fingerboard_mode,
      br: p.bridge_mode,
      fl: p.fretless,
      ch: p.channel_mode,
    });
  }

  // Try set pitch bend related if keys exist
  if ('pitch_bend_range' in g || 'mpe_mode' in g) {
    console.log('\npitch_bend_range', g.pitch_bend_range, 'mpe_mode', g.mpe_mode, 'string_bend', g.string_bend);
  }

  // Activate violin if present
  const p2 = (await cmd('get', { preset: { id: 2 } })).data.preset;
  if (p2 && /viol|fretless/i.test(p2.preset_name + p2.fingerboard_mode)) {
    await cmd('activate', { preset: { id: 2 } });
    console.log('activated #2', p2.preset_name);
  }

  // Ensure multi channel + pitch 48 for MPE test
  const g2 = Object.assign({}, g, {
    mpe_mode: true,
    pitch_bend_range: 48,
  });
  console.log('set mpe+48', await cmd('set', { general: g2 }));
  console.log('save', await cmd('save', { general: true }));
  const g3 = (await cmd('get', { general: {} })).data.general;
  console.log('NOW', {
    mpe: g3.mpe_mode,
    pbr: g3.pitch_bend_range,
    string_bend: g3.string_bend,
  });

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
