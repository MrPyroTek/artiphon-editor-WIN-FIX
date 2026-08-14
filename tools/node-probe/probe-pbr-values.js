/** Probe which pitch_bend_range values firmware 1.0.23 accepts. Close Editor. */
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
  if (!inn) throw new Error('Close Editor, plug I1');
  const input = await midi.openMidiIn(inn);
  const output = await midi.openMidiOut(outn);
  let buf = [],
    inbox = [];
  // Capture raw sysex replies for general get
  const rawReplies = [];
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

  const g0 = await cmd('get', { general: {} });
  console.log('FULL general get:', JSON.stringify(g0.data && g0.data.general, null, 2));

  // Also try get with explicit fields
  for (const v of [2, 12, 24, 36, 48, 96]) {
    const setRes = await cmd('set', { general: { pitch_bend_range: v } });
    await sleep(50);
    const getRes = await cmd('get', { general: {} });
    const g = getRes && getRes.data && getRes.data.general;
    console.log(
      'value',
      v,
      setRes && setRes.error ? 'ERR ' + JSON.stringify(setRes.error) : 'SET_OK',
      'read_back',
      g && g.pitch_bend_range
    );
  }

  // Try alternate key names
  for (const patch of [
    { pitch_bend: 24 },
    { pitchbend_range: 24 },
    { pb_range: 24 },
    { bend_range: 24 },
  ]) {
    const r = await cmd('set', { general: patch });
    console.log('alt', JSON.stringify(patch), r && r.error ? r.error : 'OK');
  }

  // save after 12
  await cmd('set', { general: { pitch_bend_range: 12 } });
  await cmd('save', { general: true });
  console.log('left at 12 + saved');

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
