# Artiphon INSTRUMENT 1 Editor — Windows fix

Unofficial **Windows** patch of the official [Artiphon INSTRUMENT 1 Editor](https://artiphon.com/) (Electron).

The stock Windows editor often failed to save presets and techniques to firmware **1.0.23**. This repo documents the fix: unpack `app.asar`, patch the renderer/main process, repack.

> **Not affiliated with Artiphon.** Use at your own risk. Keep a backup of the original `app.asar`.

**Tested on:** Windows 10/11 · INSTRUMENT1 (SysEx) · firmware **1.0.23**

---

## What was wrong

| Issue | Effect |
|--------|--------|
| Unreliable `edit_buffer` + `save` | User 1–4 saves failed or dropped fields |
| Bad mode mapping | Chord grids (`grid`) sent as `pad` instead of `keyboard` |
| Channel sanitizer | Forced `six_channel` only — Single Channel (`one_channel`) could not stick |
| Technique UI | Hammer-on / pulloff did not rewrite the active user preset |
| Pitch bend range | UI allowed **48**; firmware only accepts **12** or **24** |
| Windows UX | No easy load of device presets, weak thresholds, limited menus |

---

## What this fix does

Patches under `resources/patch-*.js` are applied to `resources/app-extracted/`, then packed into `resources/app.asar` (original kept as `resources/app.backup`).

### Save / protocol

- Prefer **direct `set` with preset id** for user slots (**User N → device id N+4**, ids **5–8**)
- Sanitize values firmware 1.0.23 accepts:
  - `channel_mode`: `one_channel` **or** `six_channel` (`single_channel` → `one_channel`)
  - `fret_pressure_message`: `poly_press` / `none` only
  - clamp channel / transpose / sound profile ranges
- On save, merge **hammer-on / pulloff** from the active technique
- General threshold changes also `save { general: true }`

### Editor ↔ device mapping

| Editor | Device |
|--------|--------|
| Fretted / fretless string | `string` (+ `fretless`) |
| Strum | `pluck` |
| Grid (chord grids) | `keyboard` (not `pad`) |
| Pad | `pad` |

### UI & Windows menus

- Sync helpers for technique / pulloff (`__artiphonSyncTechnique`, `__artiphonSetPulloff`)
- Clearer touch / neck / bridge thresholds, pulloff control, tooltips
- Pitch bend range clamped to **12 / 24**
- On connect: auto-load presets **1–8** into the UI
- Menu: Save User 1–4 (**Ctrl+1–4**), Load Presets from INSTRUMENT 1, **F12** DevTools
- Console: `window.__artiphonDbg` (`dumpPresets`, `loadPresets`, …)

### Extras

- **Auto Chordinator** helpers in `tools/auto-chordinator/`
- MIDI probes in `tools/node-probe/` (JZZ)

---

## Quick start

1. Install / keep the official Windows editor (or use this tree if it already includes the Electron runtime).
2. Ensure `resources/app.asar` is the **patched** build (backup = `resources/app.backup`).
3. Run `Artiphon INSTRUMENT 1 Editor.exe`, connect the INSTRUMENT1, save to User 1–4.

User data remains in:

```text
%APPDATA%\Artiphon INSTRUMENT 1 Editor\
```

### Re-apply patches after an official update

```bash
# from resources/
node patch-modes-load.js
node patch-full-params.js
node patch-channel-win.js
node patch-hammer-tooltips.js
node patch-pbr-12-24.js
# …other patch-*.js as needed — most scripts pack app.asar themselves
```

---

## Repo layout

| Path | Role |
|------|------|
| `resources/app.asar` | Patched app (runtime) |
| `resources/app.backup` | Original asar backup |
| `resources/app-extracted/` | Unpacked editable app |
| `resources/patch-*.js` | Patch scripts |
| `tools/` | Probes, dumps, Auto Chordinator |

---

## FL Studio + pitch bend

In **Multi Channel** (`six_channel`), each string uses its **own MIDI channel** for notes and pitch bend. Linking FL **Channel pitch** → **Ctrl 255** on one channel (e.g. 7) only affects that string.

For one link for all strings:

1. Set the I1 to **Single Channel** (`one_channel`)
2. Link **Channel pitch** → **Ctrl 255**, **Channel 1**, enable the **Omni** checkbox (not “channel 0”), same **Port** as INSTRUMENT1
3. Match bend range (**12** or **24**) in the FL wrapper / plugin

Or: Browser → **Current project → Remote control** → **Omni - Channel pitch**, then slide/bend.

---

## Disclaimer

- Unofficial modification of Artiphon’s Electron app for **Windows**.
- Artiphon owns the original editor; this project only documents community fixes.
- After an official reinstall/update, re-apply the patches if saves break again.
