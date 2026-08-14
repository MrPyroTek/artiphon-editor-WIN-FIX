/** Print every non-sysex MIDI from INSTRUMENT1 for 12s. Close Editor. SLIDE while holding a note. */
const JZZ = require('jzz');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const midi = await JZZ();
  const inn = midi.info().inputs.map((p) => p.name).find((n) => /INSTRUMENT/i.test(n));
  if (!inn) throw new Error('INSTRUMENT1 not found');
  const input = await midi.openMidiIn(inn);
  const counts = {};
  const samples = {};
  function key(a) {
    const st = a[0] & 0xf0;
    const ch = (a[0] & 0x0f) + 1;
    if (st === 0xe0) return `PitchBend ch${ch}`;
    if (st === 0xd0) return `ChanPressure ch${ch}`;
    if (st === 0xa0) return `PolyAT ch${ch}`;
    if (st === 0xb0) return `CC${a[1]} ch${ch}`;
    if (st === 0x90 && a[2] > 0) return `NoteOn ch${ch}`;
    if (st === 0x90 && a[2] === 0) return `NoteOff0 ch${ch}`;
    if (st === 0x80) return `NoteOff ch${ch}`;
    return `Other ${a[0].toString(16)}`;
  }
  console.log('Listening 12s on', inn, '- hold note + SLIDE now');
  input.connect((msg) => {
    const a = Array.from(msg);
    if (a[0] === 0xf0) return; // skip sysex
    const k = key(a);
    counts[k] = (counts[k] || 0) + 1;
    if (!samples[k]) samples[k] = a.join(',');
    if (k.startsWith('PitchBend') || k.startsWith('CC') || k.startsWith('ChanPressure') || k.startsWith('PolyAT')) {
      if (counts[k] <= 3) console.log(k, a.join(' '));
    }
  });
  await sleep(12000);
  console.log('\n=== COUNTS ===');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(v, k, 'ex:', samples[k]));
  input.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
