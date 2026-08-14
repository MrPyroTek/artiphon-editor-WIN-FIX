/**
 * Compare MIDI while sliding in Violin bow vs slide method.
 * Close Editor. When prompted, slide slowly on ONE string for ~5s each test.
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
  if (!inn) throw new Error('Close Editor');
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

  const base = (await cmd('get', { preset: { id: 2 } })).data.preset;
  await cmd('set', { general: { mpe_mode: false } });
  await cmd('set', { general: { pitch_bend_range: 12 } });
  await cmd('save', { general: true });

  async function listen(label, ms) {
    console.log('\n>>>', label, '- SLIDE NOW for', ms / 1000, 's');
    const notes = new Set();
    let pbMin = 8192,
      pbMax = 8192,
      pbCount = 0,
      noteOns = 0;
    const tEnd = Date.now() + ms;
    const h = (msg) => {
      const a = Array.from(msg);
      if (a.length >= 3 && a[0] >= 0xe0 && a[0] <= 0xef) {
        const val = a[1] | (a[2] << 7);
        pbCount++;
        if (val < pbMin) pbMin = val;
        if (val > pbMax) pbMax = val;
      }
      if (a.length >= 3 && a[0] >= 0x90 && a[0] <= 0x9f && a[2] > 0) {
        noteOns++;
        notes.add(a[1]);
      }
    };
    input.connect(h);
    while (Date.now() < tEnd) await sleep(20);
    // can't easily disconnect JZZ handler; ignore
    const span = pbMax - pbMin;
    const semisIf12 = (Math.max(Math.abs(pbMax - 8192), Math.abs(8192 - pbMin)) / 8192) * 12;
    console.log({
      label,
      noteOns,
      uniqueNotes: [...notes].sort((a, b) => a - b),
      noteSpan: notes.size ? Math.max(...notes) - Math.min(...notes) : 0,
      pbCount,
      pbMin,
      pbMax,
      pbSpan: span,
      approxSemitonesIfRange12: semisIf12.toFixed(2),
    });
  }

  // bow + fretless
  await cmd('set', {
    preset: Object.assign({}, base, {
      id: 2,
      preset_name: 'Violin',
      fingerboard_mode: 'string',
      bridge_mode: 'bow',
      fretless: true,
      hammer_on: false,
      pulloff_open_string: false,
    }),
  });
  await cmd('activate', { preset: { id: 2 } });
  await listen('bow+fretless', 6000);

  // slide + fretless
  await cmd('set', {
    preset: Object.assign({}, base, {
      id: 2,
      fingerboard_mode: 'string',
      bridge_mode: 'slide',
      fretless: true,
      hammer_on: false,
      pulloff_open_string: false,
    }),
  });
  await cmd('activate', { preset: { id: 2 } });
  await listen('slide+fretless', 6000);

  // fretted + string bend on via general if possible - skip
  console.log('\nDone. If uniqueNotes jumps by many semitones but pbSpan is small,');
  console.log('I1 is doing note-stepping + micro-bend (sounds like ~1 fret of bend).');

  input.close();
  output.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
