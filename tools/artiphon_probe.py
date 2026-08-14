#!/usr/bin/env python3
"""Probe Artiphon INSTRUMENT 1 SysEx JSON protocol."""

from __future__ import annotations

import json
import sys
import time
from typing import Any, Optional

try:
    import mido
except ImportError:
    print("Installing mido + python-rtmidi...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mido", "python-rtmidi"])
    import mido

HEADER = [0xF0, 0x00, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00]
msgid = 1


def find_ports() -> tuple[str, list[str]]:
    ins = mido.get_input_names()
    outs = mido.get_output_names()
    print("INPUTS:")
    for n in ins:
        print(" ", n)
    print("OUTPUTS:")
    for n in outs:
        print(" ", n)

    def pick_all(names: list[str]) -> list[str]:
        hit = []
        for n in names:
            u = n.upper()
            if "INSTRUMENT1" in u or "INSTRUMENT 1" in u or "ARTIPHON" in u:
                hit.append(n)
        return hit

    inns = pick_all(ins)
    outs_i = pick_all(outs)
    if not inns or not outs_i:
        raise SystemExit("INSTRUMENT1 MIDI ports not found. Close the Editor and plug the device.")
    print(f"Candidate IN={inns} OUT={outs_i}")
    return inns[0], outs_i


def encode_cmd(cmd: str, data: dict) -> tuple[list[int], int]:
    global msgid
    mid = msgid
    msgid += 1
    payload = json.dumps({"cmd": cmd, "msgid": mid, "data": data}, separators=(",", ":"))
    data_bytes = [ord(c) for c in payload]
    if any(b > 127 for b in data_bytes):
        raise ValueError("non-MIDI data byte in sysex JSON")
    # Full message including F0/F7 (status bytes may be >127)
    msg = HEADER + data_bytes + [0xF7]
    return msg, mid


def decode_sysex(data: list[int]) -> Optional[dict]:
    if len(data) < 11 or data[0] != 0xF0 or data[-1] != 0xF7:
        return None
    # Artiphon mfr 00 02 03 — device may reply with a different sub-header
    if data[1:4] != [0x00, 0x02, 0x03]:
        print("  (non-artiphon sysex head)", data[:12])
        return None
    print("  sysex head", data[1:10], "len", len(data))
    # Find JSON object in payload (after mfr bytes)
    raw = bytes(data[4:-1]).decode("ascii", errors="replace")
    brace = raw.find("{")
    if brace < 0:
        print("  no JSON object in", raw[:80])
        return None
    try:
        return json.loads(raw[brace:])
    except json.JSONDecodeError as e:
        print("  JSON parse fail:", e, raw[brace : brace + 200])
        return None


def wait_response(port_in, expect_msgid: int, timeout: float = 3.0) -> Optional[dict]:
    deadline = time.time() + timeout
    extras = []
    while time.time() < deadline:
        for msg in port_in.iter_pending():
            if msg.type != "sysex":
                continue
            # mido sysex data excludes F0/F7
            full = [0xF0] + list(msg.data) + [0xF7]
            obj = decode_sysex(full)
            if not obj:
                continue
            print("  <<", json.dumps(obj)[:300])
            if obj.get("msgid") == expect_msgid and ("cmd" in obj or "error" in obj):
                # ignore trailing empty duplicate acks later
                if obj.get("cmd") == "response" and "data" not in obj and "error" not in obj:
                    extras.append(obj)
                    continue
                return obj
            if obj.get("cmd") == "report":
                extras.append(obj)
        time.sleep(0.01)
    print("  !! timeout waiting msgid", expect_msgid)
    return None


def send_cmd(port_out, port_in, cmd: str, data: dict) -> Optional[dict]:
    msg, mid = encode_cmd(cmd, data)
    print(f">> {cmd} msgid={mid} bytes={len(msg)} data={json.dumps(data)[:120]}")
    port_out.send(mido.Message("sysex", data=msg[1:-1]))
    time.sleep(0.12)
    return wait_response(port_in, mid)


def open_working_pair(inn: str, outs: list[str]):
    port_in = mido.open_input(inn)
    for outn in outs:
        print(f"\nTrying OUT={outn!r} with IN={inn!r}")
        port_out = mido.open_output(outn)
        try:
            ident = send_cmd(port_out, port_in, "get", {"identity": {}})
            if ident and ident.get("data") and ident["data"].get("identity"):
                print("WORKING pair found")
                return port_in, port_out, outn, ident
        except Exception as e:
            print("  pair error:", e)
        port_out.close()
    port_in.close()
    raise SystemExit("No working MIDI IN/OUT pair. Close Artiphon Editor and retry.")


def main() -> None:
    inn, outs = find_ports()
    port_in, port_out, outn, ident = open_working_pair(inn, outs)
    try:
        print("\n=== 1) identity ===")
        print("IDENTITY:", json.dumps(ident, indent=2) if ident else None)

        print("\n=== 2) list presets 1..8 (names only) ===")
        names = {}
        for pid in range(1, 9):
            r = send_cmd(port_out, port_in, "get", {"preset": {"id": pid}})
            if r and r.get("data") and r["data"].get("preset"):
                p = r["data"]["preset"]
                names[pid] = {
                    "name": p.get("preset_name"),
                    "fb": p.get("fingerboard_mode"),
                    "br": p.get("bridge_mode"),
                    "fretless": p.get("fretless"),
                    "tuning": p.get("tuning_name"),
                    "sound": p.get("sound_profile"),
                    "keys": sorted(p.keys()),
                }
                print(f"  slot {pid}: {names[pid]['name']} fb={names[pid]['fb']} br={names[pid]['br']} sound={names[pid]['sound']}")
            else:
                print(f"  slot {pid}: FAIL", r)

        print("\n=== 3) read User1 (5) full ===")
        r5 = send_cmd(port_out, port_in, "get", {"preset": {"id": 5}})
        p5 = r5["data"]["preset"] if r5 and r5.get("data") else None
        if p5:
            print("User1 name:", p5.get("preset_name"))
            print("User1 modes:", p5.get("fingerboard_mode"), p5.get("bridge_mode"), "fretless=", p5.get("fretless"))
            print("User1 tuning:", p5.get("tuning_name"), "bridge", p5.get("bridgeboard_tuning"))
            print("User1 fb_tuning first 12:", (p5.get("fingerboard_tuning") or [])[:12])

        print("\n=== 4) echo test (set edit_buffer = current User1) ===")
        if p5:
            echo = dict(p5)
            echo["id"] = "edit_buffer"
            r = send_cmd(port_out, port_in, "set", {"preset": echo})
            print("echo set:", "OK" if r and r.get("cmd") == "response" and not r.get("error") else r)

        print("\n=== 5) compare keyboard vs pad for grid-like preset ===")
        if p5:
            for fb_mode in ("keyboard", "pad"):
                body = dict(p5)
                body["id"] = "edit_buffer"
                body["preset_name"] = f"Probe {fb_mode}"
                body["fingerboard_mode"] = fb_mode
                body["bridge_mode"] = "press"
                body["tuning_name"] = "Scaled Chords"
                body["bridgeboard_tuning"] = [48, 50, 52, 53, 55, 57]
                # simple diatonic-ish board
                body["fingerboard_tuning"] = [
                    48,50,52,53,55,57,59,60,62,64,65,67,
                    55,57,59,60,62,64,65,67,69,71,72,74,
                    60,62,64,65,67,69,71,72,74,76,77,79,
                    65,67,69,71,72,74,76,77,79,81,83,84,
                    72,74,76,77,79,81,83,84,86,88,89,91,
                    77,79,81,83,84,86,88,89,91,93,95,96,
                ]
                print(f"\n-- set fb={fb_mode} --")
                r = send_cmd(port_out, port_in, "set", {"preset": body})
                ok = r and r.get("cmd") == "response" and not r.get("error")
                print("set:", "OK" if ok else r)
                if not ok:
                    continue
                r = send_cmd(port_out, port_in, "save", {"preset": {"id": 5}})
                print("save:", "OK" if r and r.get("cmd") == "response" else r)
                r = send_cmd(port_out, port_in, "activate", {"preset": {"id": 5}})
                print("activate:", "OK" if r and r.get("cmd") == "response" else r)
                time.sleep(0.2)
                verify = send_cmd(port_out, port_in, "get", {"preset": {"id": 5}})
                vp = verify["data"]["preset"] if verify and verify.get("data") else {}
                print(
                    "verify:",
                    vp.get("preset_name"),
                    vp.get("fingerboard_mode"),
                    vp.get("bridge_mode"),
                    vp.get("tuning_name"),
                    "bridge",
                    vp.get("bridgeboard_tuning"),
                )

        print("\n=== 6) activate slot 5 and done ===")
        send_cmd(port_out, port_in, "activate", {"preset": {"id": 5}})
        print("\nDONE. Check User1 on device / in Surge.")
        print("Summary names:", {k: v["name"] for k, v in names.items()})
    finally:
        port_out.close()
        port_in.close()


if __name__ == "__main__":
    main()
