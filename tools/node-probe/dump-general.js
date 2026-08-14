/** Dump full general settings + fix ukulele hammer_on on device. Close Editor. */
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

  const g = await cmd('get', { general: {} });
  console.log('GENERAL FULL', JSON.stringify(g.data.general, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'preset-dumps', 'general.json'), JSON.stringify(g.data.general, null, 2));

  // Probe lowering fingerboard press threshold further (already 3)
  const gen = Object.assign({}, g.data.general);
  // try set more sensitive fingerboard (press=1)
  const setLow = await cmd('set', {
    general: Object.assign({}, gen, {
      fingerboard_press_threshold: 1,
      fingerboard_release_threshold: 0,
    }),
  });
  console.log('set fingerboard low', setLow);
  const g2 = await cmd('get', { general: {} });
  console.log('fingerboard now', g2.data.general.fingerboard_press_threshold, g2.data.general.fingerboard_release_threshold);

  // restore original thresholds
  await cmd('set', { general: gen });
  console.log('restored general thresholds');

  // Fix all user slots: dump 1-8 hammer status
  for (let id = 1; id <= 8; id++) {
    const r = await cmd('get', { preset: { id } });
    const p = r.data && r.data.preset;
    if (p)
      console.log(
        `#${id}`,
        p.preset_name,
        'hammer=' + p.hammer_on,
        'fb=' + p.fingerboard_mode,
        'fl=' + p.fretless,
        'br=' + p.bridge_mode
      );
  }

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
