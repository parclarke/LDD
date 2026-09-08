"""
Extracts notification and correspondence content from a Pega application export.

Pega notifications are three linked rules:

  Rule-Notification    the notification definition bound to a flow step
  Rule-Obj-FieldValue  PYNOTIFICATIONMESSAGE!<name> - the subject line
  Rule-Obj-Corr        <name>!EMAIL - the email body, in `pySourceStream`

All three live in `rules.jar` and are readable with the UTF-16BE technique, so
the wording of every notification can be recovered from the export alone - no
screenshots, no Dev Studio, no business workshop.

Usage:
    python scripts/extract-notifications.py <export.zip> [--json out.json]
"""

import io
import json
import re
import sys
import zipfile

CTRL = re.compile(r"[\x00-\x1f\x7f\ufffd\uffe0-\uffff]+")
WS = re.compile(r"\s+")

# Serialisation field names that follow a captured value and must be trimmed.
TAIL = re.compile(
    r"\s+(?:px|py|pz|@Z:|Embed-|Rule-|Data-|RULE-|MYORG-).*$", re.S)


def clean(s):
    return WS.sub(" ", CTRL.sub(" ", s)).strip()


def trim(s):
    return TAIL.sub("", s).strip(" ,")


def members(export_zip):
    with zipfile.ZipFile(export_zip) as outer:
        jar = next(n for n in outer.namelist() if n.endswith("rules.jar"))
        blob = outer.read(jar)
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for n in sorted(z.namelist()):
            if n.startswith("instances_") and n.endswith(".bin"):
                yield z.read(n).decode("utf-16-be", "replace")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)

    subjects = {}
    bodies = {}

    for txt in members(sys.argv[1]):
        # Subject lines.
        for m in re.finditer(
                r"MYORG-THELENDING-WORK-([A-Z]+)!PYNOTIFICATIONMESSAGE!([A-Z0-9_]+)", txt):
            key = (m.group(1), m.group(2))
            if key in subjects:
                continue
            win = clean(txt[max(0, m.start() - 600):m.start()])
            found = re.findall(r"pyLocalizedValue\s+\S?\s*(.{3,80})", win)
            if found:
                subjects[key] = trim(found[-1])

        # Email bodies. pySourceStream holds the rendered correspondence text.
        for m in re.finditer(
                r"RULE-OBJ-CORR MYORG-THELENDING-WORK-([A-Z]+) ([A-Z0-9_]+)!EMAIL", txt):
            key = (m.group(1), m.group(2))
            if key in bodies:
                continue
            seg = clean(txt[m.start():m.start() + 4000])
            b = re.search(r"pySourceStream\s+\S*\s*(.+?)(?=\s+px[A-Z]|\s+py[A-Z]|\s+pz[A-Z])",
                          seg, re.S)
            if b:
                text = b.group(1).strip()
                # Drop the leading @Z: type marker and the serialised length
                # prefix, which survive as a few stray high characters.
                text = re.sub(r"^@Z:\S+\s*", "", text)
                text = re.sub(r"^[^A-Za-z<]{1,6}", "", text)
                if len(text) > 40:
                    bodies[key] = text

    keys = sorted(set(subjects) | set(bodies))
    both = [k for k in keys if k in subjects and k in bodies]

    print(f"Notification rules found : {len(keys)}")
    print(f"  subject recovered      : {len(subjects)}")
    print(f"  email body recovered   : {len(bodies)}")
    print(f"  both                   : {len(both)}")
    print()

    for k in keys:
        ct, name = k
        print(f"--- {ct} / {name}")
        if k in subjects:
            print(f"    subject: {subjects[k]}")
        if k in bodies:
            body = bodies[k]
            print(f"    body   : {body[:200]}{'...' if len(body) > 200 else ''}")
        print()

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        payload = [
            {
                "caseTypeUpper": ct,
                "name": name,
                "subject": subjects.get((ct, name)),
                "body": bodies.get((ct, name)),
            }
            for ct, name in keys
        ]
        json.dump(payload, open(out, "w", encoding="utf-8"), indent=2)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
