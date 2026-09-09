import os, re, glob
tmp = os.path.join(os.environ["TEMP"], "pk8")
contents = open(os.path.join(tmp, "c.txt"), encoding="latin-1").read().upper()

# The 20 transform step names, straight from the extracted config (not a fuzzy parse).
import json
cfg = json.load(open("lending-due-diligence-app/prototype/ldd-prototype-config.json", encoding="utf-8"))
names = [(ct["code"], st["name"], s["name"])
         for ct in cfg["caseTypes"] for st in ct["stages"] for s in st["steps"]
         if s.get("impl") == "pzRunDataTransform"]

print(f"Transform steps: {len(names)}")
print("Does a rule of ANY type exist in the export bearing that name?\n")
found = 0
for ct, stage, step in names:
    key = re.sub(r"[^A-Z0-9]", "", step.upper())
    hit = key in re.sub(r"[^A-Z0-9\n]", "", contents)
    if hit: found += 1
    print(f"  {'RULE EXISTS' if hit else 'no rule    '}  {ct:22s} {step}")
print(f"\n{found} of {len(names)} transform steps have a rule behind them.")
