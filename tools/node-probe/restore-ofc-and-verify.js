/**
 * Restore One Finger Chords on slot 5 as keyboard/press (Windows firmware 1.0.23).
 * Also verify channel_mode one_channel + beziers format.
 * Close Editor first.
 */
const fs = require('fs');
const path = require('path');
const JZZ = require('jzz');

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, '..', 'preset-dumps');

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

  async function cmd(c, data, wait = 5000) {
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

  // Prefer original dump from all-presets (before corruption)
  const all = JSON.parse(fs.readFileSync(path.join(outDir, 'all-presets.json'), 'utf8'));
  const src = all['5'] || all[5];
  if (!src || !src.preset_name) throw new Error('no OFC backup in all-presets.json');

  const body = Object.assign({}, src, {
    id: 5,
    preset_name: 'One Finger Chords',
    tuning_name: src.tuning_name || 'Scaled Chords',
    fingerboard_mode: 'keyboard',
    bridge_mode: 'press',
    fretless: false,
    channel_mode: 'six_channel',
    fret_pressure_message: src.fret_pressure_message === 'none' ? 'none' : 'poly_press',
  });

  console.log('Writing OFC keyboard/press...');
  console.log('set', await cmd('set', { preset: body }));
  await sleep(100);
  console.log('activate', await cmd('activate', { preset: { id: 5 } }));
  await sleep(100);
  const v = await cmd('get', { preset: { id: 5 } });
  const p = v && v.data && v.data.preset;
  console.log('VERIFY', {
    name: p && p.preset_name,
    fb: p && p.fingerboard_mode,
    br: p && p.bridge_mode,
    fl: p && p.fretless,
    tune: p && p.tuning_name,
    ch: p && p.channel_mode,
    fpm: p && p.fret_pressure_message,
  });
  if (p) fs.writeFileSync(path.join(outDir, 'preset-5.json'), JSON.stringify(p, null, 2));

  // Quick channel_mode + bezier smoke on slot 8
  const s8 = (await cmd('get', { preset: { id: 8 } })).data.preset;
  const orig8 = Object.assign({}, s8);

  // one_channel
  let t = Object.assign({}, s8, { id: 8, preset_name: 'ChTest', channel_mode: 'one_channel' });
  await cmd('set', { preset: t });
  let g = (await cmd('get', { preset: { id: 8 } })).data.preset;
  console.log('channel one_channel', g.channel_mode === 'one_channel' ? 'OK' : 'FAIL', g.channel_mode);

  t = Object.assign({}, g, { id: 8, channel_mode: 'six_channel' });
  await cmd('set', { preset: t });
  g = (await cmd('get', { preset: { id: 8 } })).data.preset;
  console.log('channel six_channel', g.channel_mode === 'six_channel' ? 'OK' : 'FAIL', g.channel_mode);

  // bezier: flat 8-float array (cubic)
  const bez = [0, 0.2, 0.4, 0.6, 0.5, 0.8, 1, 1];
  t = Object.assign({}, g, { id: 8, note_on_bezier: bez, sustain_bezier: bez });
  const setBez = await cmd('set', { preset: t });
  g = (await cmd('get', { preset: { id: 8 } })).data.preset;
  const bezOk =
    JSON.stringify(g.note_on_bezier) === JSON.stringify(bez) &&
    JSON.stringify(g.sustain_bezier) === JSON.stringify(bez);
  console.log('bezier flat8', bezOk ? 'OK' : 'FAIL', setBez && setBez.error, g.note_on_bezier);

  // restore 8
  orig8.id = 8;
  await cmd('set', { preset: orig8 });
  await cmd('activate', { preset: { id: 5 } });

  const ofcOk = p && p.preset_name === 'One Finger Chords' && p.fingerboard_mode === 'keyboard' && p.bridge_mode === 'press';
  console.log('\nRESULT', ofcOk ? 'OFC_OK' : 'OFC_FAIL', 'bez', bezOk ? 'OK' : 'FAIL');

  input.close();
  output.close();
  process.exit(ofcOk && bezOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
