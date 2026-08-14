/**
 * Dump installed presets + probe all mode/parameter combos on INSTRUMENT 1.
 * Close the Artiphon Editor before running.
 */
const fs = require('fs');
const path = require('path');
const JZZ = require('jzz');

const TX_PREFIX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const outDir = path.join(__dirname, '..', 'preset-dumps');

function encode(cmd, data) {
  const mid = msgid++;
  const json = JSON.stringify({ cmd, msgid: mid, data });
  return {
    mid,
    bytes: TX_PREFIX.concat([...json].map((c) => c.charCodeAt(0))).concat([0xf7]),
    json,
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
  fs.mkdirSync(outDir, { recursive: true });
  const midi = await JZZ();
  const inName = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  const outName = midi.info().outputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  if (!inName || !outName) throw new Error('INSTRUMENT1 not found — close Editor, plug device');

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
  console.log('FW', ident && ident.data && ident.data.identity && ident.data.identity.firmware_version);
  fs.writeFileSync(path.join(outDir, 'identity.json'), JSON.stringify(ident, null, 2));

  console.log('\n=== DUMP presets 1..8 ===');
  const dump = {};
  for (let id = 1; id <= 8; id++) {
    const r = await cmd('get', { preset: { id } });
    const p = r && r.data && r.data.preset;
    dump[id] = p || r;
    if (p) {
      console.log(
        `#${id} ${p.preset_name} | fb=${p.fingerboard_mode} fretless=${p.fretless} br=${p.bridge_mode} | ${p.tuning_name} sound=${p.sound_profile}`
      );
      fs.writeFileSync(path.join(outDir, `preset-${id}.json`), JSON.stringify(p, null, 2));
    } else {
      console.log(`#${id} FAIL`, r);
    }
  }
  fs.writeFileSync(path.join(outDir, 'all-presets.json'), JSON.stringify(dump, null, 2));

  // Use slot 8 as scratch (user slot) — restore later
  const scratchId = 8;
  const original = dump[scratchId];
  if (!original || !original.preset_name) throw new Error('no scratch preset');

  const base = Object.assign({}, original);
  const FB = ['string', 'keyboard', 'pad'];
  const BR = ['pluck', 'press', 'bow', 'slide'];
  const FRETLESS = [false, true];

  console.log('\n=== MODE MATRIX (set direct id=' + scratchId + ') ===');
  const matrix = [];
  for (const fb of FB) {
    for (const br of BR) {
      for (const fretless of FRETLESS) {
        // fretless only meaningful for string
        if (fretless && fb !== 'string') continue;
        const body = Object.assign({}, base, {
          id: scratchId,
          preset_name: `T_${fb}_${br}${fretless ? '_fl' : ''}`,
          fingerboard_mode: fb,
          bridge_mode: br,
          fretless,
        });
        const setRes = await cmd('set', { preset: body });
        const setOk = !!(setRes && setRes.cmd === 'response' && !setRes.error);
        await sleep(80);
        const getRes = await cmd('get', { preset: { id: scratchId } });
        const p = getRes && getRes.data && getRes.data.preset;
        const row = {
          want_fb: fb,
          want_br: br,
          want_fretless: fretless,
          setOk,
          setError: setRes && setRes.error,
          got_fb: p && p.fingerboard_mode,
          got_br: p && p.bridge_mode,
          got_fretless: p && p.fretless,
          got_name: p && p.preset_name,
          match:
            p &&
            p.fingerboard_mode === fb &&
            p.bridge_mode === br &&
            !!p.fretless === !!fretless &&
            p.preset_name === body.preset_name,
        };
        matrix.push(row);
        console.log(
          `${setOk ? 'SET' : 'ERR'} fb=${fb} br=${br} fl=${fretless} -> got fb=${row.got_fb} br=${row.got_br} fl=${row.got_fretless} name=${row.got_name} ${row.match ? 'OK' : 'MISMATCH'}`
        );
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'mode-matrix.json'), JSON.stringify(matrix, null, 2));

  console.log('\n=== PARAM PATCH TESTS (one field at a time on slot 8) ===');
  // reset to a known good pad/press baseline
  let cur = Object.assign({}, base, {
    id: scratchId,
    preset_name: 'ParamBase',
    fingerboard_mode: 'pad',
    bridge_mode: 'press',
    fretless: false,
  });
  await cmd('set', { preset: cur });
  await sleep(100);

  const paramTests = [
    { tuning_name: 'ProbeTune' },
    { bridgeboard_tuning: [48, 50, 52, 53, 55, 57] },
    {
      fingerboard_tuning: Array.from({ length: 72 }, (_, i) => 36 + (i % 24)),
    },
    { string_flip: 'always_left' },
    { string_flip: 'always_right' },
    { string_flip: 'accel_flip' },
    { transpose_step: 2 },
    { arpeggiator: true },
    { arpeggiator: false },
    { sound_profile: 2 },
    { sound_profile: 0 },
    { twelve_string: true },
    { twelve_string: false },
    { hammer_on: false },
    { hammer_on: true },
    { pulloff_open_string: true },
    { channel_mode: 'single_channel' },
    { channel_mode: 'six_channel' },
    { fret_pressure_message: 'channel_press' },
    { fret_pressure_message: 'poly_press' },
    { fret_pressure_message: 'none' },
    { bridge_decay_time: 1000 },
    { hammerdown_resting_threshold: 40 },
    { hammerdown_active_threshold: 20 },
    { strum_channel: 1 },
    { fret_channel: 2 },
  ];

  const paramResults = [];
  for (const patch of paramTests) {
    const key = Object.keys(patch)[0];
    const body = Object.assign({}, cur, patch, { id: scratchId, preset_name: 'ParamBase' });
    const setRes = await cmd('set', { preset: body });
    const setOk = !!(setRes && setRes.cmd === 'response' && !setRes.error);
    await sleep(60);
    const getRes = await cmd('get', { preset: { id: scratchId } });
    const p = getRes && getRes.data && getRes.data.preset;
    const got = p ? p[key] : undefined;
    const want = patch[key];
    const same = JSON.stringify(got) === JSON.stringify(want);
    paramResults.push({ key, want, got, setOk, setError: setRes && setRes.error, same });
    console.log(
      `${setOk ? 'SET' : 'ERR'} ${key}=${JSON.stringify(want)} -> got=${JSON.stringify(got)} ${same ? 'OK' : 'DIFF'}`
    );
    if (setOk && same) cur = Object.assign({}, p, { id: scratchId });
  }
  fs.writeFileSync(path.join(outDir, 'param-matrix.json'), JSON.stringify(paramResults, null, 2));

  console.log('\n=== EDITOR MODE MAPPING CHECK ===');
  // Old editor modes -> device fields we should use
  const editorMaps = [
    { editor: 'fretted_string/strum', fb: 'string', br: 'pluck', fl: false },
    { editor: 'fretted_string/press', fb: 'string', br: 'press', fl: false },
    { editor: 'fretted_string/bow', fb: 'string', br: 'bow', fl: false },
    { editor: 'fretless_string/strum', fb: 'string', br: 'pluck', fl: true },
    { editor: 'fretless_string/slide', fb: 'string', br: 'slide', fl: true },
    { editor: 'grid/press', fb: 'keyboard', br: 'press', fl: false },
    { editor: 'grid/press_as_pad', fb: 'pad', br: 'press', fl: false },
    { editor: 'pad/press', fb: 'pad', br: 'press', fl: false },
    { editor: 'pad/strum', fb: 'pad', br: 'pluck', fl: false },
  ];
  const mapResults = [];
  for (const m of editorMaps) {
    const body = Object.assign({}, base, {
      id: scratchId,
      preset_name: m.editor.replace(/\W+/g, '_').slice(0, 20),
      fingerboard_mode: m.fb,
      bridge_mode: m.br,
      fretless: m.fl,
      tuning_name: 'Scaled Chords',
      bridgeboard_tuning: [48, 50, 52, 53, 55, 57],
    });
    const setRes = await cmd('set', { preset: body });
    await sleep(80);
    const getRes = await cmd('get', { preset: { id: scratchId } });
    const p = getRes && getRes.data && getRes.data.preset;
    const row = {
      editor: m.editor,
      setOk: !!(setRes && setRes.cmd === 'response' && !setRes.error),
      persisted_fb: p && p.fingerboard_mode,
      persisted_br: p && p.bridge_mode,
      persisted_fl: p && p.fretless,
      name: p && p.preset_name,
    };
    mapResults.push(row);
    console.log(row.editor, '->', row.persisted_fb, row.persisted_br, 'fl=' + row.persisted_fl, row.setOk ? 'SET_OK' : 'SET_FAIL');
  }
  fs.writeFileSync(path.join(outDir, 'editor-map.json'), JSON.stringify(mapResults, null, 2));

  console.log('\n=== restore scratch slot ===');
  original.id = scratchId;
  await cmd('set', { preset: original });
  await cmd('activate', { preset: { id: 5 } });

  console.log('\nFiles written to', outDir);
  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
