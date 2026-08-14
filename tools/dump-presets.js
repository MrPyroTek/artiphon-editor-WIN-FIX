#!/usr/bin/env node
/**
 * Read all presets from INSTRUMENT 1 into tools/preset-dumps/
 * Usage: node tools/dump-presets.js
 * Close the Artiphon Editor first.
 */
const fs = require('fs');
const path = require('path');
const JZZ = require('./node-probe/node_modules/jzz');

const TX_PREFIX = [0xf0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00];
let msgid = 1;
const outDir = path.join(__dirname, 'preset-dumps');

function encode(cmd, data) {
  const mid = msgid++;
  const json = JSON.stringify({ cmd, msgid: mid, data });
  return { mid, bytes: TX_PREFIX.concat([...json].map((c) => c.charCodeAt(0))).concat([0xf7]) };
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
  if (!inName || !outName) throw new Error('INSTRUMENT1 not found — close Editor, plug USB');

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

  const ident = await cmd('get', { identity: {} });
  const id = ident && ident.data && ident.data.identity;
  console.log('Device', id && id.name, 'FW', id && id.firmware_version, 'SN', id && id.serial_number);
  fs.writeFileSync(path.join(outDir, 'identity.json'), JSON.stringify(id, null, 2));

  const all = {};
  console.log('\n#  Name                      fb         br      fretless  tuning              sound');
  console.log('-'.repeat(90));
  for (let n = 1; n <= 8; n++) {
    const r = await cmd('get', { preset: { id: n } });
    const p = r && r.data && r.data.preset;
    all[n] = p || null;
    if (!p) {
      console.log(String(n).padStart(2), 'FAIL');
      continue;
    }
    fs.writeFileSync(path.join(outDir, `preset-${n}.json`), JSON.stringify(p, null, 2));
    console.log(
      String(n).padStart(2),
      String(p.preset_name).padEnd(24),
      String(p.fingerboard_mode).padEnd(10),
      String(p.bridge_mode).padEnd(7),
      String(p.fretless).padEnd(9),
      String(p.tuning_name).padEnd(18),
      p.sound_profile
    );
  }
  fs.writeFileSync(path.join(outDir, 'all-presets.json'), JSON.stringify(all, null, 2));
  console.log('\nSaved JSON files in', outDir);

  input.close();
  output.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
