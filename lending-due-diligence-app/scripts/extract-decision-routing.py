"""
Extracts the decision branch routing from Pega flow rule bodies.

Each Decision shape in a flow has one outgoing connector per decision-table
result. The connector records the result value that selects it, so the flow
rules tell us exactly what each decision result does next - including which
results terminate the flow by routing to an END shape.

The transitions region has a stable layout, so it is parsed positionally, then
**validated against the decision tables in the prototype config**: every result
value recovered here must be a real result of the decision it is attached to.
The validation rate is reported so a low-confidence extraction is obvious rather
than silently trusted.

Usage:
    python scripts/extract-decision-routing.py <TheLending.zip> \
        [--config prototype/ldd-prototype-config.json] [--json out.json]
"""

import io
import json
import os
import re
import sys
import zipfile
from collections import defaultdict

CTRL = re.compile(r"[\x00-\x1f\x7f\ufffd\uffe0-\uffff]+")

# Pega names flow shapes by type and creation order.
TASK = re.compile(
    r"^(?:Utility|Decision|Assignment|SubProcess|GenerativeAI|Integration|"
    r"Notify|Split|Join|END\d*|Start)\d*(?:_\d+)*$")
TRANSITION = re.compile(r"^Transition\d+$")
KEYWORD = {"ALWAYS", "STATUS", "ELSE", "WHEN"}

# Serialisation scaffolding that must never be mistaken for a result value.
NOISE = re.compile(r"^(?:Embed-|@Z:|Data-MO|Rule-|pz|py|px|Link-)")


def is_noise(t):
    return bool(NOISE.match(t)) or len(t) < 2 or t[0].isdigit() or "\ufffd" in t


def load_members(export_zip):
    with zipfile.ZipFile(export_zip) as outer:
        jar = next(n for n in outer.namelist() if n.endswith("rules.jar"))
        blob = outer.read(jar)
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for n in sorted(z.namelist()):
            if n.startswith("instances_") and n.endswith(".bin"):
                yield z.read(n).decode("utf-16-be", "replace")


def tokens_between(text, start, first, last):
    a = text.find(first, start)
    if a < 0:
        return []
    b = text.find(last, a)
    if b < 0:
        b = a + 20000
    seg = CTRL.sub("\n", text[a:b])
    return [t.strip() for t in seg.split("\n") if t.strip()]


def parse_transitions(toks):
    """
    Walk the flattened transition records.

    Java serialisation writes each field name once and then only values, so the
    records are positional. A task name opens or continues a group; a Transition
    id closes an edge; ALWAYS / ELSE / STATUS qualify it, and a STATUS is
    followed by the result value that selects the edge.
    """
    edges = []
    cur_from = None
    pending_to = None
    pending_id = None
    mode = None

    for t in toks:
        if TASK.match(t):
            if pending_id is None and pending_to is None:
                # A bare task after a completed edge starts a new source.
                cur_from = t if cur_from is None else cur_from
                pending_to = t
            else:
                # Two tasks in a row: the first was really the new source.
                if pending_to is not None and pending_id is None:
                    cur_from = pending_to
                pending_to = t
            continue

        if TRANSITION.match(t):
            pending_id = t
            continue

        if t in KEYWORD:
            mode = t
            if mode in ("ALWAYS", "ELSE") and pending_id:
                edges.append({"from": cur_from, "to": pending_to,
                              "id": pending_id, "when": mode, "result": None})
                pending_to, pending_id, mode = None, None, None
            continue

        if mode == "STATUS" and pending_id and not is_noise(t):
            edges.append({"from": cur_from, "to": pending_to, "id": pending_id,
                          "when": "STATUS", "result": t})
            pending_to, pending_id, mode = None, None, None
            continue

        if pending_id and pending_to and t not in KEYWORD and not is_noise(t):
            # Bare result value: a STATUS edge whose keyword was elided because
            # the field name was already written out by an earlier record.
            edges.append({"from": cur_from, "to": pending_to, "id": pending_id,
                          "when": "STATUS", "result": t})
            pending_to, pending_id = None, None

    return edges


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    export_zip = sys.argv[1]

    cfg_path = "prototype/ldd-prototype-config.json"
    if "--config" in sys.argv:
        cfg_path = sys.argv[sys.argv.index("--config") + 1]
    cfg = json.load(open(cfg_path, encoding="utf-8")) if os.path.exists(cfg_path) else None

    # decision name -> set of legal result values
    legal = {}
    if cfg:
        for dec in cfg["decisions"]:
            vals = {r["result"] for r in dec["rows"] if r.get("result")}
            if dec.get("otherwise"):
                vals.add(dec["otherwise"])
            legal[dec["name"]] = vals

    # Map each flow to the stage it implements, and thus to the decision table
    # that stage's Decision step names. Flow name is the stage name uppercased
    # with spaces removed, e.g. "Issue Assessment" -> ISSUEASSESSMENT_FLOW.
    flow_decision = {}
    flow_stage = {}
    if cfg:
        for ct in cfg["caseTypes"]:
            for st in ct["stages"]:
                flow = re.sub(r"[^A-Z0-9]", "", st["name"].upper()) + "_FLOW"
                key = (re.sub(r"[^A-Z0-9]", "", ct["code"].upper()), flow)
                flow_stage[key] = (ct["code"], st["code"], st["name"])
                for s in st["steps"]:
                    if s.get("kind") == "Decision" and s.get("impl"):
                        flow_decision[key] = s["impl"]

    results = {}
    for text in load_members(export_zip):
        for m in re.finditer(
                r"RULE-OBJ-FLOW MYORG-THELENDING-WORK-([A-Z]+) ([A-Z0-9_]+_FLOW)", text):
            case_type, flow = m.group(1), m.group(2)
            toks = tokens_between(text, m.start(), "pyFromTasks", "pyToolBarSettings")
            if not toks:
                continue
            edges = parse_transitions(toks)
            if not edges:
                continue
            # The same flow key appears in history records too; keep the richest.
            key = (case_type, flow)
            if key not in results or len(edges) > len(results[key]["edges"]):
                results[key] = {"caseTypeUpper": case_type, "flow": flow, "edges": edges}
    results = list(results.values())

    # Validate every STATUS result against **the decision table that this flow's
    # stage actually uses** - not against a pooled set. A branch survives only if
    # its result is a real result of its own decision, so what remains is proven
    # rather than merely plausible.
    raw_status = 0
    unmapped = 0
    for r in results:
        key = (r["caseTypeUpper"], r["flow"])
        dec = flow_decision.get(key)
        r["decision"] = dec
        r["stage"] = flow_stage.get(key)
        allowed = {x.strip().lower() for x in legal.get(dec, set())} if dec else set()
        if not dec:
            unmapped += 1
        keep = []
        for e in r["edges"]:
            if e["when"] != "STATUS":
                keep.append(e)
                continue
            raw_status += 1
            if e["result"] and e["result"].strip().lower() in allowed:
                keep.append(e)
        r["edges"] = keep

    status_edges = [e for r in results for e in r["edges"] if e["when"] == "STATUS"]

    print(f"Flows with a transition graph : {len(results)}")
    print(f"  mapped to a stage decision  : {len(results) - unmapped}")
    print(f"Edges retained                : {sum(len(r['edges']) for r in results)}")
    print(f"  unconditional (ALWAYS/ELSE) : {sum(1 for r in results for e in r['edges'] if e['when'] != 'STATUS')}")
    print(f"  result-routed (STATUS)      : {len(status_edges)} kept of {raw_status} "
          f"candidates - validated per decision table")
    print()

    # Terminal results: a STATUS edge landing on an END shape ends the flow.
    terminal = defaultdict(set)
    for r in results:
        for e in r["edges"]:
            if e["when"] == "STATUS" and e["result"] and (e["to"] or "").startswith("END"):
                terminal[(r["caseTypeUpper"], r["flow"])].add(e["result"])

    print("Decision results that terminate their flow (skip the rest of the stage)")
    if terminal:
        for (ct, flow), vals in sorted(terminal.items()):
            print(f"  {ct:24s} {flow:30s} {', '.join(sorted(vals))}")
    else:
        print("  (none)")
    print()

    print("Result-routed branches by flow")
    for r in sorted(results, key=lambda x: (x["caseTypeUpper"], x["flow"])):
        se = [e for e in r["edges"] if e["when"] == "STATUS" and e["result"]]
        if not se:
            continue
        st = r.get("stage")
        label = f"{st[0]} / {st[2]}" if st else f"{r['caseTypeUpper']} / {r['flow']}"
        print(f"  {label}   [decision: {r.get('decision')}]")
        for e in se:
            term = "  (ends the stage)" if (e["to"] or "").startswith("END") else ""
            print(f"      {e['result']:26s} -> {e['to']}{term}")

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        json.dump({
            "flows": results,
            "terminalResults": {f"{k[0]}/{k[1]}": sorted(v) for k, v in terminal.items()},
        }, open(out, "w", encoding="utf-8"), indent=2)
        print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
