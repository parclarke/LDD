"""
Extracts Pega rule bodies from an application export's rules.jar.

Contrary to the common claim that `instances_*.bin` members are an undecodable
proprietary format, they are a Java-serialised stream whose *payload strings are
UTF-16BE*. Decoding the file as UTF-16BE makes the rule bodies - including flow
definitions, connector transitions and stage-change targets - directly readable.
An ASCII scan finds nothing, which is why the format is usually assumed opaque.

What this recovers:
  - the flow rules present, per case type
  - each flow's connector transitions and their condition type
  - stage-change utility steps with their pyGotoStage / TargetStage values

Usage:
    python scripts/extract-flow-rules.py <TheLending.zip> [--json out.json]
"""

import io
import json
import re
import sys
import zipfile
from collections import defaultdict

CLEAN = re.compile(r"[\x00-\x1f\x7f\ufffd\uffe0-\uffff]+")
WS = re.compile(r"\s+")


def clean(s: str) -> str:
    return WS.sub(" ", CLEAN.sub(" ", s)).strip()


def load_rule_blobs(export_zip: str):
    """Yield (member_name, decoded_text) for every instances_*.bin in rules.jar."""
    with zipfile.ZipFile(export_zip) as outer:
        jar_name = next((n for n in outer.namelist() if n.endswith("rules.jar")), None)
        if not jar_name:
            raise SystemExit("no rules.jar inside the export archive")
        jar_bytes = outer.read(jar_name)

    with zipfile.ZipFile(io.BytesIO(jar_bytes)) as jar:
        contents = ""
        if "META-INF/contents.txt" in jar.namelist():
            contents = jar.read("META-INF/contents.txt").decode("latin-1")
        for name in sorted(jar.namelist()):
            if not name.startswith("instances_") or not name.endswith(".bin"):
                continue
            raw = jar.read(name)
            # The payload strings are UTF-16BE. Decoding the whole member is
            # crude but reliable for text recovery, and avoids having to write a
            # full Java-serialisation parser.
            yield name, raw.decode("utf-16-be", "replace"), contents


def rule_index(contents: str):
    """Parse META-INF/contents.txt into {rule-type: [instance keys]}."""
    idx = defaultdict(list)
    for line in contents.splitlines()[1:]:
        key = line.split("*")[0].strip()
        if not key:
            continue
        rtype = key.split(" ", 1)[0]
        idx[rtype].append(key)
    return idx


def find_transitions(text: str):
    """Connector transitions and their condition type."""
    out = []
    for m in re.finditer(r"pyConditionType", text):
        tail = clean(text[m.end():m.end() + 60])
        # first token after the marker is the condition type
        parts = [p for p in tail.split(" ") if p]
        if parts:
            out.append(parts[0])
    return out


def find_stage_changes(text: str):
    """Stage-change utility steps with their resolved target stage."""
    out = []
    for impl in ("pxChangeToNextStage", "pxChangeToPreviousStage",
                 "pxChangeToSpecifiedStage"):
        for m in re.finditer(re.escape(impl), text):
            window = clean(text[max(0, m.start() - 900): m.start() + 400])
            goto = re.search(r"pyGotoStage\s+(\w+)", window)
            target = re.search(r"TargetStage\s+(\w+)", window)
            case = re.search(
                r"(ComplianceMonitoring|RiskAssessment|LendingReview|"
                r"EscalationManagement|QualityRecommendation)", window)
            out.append({
                "impl": impl,
                "caseType": case.group(1) if case else None,
                "pyGotoStage": goto.group(1) if goto else None,
                "targetStage": target.group(1) if target else None,
            })
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    export_zip = sys.argv[1]

    all_transitions = []
    all_stage_changes = []
    flows_seen = set()
    index = {}

    for name, text, contents in load_rule_blobs(export_zip):
        if contents and not index:
            index = rule_index(contents)
        all_transitions += find_transitions(text)
        all_stage_changes += find_stage_changes(text)
        for m in re.finditer(r"([A-Za-z]+)_Flow\b", text):
            flows_seen.add(m.group(0))

    flow_keys = index.get("RULE-OBJ-FLOW", [])
    print(f"Flow rules in the export index : {len(flow_keys)}")
    print(f"Flow names recovered from bodies: {len(flows_seen)}")
    print()

    counts = defaultdict(int)
    for t in all_transitions:
        counts[t] += 1
    print("Connector transition condition types")
    for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {v:4d}  {k}")
    conditional = sum(v for k, v in counts.items()
                      if k.lower() not in ("always", "else", "action"))
    print()
    print(f"  conditional (when-guarded) transitions: {conditional}")
    print()

    print("Stage-change utility steps")
    for sc in all_stage_changes:
        tgt = sc["pyGotoStage"] or sc["targetStage"] or "-"
        print(f"  {sc['caseType'] or '?':24s} {sc['impl']:26s} target={tgt}")

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        json.dump({
            "flowRuleCount": len(flow_keys),
            "flowRuleKeys": flow_keys,
            "transitionConditionTypes": dict(counts),
            "conditionalTransitions": conditional,
            "stageChanges": all_stage_changes,
        }, open(out, "w", encoding="utf-8"), indent=2)
        print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
