# Windows fix — Artiphon INSTRUMENT 1 Editor

This folder is a **patched Windows install** of the official *Artiphon INSTRUMENT 1 Editor* (Electron).  
The stock Windows build did not reliably save presets / techniques to firmware **1.0.23**. The app under `resources/` was unpacked, patched, and repacked into `app.asar`. An original backup is kept as `resources/app.backup`.

**Tested with:** Windows 10/11, INSTRUMENT1 over MIDI SysEx, firmware **1.0.23**.

---

## What was broken

1. **Save to User 1–4 failed or silently dropped fields**  
   Using `edit_buffer` + `save` was unreliable. Firmware rejected some editor JSON (`error` / line codes) when values did not match what 1.0.23 accepts.

2. **Wrong editor ↔ device mode mapping**  
   Chord grids (`grid`) were sent as `pad` instead of `keyboard`. Strum ↔ `pluck` and fretted/fretless ↔ `string`±`fretless` needed consistent conversion both ways.

3. **Sanitizer forced Multi Channel**  
   `channel_mode` was forced to `six_channel` only. Single Channel (`one_channel`) could not stick — important for DAWs like FL Studio where pitch bend must stay on one MIDI channel.

4. **Technique UI (hammer-on / pulloff) did not persist**  
   Live technique toggles did not rewrite the active user preset, so the device kept old `hammer_on` / `pulloff_open_string`.

5. **Invalid pitch bend range**  
   Editor allowed **48**; firmware 1.0.23 only accepts **12** or **24**.

6. **Connect / UX gaps on Windows**  
   No easy load of device presets 1–8 into the UI, weak threshold controls, no DevTools / save shortcuts in the menu.

---

## What we changed

Patches live as scripts under `resources/patch-*.js` and were applied to:

- `resources/app-extracted/dist/bundle.js` (renderer)
- `resources/app-extracted/main.js` (menus / IPC)
- UI: `app.html` / `style.css` (tooltips, labels)
- Then repacked to `resources/app.asar`

### Protocol / save

- Prefer **direct `set` with preset `id`** for User slots (**User N → device id N+4**, i.e. User 1–4 = ids **5–8**).
- Sanitize outbound presets so firmware accepts them:
  - `channel_mode`: `one_channel` **or** `six_channel` (map legacy `single_channel` → `one_channel`)
  - `fret_pressure_message`: only `poly_press` / `none`
  - clamp channels / transpose / sound profile ranges
- On save, **merge hammer-on / pulloff** from the active technique into the preset body.
- General threshold edits also send `save { general: true }`.

### Mode mapping

| Editor | Device |
|--------|--------|
| fretted / fretless string | `fingerboard_mode: string` (+ `fretless`) |
| strum | `bridge_mode: pluck` |
| grid (chord grids) | `fingerboard_mode: keyboard` (not `pad`) |
| pad | `pad` |

Helpers `fromDevice` / `toDevice` keep load and save consistent.

### Techniques & UI

- `__artiphonSyncTechnique` / `__artiphonSetPulloff` write technique flags onto the active user preset and re-activate.
- Clearer **Touch Sensitivity** / neck & bridge thresholds; visible **Pulloff** control; tooltips.
- **Pitch Bend Range** slider limited / clamped to **12 or 24**.

### Connect & menus (Windows)

- After identity: **auto-load presets 1–8** (+ general) into the UI (no aggressive full technique overwrite).
- Menu: **Save User 1–4** (Ctrl+1–4), **Load Presets from INSTRUMENT 1**, **F12 DevTools**.
- Console helpers: `window.__artiphonDbg` (`dumpPresets`, `loadPresets`, `fromDevice`, ping/get/set helpers).

### Extra content (optional)

- **Auto Chordinator** presets / folder under user presets (`tools/auto-chordinator/`) — open-string chord tunings on `string`+`pluck` slots.
- MIDI probes under `tools/node-probe/` (JZZ) used to verify SysEx and pitch-bend channels.

---

## Layout

| Path | Role |
|------|------|
| `Artiphon INSTRUMENT 1 Editor.exe` | Launch the patched editor |
| `resources/app.asar` | Patched app package (runtime) |
| `resources/app.backup` | Backup of original asar |
| `resources/app-extracted/` | Editable source of the asar |
| `resources/patch-*.js` | Re-applicable patch scripts |
| `tools/` | Probes, dumps, Auto Chordinator helpers |

User data (presets JSON, etc.) still lives under:

`%APPDATA%\Artiphon INSTRUMENT 1 Editor\`

---

## DAW note (FL Studio + pitch bend)

With **Multi Channel** (`six_channel`), each string uses its **own MIDI channel** for notes and pitch bend. Linking FL **Channel pitch** to **Ctrl 255** on a single channel (e.g. 7) only affects that string.

For one FL **Channel pitch** link for all strings:

1. Use **Single Channel** (`one_channel`) on the I1.
2. Link **Channel pitch** → **Ctrl 255**, **Channel 1**, enable the **Omni** checkbox (not “channel 0”), same **Port** as INSTRUMENT1.
3. Match bend range (**12** or **24**) in the FL wrapper / plugin (e.g. Surge Bend Depth).

Built-in FL path: Browser → **Current project → Remote control** → **Omni - Channel pitch**, then move the bend/slide.

---

## Safety

- This is an **unofficial** modification of Artiphon’s Electron app for local Windows use.
- Keep `app.backup` if you need to restore the stock editor.
- After an official Artiphon update/reinstall, re-apply patches from `resources/patch-*.js` if needed.
