/** Test technique_settings + general save. Close Editor. */
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

  // Activate ukulele slot 5
  await cmd('activate', { preset: { id: 5 } });
  const before = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('before hammer', before.hammer_on, before.preset_name);

  // Try technique_settings like editor does
  const techOff = {
    mode: 'fretted_string',
    method: 'strum',
    behaviors: { hammer_on: false },
  };
  console.log('set technique_settings off', await cmd('set', { technique_settings: techOff }));
  await sleep(100);
  let after = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('after tech_settings hammer', after.hammer_on);

  // Direct preset hammer_on false
  console.log(
    'set preset hammer false',
    await cmd('set', {
      preset: Object.assign({}, after, { id: 5, hammer_on: false }),
    })
  );
  after = (await cmd('get', { preset: { id: 5 } })).data.preset;
  console.log('after preset set hammer', after.hammer_on);
  await cmd('activate', { preset: { id: 5 } });

  // get technique_settings?
  console.log('get technique_settings', JSON.stringify(await cmd('get', { technique_settings: {} })).slice(0, 400));

  // Test general save after partial
  const g = (await cmd('get', { general: {} })).data.general;
  console.log(
    'partial set fingerboard',
    await cmd('set', { general: { fingerboard_press_threshold: 2, fingerboard_release_threshold: 1 } })
  );
  console.log('save general', await cmd('save', { general: true }));
  const g2 = (await cmd('get', { general: {} })).data.general;
  console.log('fingerboard after save', g2.fingerboard_press_threshold, g2.fingerboard_release_threshold);

  // restore
  await cmd('set', { general: g });
  await cmd('save', { general: true });

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
