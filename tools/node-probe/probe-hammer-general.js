/**
 * Probe general settings + hammer_on on current ukulele-like preset.
 * Close Editor first.
 */
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
  async function cmd(c, data, wait = 4000) {
    const { bytes, mid } = encode(c, data);
    output.send(bytes);
    const t0 = Date.now();
    let best = null;
    while (Date.now() - t0 < wait) {
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

  console.log('identity', await cmd('get', { identity: {} }));

  // Try get general / settings / device
  for (const key of ['general', 'settings', 'device', 'config', 'globals', 'system']) {
    const r = await cmd('get', { [key]: {} });
    console.log('get', key, JSON.stringify(r).slice(0, 300));
  }

  // Read presets 5 and 6 hammer fields
  for (const id of [5, 6]) {
    const r = await cmd('get', { preset: { id } });
    const p = r && r.data && r.data.preset;
    if (p) {
      console.log('preset', id, {
        name: p.preset_name,
        hammer_on: p.hammer_on,
        pulloff: p.pulloff_open_string,
        rest: p.hammerdown_resting_threshold,
        active: p.hammerdown_active_threshold,
        fb: p.fingerboard_mode,
        fl: p.fretless,
        br: p.bridge_mode,
      });
    }
  }

  // Test: set hammer_on false on slot 6 and verify; also try lower thresholds for easier detection
  const got = await cmd('get', { preset: { id: 6 } });
  const p6 = got.data.preset;
  console.log('\n--- Test hammer_on false persist ---');
  let body = Object.assign({}, p6, { id: 6, hammer_on: false });
  console.log('set', await cmd('set', { preset: body }));
  let v = (await cmd('get', { preset: { id: 6 } })).data.preset;
  console.log('verify hammer_on', v.hammer_on);

  console.log('\n--- Test thresholds (more sensitive = lower active?) ---');
  // Try active=5, rest=30
  body = Object.assign({}, v, { id: 6, hammerdown_active_threshold: 5, hammerdown_resting_threshold: 30 });
  console.log('set low thresh', await cmd('set', { preset: body }));
  v = (await cmd('get', { preset: { id: 6 } })).data.preset;
  console.log('verify thresh', v.hammerdown_active_threshold, v.hammerdown_resting_threshold);

  // Try get method / technique
  for (const data of [{ method: {} }, { technique: {} }, { techniques: {} }, { behaviors: {} }]) {
    const r = await cmd('get', data);
    console.log('get', Object.keys(data)[0], JSON.stringify(r).slice(0, 250));
  }

  await cmd('activate', { preset: { id: 6 } });
  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
