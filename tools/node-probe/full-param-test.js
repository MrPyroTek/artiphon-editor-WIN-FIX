/**
 * Full firmware accept/reject matrix for INSTRUMENT 1 (1.0.23).
 * Close Artiphon Editor first. Uses slot 8 as scratch, restores after.
 */
const fs = require('fs');
const path = require('path');
const JZZ = require('jzz');

const TX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const outDir = path.join(__dirname, '..', 'preset-dumps');
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
  fs.mkdirSync(outDir, { recursive: true });
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outn = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  if (!inn || !outn) throw new Error('INSTRUMENT1 not found — close Editor, plug USB');

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

  const ident = await cmd('get', { identity: {} });
  const fw = ident && ident.data && ident.data.identity && ident.data.identity.firmware_version;
  console.log('FW', fw);

  const scratchId = 8;
  const origRes = await cmd('get', { preset: { id: scratchId } });
  const original = origRes && origRes.data && origRes.data.preset;
  if (!original) throw new Error('cannot read slot 8');

  let base = Object.assign({}, original, {
    id: scratchId,
    preset_name: 'FullTest',
    fingerboard_mode: 'string',
    bridge_mode: 'pluck',
    fretless: false,
    channel_mode: 'six_channel',
    fret_pressure_message: 'poly_press',
  });
  await cmd('set', { preset: base });
  await sleep(100);

  const results = { fw, modes: [], params: [], beziers: [], enums: [], editorMaps: [] };

  // --- MODES ---
  console.log('\n=== MODES ===');
  const FB = ['string', 'keyboard', 'pad'];
  const BR = ['pluck', 'press', 'bow', 'slide'];
  for (const fb of FB) {
    for (const br of BR) {
      for (const fretless of fb === 'string' ? [false, true] : [false]) {
        const body = Object.assign({}, base, {
          id: scratchId,
          preset_name: `M_${fb}_${br}${fretless ? '_fl' : ''}`.slice(0, 20),
          fingerboard_mode: fb,
          bridge_mode: br,
          fretless,
        });
        const setRes = await cmd('set', { preset: body });
        await sleep(60);
        const getRes = await cmd('get', { preset: { id: scratchId } });
        const p = getRes && getRes.data && getRes.data.preset;
        const ok =
          !!(setRes && !setRes.error) &&
          p &&
          p.fingerboard_mode === fb &&
          p.bridge_mode === br &&
          !!p.fretless === !!fretless;
        results.modes.push({ fb, br, fretless, ok, err: setRes && setRes.error });
        console.log(`${ok ? 'OK' : 'FAIL'} ${fb}/${br}/fl=${fretless}`);
        if (ok) base = Object.assign({}, p, { id: scratchId });
      }
    }
  }

  // reset base for params
  base = Object.assign({}, original, {
    id: scratchId,
    preset_name: 'ParamTest',
    fingerboard_mode: 'string',
    bridge_mode: 'pluck',
    fretless: false,
  });
  await cmd('set', { preset: base });
  await sleep(80);
  let cur = (await cmd('get', { preset: { id: scratchId } })).data.preset;

  const paramPatches = [
    { tuning_name: 'FullProbeTune' },
    { bridgeboard_tuning: [40, 45, 50, 55, 59, 64] },
    { fingerboard_tuning: Array.from({ length: 72 }, (_, i) => 36 + (i % 24)) },
    { string_flip: 'always_left' },
    { string_flip: 'always_right' },
    { string_flip: 'accel_flip' },
    { transpose_step: 0 },
    { transpose_step: 3 },
    { arpeggiator: true },
    { arpeggiator: false },
    { sound_profile: 0 },
    { sound_profile: 5 },
    { sound_profile: 12 },
    { twelve_string: true },
    { twelve_string: false },
    { hammer_on: false },
    { hammer_on: true },
    { pulloff_open_string: false },
    { pulloff_open_string: true },
    { channel_mode: 'six_channel' },
    { channel_mode: 'single_channel' }, // expect reject
    { channel_mode: 'one_channel' },
    { channel_mode: 'mono' },
    { fret_pressure_message: 'poly_press' },
    { fret_pressure_message: 'none' },
    { fret_pressure_message: 'channel_press' }, // expect ignore
    { fret_pressure_message: 'aftertouch' },
    { bridge_decay_time: 500 },
    { bridge_decay_time: 2000 },
    { hammerdown_resting_threshold: 10 },
    { hammerdown_resting_threshold: 80 },
    { hammerdown_active_threshold: 5 },
    { hammerdown_active_threshold: 60 },
    { strum_channel: 0 },
    { strum_channel: 5 },
    { fret_channel: 0 },
    { fret_channel: 5 },
  ];

  console.log('\n=== PARAMS ===');
  for (const patch of paramPatches) {
    const key = Object.keys(patch)[0];
    const body = Object.assign({}, cur, patch, { id: scratchId, preset_name: 'ParamTest' });
    const setRes = await cmd('set', { preset: body });
    await sleep(50);
    const getRes = await cmd('get', { preset: { id: scratchId } });
    const p = getRes && getRes.data && getRes.data.preset;
    const got = p ? p[key] : undefined;
    const want = patch[key];
    const setOk = !!(setRes && !setRes.error);
    const same = JSON.stringify(got) === JSON.stringify(want);
    results.params.push({ key, want, got, setOk, same, err: setRes && setRes.error });
    console.log(
      `${setOk && same ? 'OK' : setOk ? 'IGN' : 'ERR'} ${key}=${JSON.stringify(want)} -> ${JSON.stringify(got)}`
    );
    if (setOk && p) cur = Object.assign({}, p, { id: scratchId });
  }

  // --- BEZIERS ---
  console.log('\n=== BEZIERS ===');
  const bezKeys = [
    'note_on_bezier',
    'sustain_bezier',
    'aftertouch_bezier',
    'hammerdown_old_bezier',
    'hammerdown_new_bezier',
    'pulloff_bezier',
  ];
  const sampleBez = [
    [0, 0],
    [32, 40],
    [64, 90],
    [96, 110],
    [127, 127],
  ];
  for (const key of bezKeys) {
    const body = Object.assign({}, cur, { id: scratchId, preset_name: 'BezTest', [key]: sampleBez });
    const setRes = await cmd('set', { preset: body });
    await sleep(60);
    const getRes = await cmd('get', { preset: { id: scratchId } });
    const p = getRes && getRes.data && getRes.data.preset;
    const got = p && p[key];
    const same = JSON.stringify(got) === JSON.stringify(sampleBez);
    results.beziers.push({ key, setOk: !!(setRes && !setRes.error), same, err: setRes && setRes.error });
    console.log(`${same ? 'OK' : 'FAIL'} ${key}`);
    if (setRes && !setRes.error && p) cur = Object.assign({}, p, { id: scratchId });
  }

  // --- EDITOR MAPS (what Save should produce) ---
  console.log('\n=== EDITOR MAPS ===');
  const maps = [
    { name: 'fretted/strum', fb: 'string', br: 'pluck', fl: false },
    { name: 'fretted/press', fb: 'string', br: 'press', fl: false },
    { name: 'fretted/bow', fb: 'string', br: 'bow', fl: false },
    { name: 'fretted/slide', fb: 'string', br: 'slide', fl: false },
    { name: 'fretless/strum', fb: 'string', br: 'pluck', fl: true },
    { name: 'fretless/press', fb: 'string', br: 'press', fl: true },
    { name: 'fretless/bow', fb: 'string', br: 'bow', fl: true },
    { name: 'fretless/slide', fb: 'string', br: 'slide', fl: true },
    { name: 'grid/press=keyboard', fb: 'keyboard', br: 'press', fl: false },
    { name: 'pad/press', fb: 'pad', br: 'press', fl: false },
    { name: 'pad/strum=pluck', fb: 'pad', br: 'pluck', fl: false },
    { name: 'pad/bow', fb: 'pad', br: 'bow', fl: false },
    { name: 'pad/slide', fb: 'pad', br: 'slide', fl: false },
  ];
  for (const m of maps) {
    const body = Object.assign({}, original, {
      id: scratchId,
      preset_name: m.name.replace(/\W+/g, '_').slice(0, 20),
      fingerboard_mode: m.fb,
      bridge_mode: m.br,
      fretless: m.fl,
      channel_mode: 'six_channel',
      fret_pressure_message: 'poly_press',
    });
    const setRes = await cmd('set', { preset: body });
    await sleep(60);
    const getRes = await cmd('get', { preset: { id: scratchId } });
    const p = getRes && getRes.data && getRes.data.preset;
    const ok =
      !!(setRes && !setRes.error) &&
      p &&
      p.fingerboard_mode === m.fb &&
      p.bridge_mode === m.br &&
      !!p.fretless === !!m.fl;
    results.editorMaps.push({ name: m.name, ok, got: p && [p.fingerboard_mode, p.bridge_mode, p.fretless] });
    console.log(`${ok ? 'OK' : 'FAIL'} ${m.name}`);
  }

  // --- Fix One Finger Chords on slot 5 ---
  console.log('\n=== FIX One Finger Chords (slot 5 -> keyboard/press) ===');
  const ofcRes = await cmd('get', { preset: { id: 5 } });
  const ofc = ofcRes && ofcRes.data && ofcRes.data.preset;
  if (ofc) {
    const fixed = Object.assign({}, ofc, {
      id: 5,
      fingerboard_mode: 'keyboard',
      bridge_mode: 'press',
      fretless: false,
      channel_mode: 'six_channel',
    });
    const setRes = await cmd('set', { preset: fixed });
    await cmd('activate', { preset: { id: 5 } });
    const v = await cmd('get', { preset: { id: 5 } });
    const p = v && v.data && v.data.preset;
    console.log(
      'OFC',
      setRes && !setRes.error ? 'SET_OK' : 'SET_FAIL',
      p && p.fingerboard_mode,
      p && p.bridge_mode,
      p && p.preset_name
    );
    results.ofc = {
      ok: p && p.fingerboard_mode === 'keyboard' && p.bridge_mode === 'press',
      fb: p && p.fingerboard_mode,
      br: p && p.bridge_mode,
    };
    fs.writeFileSync(path.join(outDir, 'preset-5.json'), JSON.stringify(p, null, 2));
  }

  // restore slot 8
  original.id = scratchId;
  await cmd('set', { preset: original });
  await cmd('activate', { preset: { id: 5 } });

  // summary
  const modeOk = results.modes.filter((r) => r.ok).length;
  const paramOk = results.params.filter((r) => r.setOk && r.same).length;
  const paramIgn = results.params.filter((r) => r.setOk && !r.same).length;
  const paramErr = results.params.filter((r) => !r.setOk).length;
  const bezOk = results.beziers.filter((r) => r.same).length;
  const mapOk = results.editorMaps.filter((r) => r.ok).length;

  console.log('\n========== SUMMARY ==========');
  console.log(`modes: ${modeOk}/${results.modes.length}`);
  console.log(`params OK: ${paramOk}  ignored: ${paramIgn}  error: ${paramErr}  (total ${results.params.length})`);
  console.log(`beziers: ${bezOk}/${results.beziers.length}`);
  console.log(`editorMaps: ${mapOk}/${results.editorMaps.length}`);
  console.log('OFC', results.ofc);
  console.log('Rejected/ignored params:');
  results.params
    .filter((r) => !(r.setOk && r.same))
    .forEach((r) => console.log(' -', r.key, JSON.stringify(r.want), '->', JSON.stringify(r.got), r.err || ''));

  fs.writeFileSync(path.join(outDir, 'full-test-results.json'), JSON.stringify(results, null, 2));
  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
