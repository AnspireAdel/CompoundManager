#!/usr/bin/env python3
"""Capture Play Store 9:16 / 16:9 screenshots from a running Android emulator."""
from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

ADB = Path.home() / "Library/Android/sdk/platform-tools/adb"
SERIAL = sys.argv[1] if len(sys.argv) > 1 else ""
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "dist/play-screenshots/phone")
USER = "666666"
PASSWORD = "123456"
PKG = "com.anspire.compoundmanager"


def adb(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    cmd = [str(ADB)]
    if SERIAL:
        cmd += ["-s", SERIAL]
    cmd += list(args)
    return subprocess.run(cmd, check=check, capture_output=True)


def dump_ui() -> str:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
    p = subprocess.run(
        [str(ADB)] + (["-s", SERIAL] if SERIAL else []) + ["exec-out", "cat", "/sdcard/ui.xml"],
        capture_output=True,
        check=False,
    )
    return p.stdout.decode("utf-8", "ignore")


def nodes(xml: str):
    for m in re.finditer(r"<node\b([^>]+)/?>", xml):
        attrs = dict(re.findall(r'(\S+)="([^"]*)"', m.group(1)))
        bm = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", attrs.get("bounds", ""))
        if not bm:
            continue
        x1, y1, x2, y2 = map(int, bm.groups())
        yield {
            "text": attrs.get("text", ""),
            "desc": attrs.get("content-desc", ""),
            "id": attrs.get("resource-id", ""),
            "cls": attrs.get("class", ""),
            "pkg": attrs.get("package", ""),
            "password": attrs.get("password", "false") == "true",
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "cx": (x1 + x2) // 2,
            "cy": (y1 + y2) // 2,
        }


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(0.7)


def tap_text(xml: str, *needles: str) -> bool:
    found = []
    for n in nodes(xml):
        blob = n["text"] + n["desc"]
        if any(s in blob for s in needles) and n["pkg"].endswith("compoundmanager"):
            found.append(n)
    if not found:
        for n in nodes(xml):
            blob = n["text"] + n["desc"]
            if any(s in blob for s in needles):
                found.append(n)
    if not found:
        return False
    # Prefer the smallest matching node (tab label vs full-screen container)
    found.sort(key=lambda n: (n["x2"] - n["x1"]) * (n["y2"] - n["y1"]))
    n = found[0]
    tap(n["cx"], n["cy"])
    return True


def screen_size() -> tuple[int, int]:
    p = adb("shell", "wm", "size", check=False)
    out = (p.stdout or b"").decode("utf-8", "ignore")
    m = re.search(r"(\d+)x(\d+)", out)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1080, 1920


def hide_ime() -> None:
    # Tap below the status bar to unfocus inputs. Do not send BACK — that
    # leaves the app and lands on the launcher.
    w, h = screen_size()
    adb("shell", "input", "tap", str(w // 2), str(max(80, h // 14)))
    time.sleep(0.35)


def clear_focused() -> None:
    adb("shell", "input", "keyevent", "123", check=False)  # MOVE_END
    for _ in range(24):
        adb("shell", "input", "keyevent", "67", check=False)  # DEL
    time.sleep(0.2)


def type_digits(s: str) -> None:
    mapping = {str(i): str(7 + i) for i in range(10)}  # KEYCODE_0 = 7
    events = [mapping[ch] for ch in s if ch in mapping]
    if events:
        adb("shell", "input", "keyevent", *events)
    time.sleep(0.4)


def tap_field(n: dict) -> None:
    # Avoid the password-eye on the left; tap the right half of the field.
    x = n["x1"] + int((n["x2"] - n["x1"]) * 0.72)
    y = n["cy"]
    tap(x, y)


def screenshot_raw(path: Path) -> None:
    data = subprocess.run(
        [str(ADB)] + (["-s", SERIAL] if SERIAL else []) + ["exec-out", "screencap", "-p"],
        check=True,
        capture_output=True,
    ).stdout
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def to_store_ratio(src: Path, dest: Path, min_side: int = 320) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    landscape = w >= h
    target_ratio = 16 / 9 if landscape else 9 / 16
    current = w / h
    if current > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    elif current < target_ratio:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))
    w, h = im.size
    if min(w, h) < min_side:
        scale = min_side / min(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        w, h = im.size
    max_side = 7680 if min_side >= 1080 else 3840
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG", optimize=True)


def wait_text(*needles: str, tries: int = 12) -> str:
    for _ in range(tries):
        xml = dump_ui()
        if any(s in xml for s in needles):
            return xml
        time.sleep(1)
    return dump_ui()


def demo_status_bar() -> None:
    adb("shell", "settings", "put", "global", "sysui_demo_allowed", "1", check=False)
    adb("shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "enter", check=False)
    adb(
        "shell", "am", "broadcast", "-a", "com.android.systemui.demo",
        "-e", "command", "clock", "-e", "hhmm", "0941", check=False,
    )
    adb(
        "shell", "am", "broadcast", "-a", "com.android.systemui.demo",
        "-e", "command", "network", "-e", "wifi", "show", "-e", "level", "4",
        "-e", "mobile", "show", "-e", "datatype", "lte", "-e", "level", "4",
        check=False,
    )
    adb(
        "shell", "am", "broadcast", "-a", "com.android.systemui.demo",
        "-e", "command", "battery", "-e", "level", "100", "-e", "plugged", "false",
        check=False,
    )
    adb(
        "shell", "am", "broadcast", "-a", "com.android.systemui.demo",
        "-e", "command", "notifications", "-e", "visible", "false",
        check=False,
    )
    adb("shell", "settings", "put", "global", "window_animation_scale", "0", check=False)
    adb("shell", "settings", "put", "global", "transition_animation_scale", "0", check=False)
    adb("shell", "settings", "put", "global", "animator_duration_scale", "0", check=False)


def launch() -> None:
    size = "1440x2560" if any(k in str(OUT) for k in ("tablet10", "10-inch", "10inch")) else "1080x1920"
    adb("shell", "wm", "size", size, check=False)
    time.sleep(0.3)
    adb("shell", "pm", "clear", PKG, check=False)
    time.sleep(0.6)
    adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", check=False)
    time.sleep(2)


def edit_texts(xml: str):
    edits = [
        n
        for n in nodes(xml)
        if "EditText" in n["cls"] and PKG in n["pkg"]
    ]
    edits.sort(key=lambda n: n["y1"])
    return edits


def login(xml: str) -> str:
    edits = edit_texts(xml)
    if len(edits) < 2:
        # fallback: any EditText
        edits = [n for n in nodes(xml) if "EditText" in n["cls"]]
        edits.sort(key=lambda n: n["y1"])
    if len(edits) < 2:
        print("warn: could not find two EditTexts", file=sys.stderr)
        return xml

    tap_field(edits[0])
    clear_focused()
    type_digits(USER)
    hide_ime()
    time.sleep(0.5)

    xml = dump_ui()
    edits = edit_texts(xml) or edits
    pwd = next((n for n in edits if n["password"]), edits[min(1, len(edits) - 1)])
    tap_field(pwd)
    clear_focused()
    type_digits(PASSWORD)
    hide_ime()
    time.sleep(0.4)

    xml = dump_ui()
    if not tap_text(xml, "تسجيل الدخول"):
        # last-resort: tap below password field
        tap(pwd["cx"], min(pwd["y2"] + 180, pwd["y2"] + 240))
    return wait_text("الرئيسية", "الفواتير", "المزيد", tries=25)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    demo_status_bar()
    launch()
    xml = wait_text("تسجيل الدخول", "الرئيسية", "الفواتير")

    shots: list[tuple[str, str]] = []

    def capture(name: str) -> None:
        time.sleep(0.8)
        raw = OUT / f"_raw_{name}.png"
        screenshot_raw(raw)
        shots.append((name, str(raw)))
        print("captured", name, flush=True)

    if "تسجيل الدخول" in xml and "الرئيسية" not in xml:
        capture("01-login")
        xml = login(xml)
        time.sleep(1.5)
        xml = dump_ui()

    if "تسجيل الدخول" in xml and "الرئيسية" not in xml:
        print("ERROR: still on login after attempt", file=sys.stderr)
        sys.exit(2)
    print("logged in", flush=True)

    capture("02-home")
    xml = dump_ui()
    tap_text(xml, "الفواتير")
    wait_text("الفواتير", "فاتورة")
    capture("03-bills")
    xml = dump_ui()
    tap_text(xml, "المزيد")
    wait_text("المزيد", "الخدمات", "المعاملات")
    capture("04-more")
    xml = dump_ui()
    tap_text(xml, "الخدمات")
    wait_text("خدمات", "الخدمات", "بحث")
    capture("05-services")
    xml = dump_ui()
    if not tap_text(xml, "المزيد"):
        adb("shell", "input", "keyevent", "4", check=False)
        time.sleep(0.8)
        xml = dump_ui()
        tap_text(xml, "المزيد")
    wait_text("المزيد", "المعاملات")
    tap_text(dump_ui(), "المعاملات المالية")
    wait_text("المعاملات", "رصيد", "معاملة")
    capture("06-transactions")
    adb("shell", "input", "keyevent", "4", check=False)
    time.sleep(0.8)
    xml = dump_ui()
    if "الإشعارات" not in xml:
        tap_text(xml, "المزيد")
        xml = dump_ui()
    tap_text(xml, "الإشعارات")
    wait_text("الإشعارات", "إشعار")
    capture("07-notifications")
    adb("shell", "input", "keyevent", "4", check=False)
    time.sleep(0.8)
    xml = dump_ui()
    if "تواصل معنا" not in xml and "الطلبات والشكاوى" not in xml:
        tap_text(xml, "المزيد")
        xml = dump_ui()
    tap_text(xml, "تواصل معنا") or tap_text(xml, "الطلبات والشكاوى")
    wait_text("تواصل", "طلب", "شكوى")
    capture("08-contact")

    min_side = 1080 if any(k in str(OUT) for k in ("tablet10", "10-inch", "10inch")) else 320
    n = 0
    for name, raw in shots:
        dest = OUT / f"{name}.png"
        to_store_ratio(Path(raw), dest, min_side=min_side)
        n += 1
        print("wrote", dest, dest.stat().st_size, flush=True)
    print("done", n, "screenshots in", OUT, flush=True)
    adb("shell", "wm", "size", "reset", check=False)


if __name__ == "__main__":
    main()
