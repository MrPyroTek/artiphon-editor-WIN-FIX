const JZZ = require('jzz');

const TX_PREFIX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
function encode(cmd, data) {
  const mid = msgid++;
  const json = JSON.stringify({ cmd, msgid: mid, data });
  return {
    mid,
    bytes: TX_PREFIX.concat([...json].map((c) => c.charCodeAt(0))).concat([0xf7]),
  };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const midi = await JZZ();
  const inName = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outName = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const input = await midi.openMidiIn(inName);
  const output = await midi.openMidiOut(outName);
  let buf = [];
  const inbox = [];
  input.connect((msg) => {
    for (const b of Array.from(msg)) {
      if (b === 0xf0) buf = [0xf0];
      else if (buf.length) {
        buf.push(b);
        if (b === 0xf7) {
          const o = decodeComplete(buf);
          buf = [];
          if (o) inbox.push(o);
        }
      }
    }
  });

  async function cmd(c, data, wait = 5000) {
    const { bytes, mid } = encode(c, data);
    console.log('>>', c, JSON.stringify(data).slice(0, 140));
    output.send(bytes);
    const t0 = Date.now();
    let best = null;
    while (Date.now() - t0 < wait) {
      while (inbox.length) {
        const o = inbox.shift();
        console.log('<<', JSON.stringify(o).slice(0, 200));
        if (o.msgid === mid) {
          if (o.data || o.error) return o;
          best = o;
        }
      }
      await sleep(15);
    }
    return best;
  }

  const get5 = async () => {
    const r = await cmd('get', { preset: { id: 5 } });
    const p = r && r.data && r.data.preset;
    console.log('USER1=', p && p.preset_name, p && p.tuning_name, p && p.fingerboard_mode, p && p.bridgeboard_tuning);
    return p;
  };

  console.log('\nA) baseline');
  let p = await get5();

  const patch = Object.assign({}, p, {
    id: 'edit_buffer',
    preset_name: 'ProbeSaveA',
    tuning_name: 'Scaled Chords',
    bridgeboard_tuning: [48, 50, 52, 53, 55, 57],
    fingerboard_mode: 'pad',
    bridge_mode: 'press',
  });

  console.log('\nB) set edit_buffer + delay + save');
  console.log(await cmd('set', { preset: patch }));
  await sleep(500);
  console.log(await cmd('save', { preset: { id: 5 } }));
  await sleep(300);
  await get5();

  console.log('\nC) set directly id:5');
  const direct = Object.assign({}, patch, { id: 5, preset_name: 'ProbeSaveC' });
  console.log(await cmd('set', { preset: direct }));
  await sleep(300);
  await get5();

  console.log('\nD) set edit_buffer then save with full preset object');
  patch.preset_name = 'ProbeSaveD';
  patch.id = 'edit_buffer';
  console.log(await cmd('set', { preset: patch }));
  await sleep(300);
  console.log(await cmd('save', { preset: Object.assign({}, patch, { id: 5 }) }));
  await sleep(300);
  await get5();

  console.log('\nE) activate / save variants');
  console.log(await cmd('save', { preset: 5 }));
  console.log(await cmd('save', { id: 5 }));
  console.log(await cmd('set', { preset: Object.assign({}, patch, { id: 5, preset_name: 'ProbeSaveE' }) }));
  console.log(await cmd('save', true));
  await sleep(300);
  await get5();

  input.close();
  output.close();
  console.log('DONE');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
