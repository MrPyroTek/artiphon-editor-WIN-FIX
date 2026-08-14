const JZZ = require('jzz');

const TX_PREFIX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;

function encode(cmd, data) {
  const mid = msgid++;
  const json = JSON.stringify({ cmd, msgid: mid, data });
  const bytes = TX_PREFIX.concat([...json].map((c) => c.charCodeAt(0))).concat([0xf7]);
  return { bytes, mid, json };
}

function decodeComplete(arr) {
  if (!arr || arr[0] !== 0xf0 || arr[arr.length - 1] !== 0xf7) return null;
  if (arr[1] !== 0 || arr[2] !== 2 || arr[3] !== 3) return null;
  const raw = String.fromCharCode(...arr.slice(4, -1));
  const i = raw.indexOf('{');
  if (i < 0) return null;
  try {
    return JSON.parse(raw.slice(i));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const midi = await JZZ();
  const infos = midi.info();
  console.log('inputs', infos.inputs.map((p) => p.name));
  console.log('outputs', infos.outputs.map((p) => p.name));

  const inName = infos.inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outNames = infos.outputs.map((p) => p.name).filter((n) => /INSTRUMENT/i.test(n));
  if (!inName || !outNames.length) throw new Error('INSTRUMENT1 not found');

  const input = await midi.openMidiIn(inName);
  let output = null;
  let workingOut = null;
  let sysexBuf = [];
  const inbox = [];

  input.connect((msg) => {
    const arr = Array.from(msg);
    for (const b of arr) {
      if (b === 0xf0) sysexBuf = [0xf0];
      else if (sysexBuf.length) {
        sysexBuf.push(b);
        if (b === 0xf7) {
          const complete = sysexBuf.slice();
          sysexBuf = [];
          const obj = decodeComplete(complete);
          if (obj) {
            console.log('<<', JSON.stringify(obj).slice(0, 260), 'bytes', complete.length);
            inbox.push(obj);
          } else {
            console.log('<< undecoded sysex', complete.length, complete.slice(0, 14));
          }
        }
      }
    }
  });

  async function waitMsgid(mid, ms = 5000) {
    const t0 = Date.now();
    let best = null;
    while (Date.now() - t0 < ms) {
      while (inbox.length) {
        const o = inbox.shift();
        if (o.msgid === mid) {
          if (o.data || o.error) return o;
          best = o;
        }
      }
      await sleep(15);
    }
    return best;
  }

  async function cmd(c, data) {
    const { bytes, mid, json } = encode(c, data);
    console.log('>>', c, 'msgid', mid, 'bytes', bytes.length, json.slice(0, 120));
    output.send(bytes);
    await sleep(120);
    return waitMsgid(mid);
  }

  for (const name of outNames) {
    console.log('try out', name);
    output = await midi.openMidiOut(name);
    const ident = await cmd('get', { identity: {} });
    if (ident && ident.data && ident.data.identity) {
      workingOut = name;
      console.log('WORKING', name, ident.data.identity.firmware_version);
      break;
    }
    output.close();
    output = null;
  }
  if (!output) throw new Error('no working out');

  console.log('\n=== presets 1..8 ===');
  for (let id = 1; id <= 8; id++) {
    const r = await cmd('get', { preset: { id } });
    const p = r && r.data && r.data.preset;
    if (p) {
      console.log(
        `slot ${id}: ${p.preset_name} | fb=${p.fingerboard_mode} br=${p.bridge_mode} | ${p.tuning_name} | sound=${p.sound_profile}`
      );
    } else {
      console.log(`slot ${id}: FAIL`, r);
    }
  }

  console.log('\n=== rewrite User1 with pad (like factory Grid Guitar) ===');
  const u1 = await cmd('get', { preset: { id: 5 } });
  const base = (u1 && u1.data && u1.data.preset) || {};
  console.log('before', base.preset_name, base.fingerboard_mode, base.tuning_name, base.bridgeboard_tuning);

  const body = Object.assign({}, base, {
    id: 'edit_buffer',
    preset_name: 'One Finger Chords',
    tuning_name: 'Scaled Chords',
    fingerboard_mode: 'pad',
    bridge_mode: 'press',
    fretless: false,
    bridgeboard_tuning: [48, 50, 52, 53, 55, 57],
    fingerboard_tuning: [
      48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 60, 62, 64, 65, 67, 69,
      71, 72, 74, 76, 77, 79, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89,
      91, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95, 96,
    ],
  });
  console.log('set', await cmd('set', { preset: body }));
  console.log('save', await cmd('save', { preset: { id: 5 } }));
  console.log('activate', await cmd('activate', { preset: { id: 5 } }));
  const verify = await cmd('get', { preset: { id: 5 } });
  const vp = verify && verify.data && verify.data.preset;
  console.log(
    'VERIFY',
    vp && {
      name: vp.preset_name,
      fb: vp.fingerboard_mode,
      br: vp.bridge_mode,
      tune: vp.tuning_name,
      bridge: vp.bridgeboard_tuning,
      fb0: (vp.fingerboard_tuning || []).slice(0, 12),
    }
  );

  input.close();
  output.close();
  console.log('DONE via', workingOut);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
