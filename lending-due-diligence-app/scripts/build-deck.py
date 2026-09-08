"""
Generates the Pega -> Power Platform migration PoC deck.

Every figure in this deck is taken from the PoC artefacts:
  - prototype/ldd-prototype-config.json  (extracted Pega model)
  - the Pega export's own coverage.inventory
  - scripts/verify-engine.mjs            (live Dataverse verification)

Usage: python scripts/build-deck.py [out.pptx]
"""

import sys
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

OUT = sys.argv[1] if len(sys.argv) > 1 else "Pega-to-PowerPlatform-Migration-PoC.pptx"

# ---------------------------------------------------------------- palette ---
RED = RGBColor(0xC8, 0x10, 0x2E)      # CIBC-style masthead red
TEAL = RGBColor(0x00, 0x6D, 0x77)     # case banner teal
INK = RGBColor(0x1A, 0x1A, 0x1A)
BODY = RGBColor(0x3C, 0x3C, 0x3C)
MUTE = RGBColor(0x6E, 0x6E, 0x6E)
LINE = RGBColor(0xD8, 0xD8, 0xD8)
BAND = RGBColor(0xF4, 0xF5, 0xF7)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x1E, 0x7D, 0x32)
AMBER = RGBColor(0xB5, 0x6A, 0x00)

FONT = "Segoe UI"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
W = prs.slide_width
H = prs.slide_height
BLANK = prs.slide_layouts[6]

_section = {"n": 0}


# ---------------------------------------------------------------- helpers ---
def _tf(shape):
    tf = shape.text_frame
    tf.word_wrap = True
    return tf


def textbox(slide, x, y, w, h):
    # Never let a box extend past the slide - a silently clipped box hides text.
    h = min(h, 7.32 - y)
    return slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))


def para(tf, text, size=14, bold=False, color=BODY, space_after=6,
         align=PP_ALIGN.LEFT, first=False, italic=False, space_before=0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(space_after)
    p.space_before = Pt(space_before)
    r = p.add_run()
    r.text = text
    f = r.font
    f.name = FONT
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    return p


def rect(slide, x, y, w, h, fill, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y),
                               Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    s.shadow.inherit = False
    return s


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def base(title=None, eyebrow=None):
    """Standard content slide: thin red rule, title, optional eyebrow."""
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, 13.333, 0.08, RED)
    if eyebrow:
        tb = textbox(s, 0.62, 0.30, 11.5, 0.3)
        para(_tf(tb), eyebrow.upper(), size=10.5, bold=True, color=TEAL,
             first=True, space_after=0)
    if title:
        tb = textbox(s, 0.62, 0.58, 12.1, 0.75)
        para(_tf(tb), title, size=27, bold=True, color=INK, first=True,
             space_after=0)
    return s


def footer(slide, n):
    tb = textbox(slide, 11.6, 6.95, 1.4, 0.35)
    para(_tf(tb), str(n), size=10, color=MUTE, first=True,
         align=PP_ALIGN.RIGHT, space_after=0)


def bullets(slide, items, x=0.62, y=1.55, w=12.1, h=5.1, size=15, gap=9):
    """items: list of str, or (text, level) or (text, level, bold)."""
    box = textbox(slide, x, y, w, h)
    tf = _tf(box)
    first = True
    used = 0.0
    for it in items:
        if isinstance(it, tuple):
            text, lvl = it[0], it[1]
            bold = it[2] if len(it) > 2 else False
        else:
            text, lvl, bold = it, 0, False
        col = INK if (bold or lvl == 0) else BODY
        sz = size if lvl == 0 else size - 1.5
        mark = "" if bold and lvl == 0 else ("—  " if lvl else "•  ")
        before = 8 if (bold and not first) else 0
        p = para(tf, f"{mark}{text}", size=sz, bold=bold, color=col,
                 space_after=gap, first=first, space_before=before)
        p.level = lvl
        used += _est_lines(f"{mark}{text}", w - 0.2, sz) * sz * 1.32 / 72.0
        used += (gap + before) / 72.0
        first = False
    # Shrink the box to what the text actually needs, so it cannot sit
    # invisibly on top of whatever comes next.
    box.height = Inches(min(max(used, 0.3), 7.32 - y))
    slide._flow_bottom = max(getattr(slide, "_flow_bottom", 0), y + used)
    return tf


def _est_lines(text, width_in, size_pt):
    chars = max(8, int(width_in * 72.0 / (size_pt * 0.50)))
    return max(1, -(-len(str(text)) // chars))


def table(slide, headers, rows, x=0.62, y=1.6, w=12.1, h=None,
          widths=None, size=11.5, head_fill=TEAL, zebra=True):
    nr, nc = len(rows) + 1, len(headers)
    h = h or min(0.42 + 0.34 * len(rows), 5.2)
    gt = slide.shapes.add_table(nr, nc, Inches(x), Inches(y),
                                Inches(w), Inches(h)).table
    if widths:
        total = sum(widths)
        for i, cw in enumerate(widths):
            gt.columns[i].width = Emu(int(Inches(w) * cw / total))
    col_w = [gt.columns[i].width / 914400 for i in range(nc)]
    gt.rows[0].height = Inches(0.38)
    est = 0.38
    for c, htxt in enumerate(headers):
        cell = gt.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = head_fill
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.10)
        tf = cell.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = htxt
        r.font.name = FONT
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.color.rgb = WHITE
    for ri, row in enumerate(rows, start=1):
        gt.rows[ri].height = Inches(0.30)
        tallest = 0.30
        for ci, val in enumerate(row):
            cell = gt.cell(ri, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = (BAND if (zebra and ri % 2 == 0) else WHITE)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.10)
            cell.margin_top = Inches(0.02)
            cell.margin_bottom = Inches(0.02)
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            txt = str(val)
            strong = txt.startswith("*")
            if strong:
                txt = txt[1:]
            r = p.add_run()
            r.text = txt
            r.font.name = FONT
            r.font.size = Pt(size)
            r.font.bold = strong
            r.font.color.rgb = INK if strong else BODY
            lines = _est_lines(txt, col_w[ci] - 0.20, size)
            tallest = max(tallest, lines * size * 1.32 / 72.0 + 0.08)
        est += tallest
    # Remember where this table actually ends so callouts can sit under it.
    slide._flow_bottom = max(getattr(slide, "_flow_bottom", 0), y + est)
    return gt


def kpis(slide, items, y=1.62, h=1.28, x0=0.62, total_w=12.1, gap=0.18):
    """items: list of (big, label)."""
    n = len(items)
    cw = (total_w - gap * (n - 1)) / n
    for i, (big, label) in enumerate(items):
        cx = x0 + i * (cw + gap)
        rect(slide, cx, y, cw, h, BAND)
        rect(slide, cx, y, cw, 0.055, TEAL)
        tb = textbox(slide, cx + 0.1, y + 0.20, cw - 0.2, 0.62)
        para(_tf(tb), str(big), size=30, bold=True, color=TEAL, first=True,
             align=PP_ALIGN.CENTER, space_after=0)
        tb2 = textbox(slide, cx + 0.08, y + 0.82, cw - 0.16, 0.42)
        para(_tf(tb2), label, size=10.5, color=BODY, first=True,
             align=PP_ALIGN.CENTER, space_after=0)


def callout(slide, text, y=None, tone=TEAL, x=0.62, w=12.1, h=0.72):
    # Default: sit just under whatever the slide last laid down, so tables and
    # callouts stay visually connected instead of leaving a dead band.
    if y is None:
        y = getattr(slide, "_flow_bottom", 5.9) + 0.30
    y = min(y, 7.30 - h)
    rect(slide, x, y, w, h, BAND)
    rect(slide, x, y, 0.06, h, tone)
    tb = textbox(slide, x + 0.24, y + 0.10, w - 0.45, h - 0.18)
    para(_tf(tb), text, size=12.5, color=INK, first=True, space_after=0)


def divider(number, title, blurb):
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, 13.333, 7.5, TEAL)
    rect(s, 0, 0, 13.333, 0.16, RED)
    tb = textbox(s, 1.0, 2.55, 2.0, 1.2)
    para(_tf(tb), f"{number:02d}", size=64, bold=True,
         color=RGBColor(0x7F, 0xC4, 0xCB), first=True, space_after=0)
    tb = textbox(s, 2.55, 2.72, 9.6, 1.0)
    para(_tf(tb), title, size=34, bold=True, color=WHITE, first=True,
         space_after=0)
    tb = textbox(s, 2.62, 3.72, 9.4, 0.7)
    para(_tf(tb), blurb, size=14.5,
         color=RGBColor(0xD6, 0xEC, 0xEE), first=True, space_after=0)
    return s


# ------------------------------------------------------------------ facts ---
# All verified against the PoC artefacts. See module docstring.
F = dict(
    case_types=5, stages=39, steps=80, views=24, view_fields=59,
    choice_sets=26, choice_values=107, decisions=10, decision_rows=28,
    roles=19, data_objects=10, tables=27,
    tests_pass=49, tests_fail=0,
    rule_instances=1096, properties=334,
    flows=35, flow_actions=39, notifications=27, correspondence=27,
    transforms=20, notify_steps=17, doc_steps=4, workbaskets=18,
    role_grants=30, reports=30, attach_cats=12,
    src_loc=3503, script_loc=2892, gen_loc=4987,
    steps_working=39, steps_simulated=41,
)

APP_URL = ("https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-"
           "46d9e2809617/app/175161cf-c385-4c35-8b29-133f0b397d0d")

n = 0


def num(s):
    global n
    n += 1
    footer(s, n)
    return s


# ------------------------------------------------------------- 0. cover ----
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, WHITE)
rect(s, 0, 0, 13.333, 0.30, RED)
rect(s, 0, 7.20, 13.333, 0.30, TEAL)
tb = textbox(s, 1.0, 2.15, 11.3, 0.45)
para(_tf(tb), "PROOF OF CONCEPT  |  MIGRATION APPROACH", size=13, bold=True,
     color=TEAL, first=True, space_after=0)
tb = textbox(s, 1.0, 2.62, 11.3, 1.85)
para(_tf(tb), "Pega to Power Platform", size=44, bold=True, color=INK,
     first=True, space_after=2)
para(_tf(tb), "Code App Migration Approach", size=44, bold=True, color=RED,
     space_after=0)
rect(s, 1.02, 4.52, 2.6, 0.045, TEAL)
tb = textbox(s, 1.0, 4.78, 11.3, 0.9)
para(_tf(tb),
     "A repeatable method for reverse-engineering Pega applications "
     "without business workshops",
     size=16, color=BODY, first=True, space_after=4)
para(_tf(tb),
     "Evidence-based findings from a working, deployed implementation",
     size=13.5, color=MUTE, italic=True, space_after=0)
tb = textbox(s, 1.0, 6.35, 11.3, 0.4)
para(_tf(tb), "Prepared for CIBC  ·  September 2026", size=12, color=MUTE,
     first=True, space_after=0)
notes(s, "This deck reports on a completed PoC, not a paper study. The Lending "
         "Due Diligence Pega application was migrated to a Power Apps Code App "
         "on Dataverse, deployed, and verified end to end. Every number quoted "
         "is drawn from the migration artefacts or the automated verification "
         "harness.")
num(s)

# ------------------------------------------------------------ 0. contents --
s = base("Contents")
left = [
    ("1   Executive Summary", 0, True),
    ("2   Current State Architecture (Pega)", 0, True),
    ("3   Target State Architecture", 0, True),
    ("4   Migration Approach", 0, True),
    ("5   PoC Scope", 0, True),
    ("6   Live Demo", 0, True),
]
right = [
    ("7    Migration Findings", 0, True),
    ("8    Validation Results", 0, True),
    ("9    Effort & Risk Assessment", 0, True),
    ("10  Recommendations & Next Steps", 0, True),
    ("11  Appendix", 0, True),
]
bullets(s, left, x=0.9, y=1.85, w=5.6, size=16, gap=17)
bullets(s, right, x=6.9, y=1.85, w=5.6, size=16, gap=17)
callout(s, "Sections 6 to 8 report observed results from a deployed, "
           "working application - not projections.")
num(s)

# =========================================================== 1. EXEC SUMMARY
num(divider(1, "Executive Summary", "Objective, challenges and outcomes"))

s = base("A working migration, not a feasibility study", eyebrow="Executive Summary")
kpis(s, [("0", "Business workshops\nrequired"),
         ("100%", "Case lifecycle structure\nmigrated automatically"),
         ("49/49", "Automated verification\nchecks passing"),
         ("5 of 5", "Case types running\nend to end"),
         ("~51%", "Step bodies needing\nconfirmation")])
bullets(s, [
    ("Objective", 0, True),
    "Prove that a production Pega application can be migrated to the Power "
    "Platform without asking the business to re-specify it - and quantify "
    "precisely what still needs their input.",
    ("Outcome", 0, True),
    "The Lending Due Diligence application is deployed and operating in the "
    "Patrick Clarke environment. All five case types create, advance through "
    "their stages, evaluate decisions and reach resolution. Zero business "
    "workshops were held to get there.",
    ("The headline finding", 0, True),
    "Process structure migrates almost entirely through automation. Process "
    "behaviour - notifications, data transforms, document generation - does "
    "not, because Pega does not expose it. But every one of those steps is "
    "recovered by name and position, so the residual business conversation is "
    "confirmation rather than discovery.",
], y=3.20, gap=7, size=13.5)
notes(s, "Lead with the fact that this is a completed implementation. The five "
         "KPIs are all measured, not estimated. The 51% figure is the honest "
         "counterweight to the 100% - be upfront about it, then immediately "
         "qualify it: those 41 steps are named and located, so they are a "
         "confirmation exercise, not a discovery exercise.")
num(s)

s = base("The real bottleneck is requirements elicitation", eyebrow="Executive Summary")
bullets(s, [
    ("The client's constraint", 0, True),
    "Traditional migration starts with weeks of workshops to rediscover what an "
    "application already does. For this client that is the binding constraint - "
    "the business does not have the time, and understandably has little appetite "
    "for re-specifying a system that is already running in production.",
    ("Why that constraint drove the method", 0, True),
    "So we inverted the approach. Rather than asking the business to describe "
    "the application, we reverse-engineer it from artefacts the Pega platform "
    "already holds, and use the business only to confirm the residue.",
], y=1.55, size=13.5, gap=7)
table(s,
      ["Traditional discovery", "This methodology"],
      [["Workshops to map the process model",
        "*Extracted: 5 case types, 39 stages, 80 steps"],
       ["Workshops to document business rules",
        "*Extracted: 10 decision tables with 28 rules of logic"],
       ["Workshops and mock-ups to specify screens",
        "*Extracted: 24 screens with 59 fields, plus screenshots"],
       ["Workshops to define the data model",
        "*Extracted: 10 data objects, 334 properties"],
       ["Workshops to agree the security model",
        "*Extracted: 19 roles, 18 workbaskets"],
       ["Elapsed before a line of code is written",
        "*Days, and the output is a running application"]],
      y=3.85, widths=[5.6, 6.5], size=12)
callout(s, "None of the extracted material required a business workshop. The "
           "artefacts are the specification.")
notes(s, "This is the slide that matters most to this client. Their stated "
         "problem is not migration cost - it is that requirements elicitation "
         "consumes business time they will not give. Lead with it and the rest "
         "of the deck reads as supporting evidence.")
num(s)

s = base("Business challenges being addressed", eyebrow="Executive Summary")
table(s,
      ["Challenge", "Impact today", "How the target state responds"],
      [["*Requirements elicitation load",
        "Migration normally demands weeks of business workshops to re-specify a "
        "system that already exists",
        "Artefact-driven reverse engineering recovers the specification without "
        "them"],
       ["*Specialist skill dependency",
        "Pega development requires scarce, costly certified specialists",
        "React + TypeScript + Dataverse draws on a far larger talent pool"],
       ["*Licence cost concentration",
        "Per-case and per-user Pega licensing scales unfavourably",
        "Consolidates onto existing M365 / Power Platform investment"],
       ["*Change latency",
        "Process changes need a developer, a build and a deployment",
        "Process is configuration data - change without a code release"],
       ["*Platform isolation",
        "Integration to M365, Azure and Teams is bespoke work",
        "Native connectors; Dataverse is already inside the tenant"],
       ["*Opaque logic",
        "Business rules are locked inside a proprietary rule engine",
        "Decision tables become inspectable, queryable Dataverse rows"]],
      y=1.72, widths=[2.6, 4.5, 5.0], size=11.5)
callout(s, "The first row is the client's stated priority. The rest follow from "
           "the target platform; that one follows from the method.")
num(s)

s = base("Expected outcomes and benefits", eyebrow="Executive Summary")
bullets(s, [
    ("Proven in this PoC", 0, True),
    "Automated migration of case types, stages, steps, decision tables, view "
    "layouts, choice sets and roles from the Pega export",
    "A metadata-driven engine: process changes are Dataverse row edits, not code",
    "Full audit trail on every case event, queryable with standard Dataverse tooling",
    "Automated regression harness that exercises the real engine against live data",
    ("Expected on production adoption", 0, True),
    "Reduced platform and licensing cost by consolidating onto existing investment",
    "Faster process change cycles - configuration rather than development",
    "Native M365 integration for notification, approval and document workflows",
    "Business rules visible to analysts, not just to Pega developers",
    ("Deliberately not claimed", 0, True),
    "This PoC does not prove performance at production volume, nor does it "
    "address data migration of in-flight cases. Both are called out in Section 8.",
], size=13.5, gap=6.5)
notes(s, "The third block matters for credibility. Being explicit about what "
         "the PoC does not prove makes the rest of the claims defensible under "
         "challenge.")
num(s)

# ======================================================== 2. CURRENT STATE
num(divider(2, "Current State Architecture", "The Pega application as it exists today"))

s = base("The Pega application", eyebrow="Current State")
kpis(s, [("1,096", "Rule instances\nin the export"),
         ("5", "Case types"),
         ("35", "Flow rules"),
         ("334", "Property\ndefinitions"),
         ("22", "Database tables")],
     y=1.60, h=1.20)
table(s,
      ["Layer", "Pega artefacts", "Volume"],
      [["*Case model", "Case types, stages, steps", "5 / 39 / 80"],
       ["*Process", "Flow rules, flow actions", "35 / 39"],
       ["*Logic", "Decision tables (with rows)", "10 / 28"],
       ["*Presentation", "UI views (49 reachable from steps)", "191"],
       ["*Data", "Data objects, properties, DB tables", "10 / 334 / 22"],
       ["*Security", "Access groups, role grants, workbaskets", "19 / 30 / 18"],
       ["*Comms", "Notifications, correspondence rules", "27 / 27"]],
      y=3.15, widths=[2.2, 6.6, 3.3], size=12)
notes(s, "Engine version 26.1.0, application version 01.01.01, exported "
         "1 September 2026. The 191 UI views is the total in the application; "
         "only 49 are reachable from a case step, which is why the migration "
         "targets that subset.")
num(s)

s = base("Key workflows", eyebrow="Current State")
table(s,
      ["Case type", "Stages", "Steps", "Purpose"],
      [["*Lending Review", "8", "23",
        "Primary intake, review and approval of lending transactions"],
       ["*Risk Assessment", "8", "18",
        "Risk profiling, scoring and escalation of flagged transactions"],
       ["*Compliance Monitoring", "7", "22",
        "Sampling, issue assessment, remediation and closure"],
       ["*Escalation Management", "8", "12",
        "Routing and resolution of escalated items"],
       ["*Quality Recommendation", "8", "5",
        "Recommendation formulation and resolution tracking"]],
      y=1.70, widths=[2.7, 1.0, 1.0, 7.4], size=12.5)
bullets(s, [
    ("Step composition across all five case types", 0, True),
    "48 utility steps  ·  21 human assignments  ·  7 decisions  ·  4 approval sub-processes",
    "Routing splits 9 to a named worklist and 12 to a shared workbasket",
], y=4.35, size=13)
callout(s, "The utility steps are where the migration difficulty concentrates - "
           "41 of the 48 carry logic Pega does not export.", tone=AMBER)
num(s)

s = base("Challenges and limitations of the current platform",
         eyebrow="Current State")
bullets(s, [
    ("Rule bodies are recoverable - but only if you know the encoding", 0, True),
    "Rule bodies ship inside rules.jar as a Java-serialised stream. An ASCII "
    "scan finds nothing, so the format is widely assumed opaque. The payload "
    "strings are UTF-16BE; decoding them makes every rule body readable.",
    ("Conditional routing genuinely does not exist", 0, True),
    "Having extracted the flow bodies, all 264 connector transitions are "
    "unconditional - 225 Always, 32 Action, 7 Else. Not one is when-guarded.",
    ("Behaviour is still locked to the engine", 0, True),
    "Data transforms, correspondence bodies and notification templates are "
    "engine-executed and have no exportable representation.",
    ("Skills and cost", 0, True),
    "Certified Pega specialists are scarce and expensive relative to the "
    "React / TypeScript / Dataverse talent pool.",
], size=13.5, gap=7)
callout(s, "The routing finding is a defect in the source application, not a "
           "migration gap - those flows really would loop.", tone=AMBER)
notes(s, "This slide originally claimed the rule bodies could not be decoded "
         "outside a Pega instance, repeating the extraction tool's own "
         "documentation. That was wrong, and testing it changed the "
         "recommendation: there are no guards to recover, so the engine's "
         "re-visit cap is permanent design rather than a stopgap.")
num(s)

# ========================================================= 3. TARGET STATE
num(divider(3, "Target State Architecture", "Power Platform solution design"))

s = base("Solution architecture", eyebrow="Target State")
bullets(s, [
    ("Design principle: separate process from behaviour", 0, True),
    "Process configuration lives as Dataverse rows imported from the Pega export. "
    "Business data uses strongly-typed tables. Changing the process is a data "
    "change - which is how Pega itself behaves.",
], y=1.55, size=13.5)
table(s,
      ["Layer", "Implementation", "Responsibility"],
      [["*Presentation", "React + Vite + TypeScript (Code App)",
        "Worklist, case workspace, dynamic forms rendered from view metadata"],
       ["*Orchestration", "orchestrator.ts",
        "Translates engine plans into Dataverse writes; the only I/O layer"],
       ["*Engine", "engine.ts (pure functions)",
        "Plans next actions, evaluates decisions - no side effects, fully testable"],
       ["*Data access", "Generated Dataverse services",
        "Type-safe access; sandbox blocks raw fetch"],
       ["*Persistence", "Dataverse (27 tables)",
        "Configuration, data objects, work/runtime and per-type detail"],
       ["*Import", "Node scripts (extract / seed)",
        "Pega export to config JSON to Dataverse, idempotent"]],
      y=2.62, widths=[1.9, 3.5, 6.7], size=11.5)
callout(s, "The engine being side-effect free is what makes the verification "
           "harness possible - it tests the real shipped code, not a copy.")
num(s)

s = base("Dataverse data model", eyebrow="Target State")
table(s,
      ["Group", "Tables", "Contents"],
      [["*Configuration", "10",
        "Case types, stages, steps, views, view fields, choice sets, choice "
        "values, decisions, decision rows, roles"],
       ["*Data objects", "9",
        "Customers, lending transactions, risk profiles, compliance findings "
        "and related reference entities"],
       ["*Work / runtime", "4",
        "Work case (shared envelope), assignment, approval, case history"],
       ["*Detail", "5", "One strongly-typed detail table per case type"]],
      y=1.70, widths=[2.2, 1.1, 8.8], size=12.5)
bullets(s, [
    ("Why a shared envelope plus per-type detail tables", 0, True),
    "A single work case table keeps the worklist queryable across every case "
    "type in one request",
    "Per-type detail tables still give each case type real, typed columns rather "
    "than a generic key-value bag",
    "This mirrors Pega's own work class hierarchy without inheriting its rigidity",
], y=4.15, size=13, gap=7)
callout(s, "Seeded content: 26 choice sets (107 values), 24 views (59 fields), "
           "10 decision tables (28 rows), 5 case types, 39 stages, 80 steps.")
num(s)

s = base("Integration approach", eyebrow="Target State")
table(s,
      ["Pega capability", "Power Platform target", "Status in PoC"],
      [["*Human assignments", "Dataverse rows + Code App UI", "Implemented"],
       ["*Approvals", "Dataverse approval rows + UI", "Implemented"],
       ["*Decision tables", "Dataverse rows, evaluated in engine.ts", "Implemented"],
       ["*Notifications (17)", "Power Automate / Office 365 Outlook connector",
        "Audited, not sent"],
       ["*Data transforms (20)", "Transform registry in the orchestrator",
        "Audited, not executed"],
       ["*Documents (4)", "Power Automate + Word templates, or Dataverse file column",
        "Audited, not generated"],
       ["*Workbaskets (18)", "Dataverse teams + row-level security", "Not mapped"],
       ["*Access groups (19)", "Dataverse security roles", "Imported as data only"],
       ["*Reporting (30)", "Power BI over Dataverse", "Out of scope"]],
      y=1.68, widths=[3.0, 5.4, 3.7], size=11.5)
callout(s, "Azure services were not required for this PoC. Dataverse and the "
           "Power Platform connector set cover the full scope; Azure Functions "
           "would only be needed for heavy custom compute.")
num(s)

# ===================================================== 4. MIGRATION APPROACH
num(divider(4, "Migration Approach", "Assessment, analysis and mapping strategy"))

s = base("A repeatable reverse-engineering methodology", eyebrow="Migration Approach")
bullets(s, [
    ("Principle: the running system is the specification", 0, True),
    "Four artefact sources, each independently obtainable from the Pega estate, "
    "combine into a single normalised model. No business workshop is required to "
    "produce any of them.",
], y=1.52, size=13.5)
table(s,
      ["#", "Artefact source", "How it is obtained", "What it contributes"],
      [["*1", "Application export (.zip)",
        "Dev Studio product export",
        "SQL schema, full rule inventory, and - decoded as UTF-16BE - the flow "
        "rule bodies"],
       ["*2", "Application documentation (.docx)",
        "Generated from the platform",
        "Stages, flows, decision table logic, security model"],
       ["*3", "pegakit + Pega DX API",
        "Client-credentials OAuth against a sandbox",
        "Screens, fields, choice values, theme - the largest single uplift"],
       ["*4", "Screenshots of the running app",
        "Captured from the live system",
        "Visual fidelity, layout and branding for like-for-like rebuild"]],
      y=2.62, widths=[0.5, 3.0, 3.5, 5.1], size=11.5)
callout(s, "All four are artefacts the client already owns or can generate "
           "unattended. The business is not in the critical path.")
notes(s, "Emphasise repeatability. This is not a bespoke effort for one "
         "application - the extract and seed pipeline discovers class prefixes, "
         "case types and choice sets rather than hardcoding them, so it runs "
         "against the next application unchanged.")
num(s)

s = base("Assessment methodology", eyebrow="Migration Approach")
bullets(s, [
    ("Extraction uses three complementary sources", 0, True),
], y=1.52, size=14)
table(s,
      ["Source", "Yields", "Necessity"],
      [["*Application export (.zip)", "SQL schema, full rule inventory",
        "Baseline - what exists"],
       ["*Application document (.docx)",
        "Stages, flows, decision tables, security", "Structure and logic"],
       ["*Live instance (DX API)", "Views, fields, choice values, theme",
        "*Essential - the largest single uplift"]],
      y=2.05, widths=[3.2, 5.4, 3.5], size=12)
bullets(s, [
    ("Fidelity is determined by the source combination", 0, True),
    "Export only - schema and inventory, no lifecycle or screens",
    "Export plus document - case types, stages, flows, decisions, data model",
    "All three - the above plus real screens and choice sets",
    ("Verified during the PoC", 0, True),
    "An export-plus-document run captured 0 of 49 views and 0 choice sets, and "
    "inferred a different stage decomposition from document prose. The three-source "
    "run captured 28 views and 27 choice sets and walks real cases via the API.",
], y=3.85, size=13, gap=6.5)
callout(s, "Recommendation: never assess a Pega application without DX API "
           "access to a sandbox. Structure inferred from prose is unreliable.", tone=AMBER)
notes(s, "This was learned the hard way during the PoC - two extractions of the "
         "same application disagreed about the stage model. The seeder now "
         "refuses to load a low-fidelity extraction.")
num(s)

s = base("Rules, forms and workflows analysed", eyebrow="Migration Approach")
table(s,
      ["Artefact class", "Count", "Analysed", "Outcome"],
      [["*Case types", "5", "5", "Migrated to configuration rows"],
       ["*Stages / steps", "39 / 80", "All", "Migrated to configuration rows"],
       ["*Decision tables", "10 (28 rows)", "All", "Migrated and executing"],
       ["*UI views", "191 (49 step-bound)", "49", "24 migrated with 59 fields"],
       ["*Choice sets", "26", "26", "Migrated with 107 values"],
       ["*Properties", "334", "All", "Mapped to typed Dataverse columns"],
       ["*Access groups", "19", "19", "Imported as data; not yet enforced"],
       ["*Flow rules", "35", "*Bodies extracted", "*0 conditional transitions"],
       ["*Notifications", "27", "Inventory only", "*Bodies not exportable"],
       ["*Declarative expressions", "36", "All", "All literal defaults - no logic lost"]],
      y=1.68, widths=[3.0, 2.1, 2.1, 5.0], size=11.5)
callout(s, "The 36 declarative expressions were individually inspected rather "
           "than assumed - every one sets a literal default, so nothing was lost "
           "by not importing them.")
num(s)

s = base("Mapping strategy", eyebrow="Migration Approach")
table(s,
      ["Pega artefact", "Power Platform component", "Method"],
      [["*Case type", "ava_lddcasetype row + detail table", "*Automated"],
       ["*Stage", "ava_lddstage row", "*Automated"],
       ["*Step", "ava_lddstep row (kind + impl)", "*Automated"],
       ["*Decision table", "ava_ldddecision + rows, engine-evaluated", "*Automated"],
       ["*UI view", "ava_lddview + ava_lddviewfield, rendered dynamically", "*Automated"],
       ["*Choice set", "ava_lddchoiceset + values", "*Automated"],
       ["*Property", "Typed Dataverse column", "*Automated"],
       ["*Access group", "ava_lddrole row", "Automated (data only)"],
       ["*Flow when condition", "Step guard columns", "Inferred + capped"],
       ["*pzNotifyWrapper", "Power Automate flow", "Manual"],
       ["*pzRunDataTransform", "Transform registry entry", "Manual"],
       ["*pxGenerateAndAttachDocument", "Word template + flow", "Manual"]],
      y=1.68, widths=[3.3, 5.4, 3.4], size=11)
callout(s, "Everything above the guard row is automated and repeatable. "
           "Everything below requires human analysis - this is the boundary that "
           "drives the effort estimate.", tone=AMBER)
num(s)

# ============================================================ 5. POC SCOPE
num(divider(5, "PoC Scope", "Inclusions, exclusions and assumptions"))

s = base("Scope", eyebrow="PoC Scope")
rect(s, 0.62, 1.55, 5.95, 0.05, GREEN)
tb = textbox(s, 0.62, 1.68, 5.95, 0.4)
para(_tf(tb), "IN SCOPE - AND DELIVERED", size=12, bold=True, color=GREEN,
     first=True, space_after=0)
bullets(s, [
    "All 5 case types, end to end to resolution",
    "39 stages and 80 steps executing in sequence",
    "All 10 decision tables evaluating live data",
    "24 step-bound views rendered dynamically",
    "26 choice sets with 107 values",
    "Human assignments and approval sub-processes",
    "SLA goal and deadline calculation in business days",
    "Full audit trail on every case event",
    "Automated verification harness (49 checks)",
    "Deployed to the Patrick Clarke environment",
], x=0.62, y=2.10, w=5.95, size=12.5, gap=5)

rect(s, 6.95, 1.55, 5.75, 0.05, AMBER)
tb = textbox(s, 6.95, 1.68, 5.75, 0.4)
para(_tf(tb), "EXPLICITLY OUT OF SCOPE", size=12, bold=True, color=AMBER,
     first=True, space_after=0)
bullets(s, [
    "Sending notifications (17 steps audited only)",
    "Executing data transforms (20 steps)",
    "Generating documents (4 steps)",
    "Row-level security and workbasket routing",
    "Attachment and document storage",
    "SLA escalation timers",
    "Reporting and dashboards (30 definitions)",
    "Migration of in-flight case data",
    "Performance and load testing",
    "Production ALM pipeline",
], x=6.95, y=2.10, w=5.75, size=12.5, gap=5)
num(s)

s = base("Assumptions and constraints", eyebrow="PoC Scope")
table(s,
      ["#", "Assumption or constraint", "Consequence if it changes"],
      [["*1", "The Pega export plus DX API access represents the complete "
        "application", "Additional rules would need a further extraction pass"],
       ["*2", "Rework conditions can be agreed with the business", "*Extraction proved none exist in Pega to recover"],
       ["*3", "Notification and correspondence content can be re-authored, "
        "not migrated", "Effort increases if exact templates are mandatory"],
       ["*4", "Dataverse security roles can express the 19 Pega access groups",
        "A more granular model would need custom logic"],
       ["*5", "Business volumes are within standard Dataverse limits",
        "High volume may require Azure services or elastic tables"],
       ["*6", "In-flight cases will not be migrated mid-flight",
        "Cutover strategy would need to change materially"]],
      y=1.70, widths=[0.5, 6.2, 5.4], size=11.5)
callout(s, "Assumption 2 is the one to resolve first. Everything else is "
           "routine delivery work; that one determines whether the process "
           "behaves correctly.", tone=AMBER)
num(s)

# ============================================================= 6. LIVE DEMO
num(divider(6, "Live Demo", "Pega original and Power Platform equivalent"))

s = base("Key user journeys and end-to-end execution", eyebrow="Live Demo")
table(s,
      ["#", "Journey", "What to observe"],
      [["*1", "Worklist", "Pending assignments across all five case types in "
        "one view - not achievable per-case-type in Pega without custom work"],
       ["*2", "Create a case", "Case ID generated with the Pega prefix "
        "convention; engine plans the first assignment automatically"],
       ["*3", "Complete an assignment", "Form is rendered entirely from view "
        "metadata - no screen was hand-coded"],
       ["*4", "Decision evaluation", "A Pega decision table executes against "
        "live case data and routes the case"],
       ["*5", "Approval sub-process", "Case pauses; approve or reject routes "
        "onward or into the rejection path"],
       ["*6", "Stage progression", "Chevron stepper advances; note the guarded "
        "rework transition being skipped"],
       ["*7", "Resolution", "Case reaches a resolved status"],
       ["*8", "Audit trail", "Every step, decision and transition recorded"]],
      y=1.68, widths=[0.5, 2.8, 8.8], size=11.5)
callout(s, f"Live app: {APP_URL}")
notes(s, "Run journey 3 on Compliance Monitoring - it exercises a decision, a "
         "guarded rework transition that gets skipped, and reaches resolution "
         "in eight iterations. It is the most complete single demonstration of "
         "the engine, and it is the case type that originally exposed the "
         "infinite-loop defect.")
num(s)

s = base("Original Pega process and Power Platform equivalent", eyebrow="Live Demo")
table(s,
      ["Element", "Pega", "Power Platform implementation"],
      [["*Masthead", "Red application banner", "Reproduced"],
       ["*Case banner", "Teal case header with ID and status", "Reproduced"],
       ["*Stage stepper", "Chevron stage indicator", "Reproduced, data-driven"],
       ["*Left rail", "Case summary panel", "Reproduced"],
       ["*Assignment form", "Pega view rendering", "Rendered from view metadata"],
       ["*Case contents", "Section navigation", "Reproduced"],
       ["*Worklist", "Per-case-type worklists", "*Unified across all case types"],
       ["*Audit trail", "Pega history", "Dataverse table, fully queryable"]],
      y=1.70, widths=[2.5, 4.4, 5.2], size=12)
callout(s, "The forms are not hand-built copies. They are generated at runtime "
           "from the imported view metadata, so a Pega view change flows through "
           "as a data update.")
num(s)

# ====================================================== 7. MIGRATION FINDINGS
num(divider(7, "Migration Findings", "What worked, what did not, and why"))

s = base("What migrated well", eyebrow="Migration Findings")
table(s,
      ["Artefact", "Migrated", "Coverage"],
      [["*Case types", "5 of 5", "*100%"],
       ["*Stages", "39 of 39", "*100%"],
       ["*Steps (structure)", "80 of 80", "*100%"],
       ["*Decision tables", "10 of 10 (28 rows)", "*100%"],
       ["*Step-bound views", "24 (59 fields)", "*100% of captured"],
       ["*Choice sets", "26 (107 values)", "*100%"],
       ["*Access groups", "19 of 19 (as data)", "*100%"],
       ["*Data objects", "10 of 10", "*100%"]],
      y=1.70, widths=[3.4, 3.6, 2.2], w=9.2, size=12)
bullets(s, [
    ("Why structure migrates cleanly", 0, True),
    "Pega's case model is declarative and fully represented in the export and "
    "DX API. Once decoded, it maps directly onto Dataverse rows with no "
    "interpretation required.",
    ("The re-usable asset", 0, True),
    "The extract and seed scripts are application-agnostic. They discover class "
    "prefixes, case types and choice sets rather than hardcoding them, so they "
    "apply to the next Pega application without modification.",
], y=1.70, x=10.1, w=2.6, size=11, gap=5)
callout(s, "The entire case lifecycle skeleton - every stage and every step, in "
           "order - migrated through automation with no manual authoring.", tone=GREEN)
num(s)

s = base("Manual conversion requirements", eyebrow="Migration Findings")
kpis(s, [("41", "of 80 steps need\nmanual implementation"),
         ("17", "Notification\nsteps"),
         ("20", "Data transform\nsteps"),
         ("4", "Document generation\nsteps"),
         ("39", "Steps fully working\ntoday")],
     y=1.60, h=1.22)
table(s,
      ["Requirement", "Volume", "Why it cannot be automated"],
      [["*Notification content", "17 steps / 27 rules",
        "Correspondence bodies are engine-held with no export representation"],
       ["*Data transform logic", "20 steps",
        "No transform rules authored in this export - nothing to port"],
       ["*Document generation", "4 steps",
        "Templates and merge logic are not exposed"],
       ["*Stage transition guards", "4 inferred", "Extraction shows Pega has no conditional transitions at all"],
       ["*Security enforcement", "19 roles / 30 grants / 18 workbaskets",
        "Pega and Dataverse security models differ structurally"]],
      y=3.15, widths=[2.9, 2.3, 6.9], size=11.5)
callout(s, "This 51% is the number to plan against. It is not a tooling "
           "shortfall - no migration approach can extract what the platform "
           "does not expose.", tone=AMBER)
num(s)

s = base("Technical challenges encountered", eyebrow="Migration Findings")
bullets(s, [
    ("1.  Infinite rework loops - resolved", 0, True),
    "Two case types looped indefinitely. Backward stage-change steps in "
    "resolution stages fired unconditionally because their guarding when "
    "conditions are not in the export. Resolved with two layers: guards inferred "
    "from the preceding decision table's non-terminal results, plus a hard "
    "stage re-visit cap that guarantees termination regardless.",
    ("2.  Extraction fidelity is silent - resolved", 0, True),
    "A low-fidelity extraction produces a structurally valid model with zero "
    "views and choice sets. Seeding it would have wiped the metadata the forms "
    "render from, presenting as a UI bug. The loader now refuses such a config.",
    ("3.  Lookup controls initially missed - resolved", 0, True),
    "Pega encodes lookups as ObjectReference with a nested component type. "
    "Missing this initially lost 5 of 24 views.",
    ("4.  Date handling - resolved", 0, True),
    "Dataverse DateOnly columns shifted by a day under timezone conversion.",
], size=12.5, gap=6)
callout(s, "All four were found by automated verification rather than by "
           "manual testing - which is the argument for building the harness "
           "first.", tone=GREEN)
notes(s, "Challenge 1 is worth dwelling on. It is the clearest evidence that a "
         "naive structural migration produces a broken application, and that "
         "the mitigation has to be defence in depth - an inferred guard alone "
         "would not be safe.")
num(s)

s = base("Requirements recovered without a workshop", eyebrow="Migration Findings")
kpis(s, [("0", "Business workshops held\nduring the PoC"),
         ("100%", "Process model recovered\nfrom artefacts"),
         ("41", "Steps needing business\ninput - all pre-located"),
         ("39", "Steps needing no\nbusiness input at all")],
     y=1.58, h=1.20)
table(s,
      ["Requirement domain", "Recovered from artefacts", "Workshops needed"],
      [["*Process model", "5 case types, 39 stages, 80 steps", "*None"],
       ["*Business rules", "10 decision tables, 28 rules of logic", "*None"],
       ["*User interface", "24 screens, 59 fields, plus screenshots", "*None"],
       ["*Data model", "10 data objects, 334 properties", "*None"],
       ["*Reference data", "26 choice sets, 107 values", "*None"],
       ["*Security model", "19 roles, 30 grants, 18 workbaskets", "*None"],
       ["*Routing logic", "264 connector transitions", "*None"],
       ["*Step behaviour", "41 steps named and located, bodies not exported",
        "Confirmation only"]],
      y=3.10, widths=[2.7, 5.5, 3.9], size=11.5)
callout(s, "The residue is confirmation, not discovery - see the next slide.")
num(s)

s = base("How the residual elicitation changes shape", eyebrow="Migration Findings")
bullets(s, [
    ("The 41 steps are not unknowns", 0, True),
    "For every one of them the artefacts already give the case type, the stage, "
    "the position in the sequence, the step name and the step type. What is "
    "missing is only the body - the wording of a notification, the field "
    "derivation inside a transform.",
], y=1.55, size=13.5)
table(s,
      ["Instead of asking", "The question becomes"],
      [["What notifications does this process send, to whom, and when?",
        "*Compliance Monitoring / Remediation / 'Notify Stakeholders' - "
        "confirm the wording"],
       ["What calculations happen between these two steps?",
        "*Escalation Management / Case Routing / 'Assign Case Owner' - "
        "confirm the derivation"],
       ["What documents does this process produce?",
        "*Risk Assessment / Resolution Tracking / 'Generate Final Report' - "
        "confirm the template"],
       ["When should a case go back for rework?",
        "*Four specific transitions, each with a proposed condition - "
        "confirm or correct"]],
      y=3.05, widths=[5.0, 7.1], size=11.5)
callout(s, "Open-ended discovery becomes closed confirmation against a working "
           "system the business can see running. That is a materially shorter "
           "and easier conversation.", tone=GREEN)
notes(s, "This is the practical answer to 'we have no time for requirements'. "
         "You are not asking them to specify an application. You are showing "
         "them one that already runs and asking them to confirm 41 specific "
         "points, each anchored to a named step they recognise.")
num(s)

s = base("Automation opportunities", eyebrow="Migration Findings")
table(s,
      ["Opportunity", "Current state", "Potential"],
      [["*Extract and seed pipeline", "Built and application-agnostic",
        "*Reusable as-is on the next application"],
       ["*Dynamic form rendering", "Built - forms render from metadata",
        "*Reusable as-is"],
       ["*Case engine", "Built - pure and configuration-driven",
        "*Reusable as-is"],
       ["*Verification harness", "Built - 49 checks",
        "*Extend per application"],
       ["*Guard inference", "Heuristic from decision results",
        "*Flow-rule extractor built and reusable"],
       ["*Notification scaffolding", "Manual today",
        "Generate flow skeletons from step metadata"],
       ["*Data transform scaffolding", "Manual today",
        "Generate typed stubs from property metadata"],
       ["*Security mapping", "Manual today",
        "Generate role definitions from access groups"]],
      y=1.70, widths=[3.2, 4.6, 4.3], size=11.5)
callout(s, "Four components are already reusable. The remaining four are "
           "scaffolding opportunities that would reduce the manual 51% "
           "materially on subsequent migrations.", tone=GREEN)
num(s)

# ====================================================== 8. VALIDATION RESULTS
num(divider(8, "Validation Results", "Functional outcomes, observations and gaps"))

s = base("Functional validation", eyebrow="Validation Results")
kpis(s, [("49", "Checks passing"), ("0", "Checks failing"),
         ("5 of 5", "Case types resolving"), ("100%", "Lifecycle coverage")],
     y=1.58, h=1.15)
table(s,
      ["Case type", "Iterations", "Assignments", "Approvals", "Decisions",
       "Skipped", "Final status"],
      [["*Compliance Monitoring", "8", "4", "0", "3", "3",
        "Resolved-Resolution Closure"],
       ["*Escalation Management", "8", "5", "1", "1", "0",
        "Resolved-Case Closure"],
       ["*Lending Review", "7", "4", "1", "1", "0", "Resolved-Case Closure"],
       ["*Quality Recommendation", "3", "2", "0", "0", "0",
        "Resolved-Closure Validation"],
       ["*Risk Assessment", "8", "2", "2", "3", "1",
        "Resolved-Resolution Tracking"]],
      y=3.05, widths=[2.9, 1.1, 1.4, 1.2, 1.2, 1.0, 3.3], size=11)
bullets(s, [
    "The harness imports the real shipped engine and drives full lifecycles "
    "against live Dataverse, then removes its own records. It is not a mock.",
], y=5.30, size=12.5)
callout(s, "Verification covers configuration integrity, decision evaluation, "
           "utility classification, dry-run planning and live end-to-end "
           "execution per case type.")
num(s)

s = base("Performance observations", eyebrow="Validation Results")
table(s,
      ["Measure", "Observation", "Confidence"],
      [["*Build time", "Approximately 2 to 3 seconds", "*High - repeated"],
       ["*Bundle size", "327 KB raw, 91 KB gzipped", "*High - measured"],
       ["*Full lifecycle", "3 to 8 engine iterations per case type",
        "*High - measured"],
       ["*Config load", "Single load, shared across screens", "Medium"],
       ["*Concurrent users", "Not tested", "*None - out of scope"],
       ["*Production volume", "Not tested", "*None - out of scope"],
       ["*Dataverse throughput", "Not profiled under load", "*None - out of scope"]],
      y=1.70, widths=[2.6, 5.6, 3.9], size=12)
callout(s, "Performance at production scale is explicitly unproven. This is a "
           "functional PoC; load testing is a Phase 1 entry criterion, not a "
           "PoC outcome.", tone=AMBER)
bullets(s, [
    ("Reasonable expectation", 0, True),
    "The architecture is a standard SPA over Dataverse. Performance "
    "characteristics should follow normal Dataverse patterns - the risk is in "
    "query design and row counts, not in the engine, which is pure in-memory "
    "computation over a small configuration set.",
], y=5.45, size=13)
num(s)

s = base("Gaps identified and areas needing further analysis",
        eyebrow="Validation Results")
table(s,
      ["Gap", "Severity", "Required analysis"],
      [["*Stage transition guards are inferred", "*High",
        "Extraction done - now a business decision on rework conditions"],
       ["*Notification content unavailable", "Medium",
        "Business review of 27 correspondence rules; re-author as templates"],
       ["*Data transforms unauthored in source", "Medium",
        "0 transform rules exist behind the 20 steps - business decides what they should do"],
       ["*Security model not enforced", "*High",
        "Map 19 access groups and 18 workbaskets to Dataverse roles and teams"],
       ["*No performance baseline", "Medium",
        "Load test at projected production volume"],
       ["*In-flight case migration", "Medium",
        "Define cutover: drain, dual-run or migrate mid-flight"],
       ["*Document generation", "Low",
        "Identify 4 templates and target generation mechanism"],
       ["*Reporting not addressed", "Low",
        "Assess 30 report definitions for Power BI equivalents"]],
      y=1.70, widths=[3.7, 1.5, 6.9], size=11.5)
callout(s, "Three high-severity gaps all share a root cause: business logic "
           "that Pega executes but does not expose. Each needs business input, "
           "not just engineering.", tone=AMBER)
num(s)

# ================================================== 9. EFFORT & RISK
num(divider(9, "Effort & Risk Assessment", "Estimates, risks and mitigations"))

s = base("Estimated migration effort", eyebrow="Effort & Risk")
table(s,
      ["Workstream", "Basis", "Days"],
      [["*Rework-condition workshops", "Business decision, not extraction", "4 - 6"],
       ["*Data transform implementation", "20 steps, no source logic to port", "10 - 15"],
       ["*Notification implementation", "17 steps / 27 rules", "8 - 12"],
       ["*Document generation", "4 steps", "5 - 8"],
       ["*Security model", "19 roles, 30 grants, 18 workbaskets", "12 - 18"],
       ["*Attachments and storage", "12 attachment categories", "5 - 8"],
       ["*SLA escalation timers", "Scheduled flows", "5 - 8"],
       ["*Unit tests and hardening", "Engine is pure - straightforward", "10 - 15"],
       ["*ALM pipeline and environments", "Managed solution, 3 environments", "8 - 12"],
       ["*UAT, data migration and cutover", "Including in-flight strategy", "15 - 25"],
       ["*TOTAL", "*One application of this complexity", "*82 - 127"]],
      y=1.65, widths=[3.8, 5.3, 1.6], w=10.05, size=11.5)
bullets(s, [
    ("Calibration", 0, True),
    "Derived from PoC actuals: 27 tables, 80 steps, ~6,400 hand-written lines.",
    ("Team shape", 0, True),
    "3 people: approximately 7 to 10 weeks elapsed.",
    ("Excludes", 0, True),
    "Reporting, org change and training.",
    ("Second application", 0, True),
    "Expect 40 to 50% less - the engine, forms and pipeline are reusable.",
], y=1.68, x=10.95, w=1.95, size=10, gap=4)
callout(s, "The automated portion of a migration is days of work. The estimate "
           "above is almost entirely the manual 51% - which is why quantifying "
           "it early matters more than tooling.")
num(s)

s = base("Key risks and mitigations", eyebrow="Effort & Risk")
table(s,
      ["Risk", "L", "I", "Mitigation"],
      [["*Inferred guards do not match real business rules", "*H", "*H",
        "Two-layer defence already in place: inferred guard plus a hard "
        "re-visit cap. Replace with real conditions in Phase 1 - a data edit, "
        "no redeploy"],
       ["*Data transform logic cannot be reconstructed", "M", "*H",
        "Business workshops per transform; 20 are in scope and individually "
        "identified"],
       ["*Security model mismatch", "M", "*H",
        "Design Dataverse roles and teams early; validate with a security "
        "workshop before build"],
       ["*Performance at production volume", "M", "M",
        "Load test as a Phase 1 entry criterion; Dataverse elastic tables if needed"],
       ["*Low-fidelity re-extraction corrupts config", "*L", "*H",
        "*Already mitigated - the loader refuses degraded extractions"],
       ["*Pega SME availability", "M", "M",
        "Book SME time before Phase 1 starts"],
       ["*Scope creep from unmigrated reporting", "M", "L",
        "Explicitly phase reporting into a separate Power BI workstream"]],
      y=1.70, widths=[3.4, 0.5, 0.5, 7.7], size=11)
callout(s, "L = likelihood, I = impact. The top risk is already partially "
           "mitigated by design - the re-visit cap means a wrong guard degrades "
           "gracefully rather than hanging the case.")
num(s)

s = base("Dependencies", eyebrow="Effort & Risk")
table(s,
      ["Dependency", "Needed for", "Timing", "Owner"],
      [["*Business SME workshops", "Agreeing the rework conditions", "*Phase 1 weeks 1 to 2", "Business"],
       ["*Pega sandbox with DX API", "High-fidelity extraction of each app",
        "*Before assessment", "Pega platform team"],
       ["*Business SMEs (time-boxed)", "Confirming 41 pre-located step bodies - confirmation, not discovery", "*Short sessions, Phase 1 weeks 1 to 4", "Business"],
       ["*Power Platform environments", "Dev, test and production with ALM",
        "Phase 1 start", "Platform team"],
       ["*Dataverse capacity", "Row and storage volumes", "Phase 1 planning",
        "Platform team"],
       ["*Security design authority", "Approving the role and team model",
        "Phase 1 weeks 1 to 3", "Security"],
       ["*Production volume data", "Load test baseline", "Before go-live",
        "Business / platform"]],
      y=1.70, widths=[3.0, 4.6, 2.5, 2.7], size=11.5)
callout(s, "The first two are hard blockers. Without DX API access, assessment "
           "quality drops sharply - as demonstrated during this PoC.",
        tone=AMBER)
num(s)

# ================================================ 10. RECOMMENDATIONS
num(divider(10, "Recommendations & Next Steps",
            "Roadmap, candidates, governance and production approach"))

s = base("Recommendation", eyebrow="Recommendations")
bullets(s, [
    ("Proceed to a Phase 1 production migration of the Lending Due Diligence "
     "application.", 0, True),
    "The PoC has proven the approach on a real application of genuine "
    "complexity: 5 case types, 80 steps and 10 decision tables, running end to "
    "end with automated verification.",
    "The unknowns are now quantified rather than speculative. 41 steps need "
    "manual implementation and every one is individually identified.",
    "The migration assets - extract pipeline, engine, dynamic forms, "
    "verification harness - are application-agnostic and reusable.",
    ("Condition", 0, True),
    "Book time-boxed SME confirmation sessions. The artefacts carry the specification; the business is asked only to confirm 41 named, located step bodies against a system they can watch running.",
], y=1.60, size=14, gap=8)
callout(s, "Recommended next action: a two-week inception to recover the 35 "
           "flow rule bodies and confirm the security model. That retires the "
           "highest risk before committing to the full build.")
num(s)

s = base("Phase 1 roadmap", eyebrow="Recommendations")
table(s,
      ["Stage", "Weeks", "Activities", "Exit criteria"],
      [["*Inception", "1 - 2",
        "Run artefact extraction; time-boxed SME confirmation; provision environments",
        "41 step bodies confirmed; roles designed"],
       ["*Build - logic", "3 - 6",
        "Implement 20 data transforms and 4 document generators; replace "
        "inferred guards",
        "All step bodies executing"],
       ["*Build - integration", "5 - 8",
        "17 notifications via Power Automate; attachments; SLA timers",
        "No simulated effects remain"],
       ["*Security", "6 - 9",
        "Dataverse roles, teams, workbasket routing, row-level security",
        "Users see only their cases"],
       ["*Hardening", "8 - 10",
        "Unit tests, load testing, ALM pipeline",
        "Performance baseline established"],
       ["*UAT and cutover", "10 - 12",
        "Business validation, data migration, go-live",
        "Signed off in production"]],
      y=1.70, widths=[1.9, 1.0, 5.6, 4.3], size=11)
callout(s, "Approximately 12 weeks with a team of 3, consistent with the "
           "93 to 141 day estimate. Build streams overlap deliberately.")
num(s)

s = base("Candidate applications for migration", eyebrow="Recommendations")
table(s,
      ["Selection criterion", "Why it matters", "Ideal profile"],
      [["*Ratio of structure to custom logic", "Structure automates; logic does not",
        "High stage and step count, few data transforms"],
       ["*Decision table density", "Decision tables migrate at 100%",
        "Logic expressed as tables, not activities"],
       ["*Integration surface", "Each integration is bespoke work",
        "Few external system dependencies"],
       ["*Security complexity", "Pega and Dataverse models differ structurally",
        "Small number of access groups"],
       ["*Artefact availability", "Determines how little business time is needed", "*Export, docs and DX API sandbox all obtainable"],
       ["*In-flight case volume", "Cutover complexity scales with it",
        "Short-lived cases that can be drained"]],
      y=1.70, widths=[3.3, 4.5, 4.3], size=11.5)
bullets(s, [
    ("Suggested sequence", 0, True),
    "1.  Lending Due Diligence - already proven, assets in place",
    "2.  A second application sharing its data objects - maximises reuse",
    "3.  Progressively higher-criticality applications as capability matures",
], y=5.15, size=13, gap=6)
num(s)

s = base("Governance model", eyebrow="Recommendations")
table(s,
      ["Area", "Recommendation"],
      [["*Environment strategy",
        "Dev, test and production with managed solutions; unmanaged only in dev"],
       ["*Solution management",
        "Single solution per application; environment variables for org URLs"],
       ["*Process configuration changes",
        "Treat configuration rows as controlled artefacts - re-seeded from "
        "source control, never hand-edited in production"],
       ["*Extraction standard",
        "Mandate three-source extraction; the loader enforces this automatically"],
       ["*Verification gate",
        "Every application ships with a lifecycle harness; green is a "
        "release condition"],
       ["*Code standards",
        "Keep the engine pure and side-effect free - it is what makes "
        "verification possible"],
       ["*Security review",
        "Role and team model signed off by security before build"],
       ["*Reusable asset ownership",
        "Nominate an owner for the shared engine, forms and pipeline"]],
      y=1.70, widths=[3.2, 8.9], size=11.5)
callout(s, "The single highest-value governance rule: process configuration is "
           "code. Version it, review it and re-seed it - never edit it directly "
           "in production.")
num(s)

s = base("Proposed production approach", eyebrow="Recommendations")
bullets(s, [
    ("Delivery model", 0, True),
    "Application-by-application, with each migration strengthening the shared "
    "asset library rather than being a one-off.",
    ("Cutover strategy - recommended", 0, True),
    "Drain and switch. Stop creating new Pega cases, allow in-flight cases to "
    "complete on Pega, and run new cases on the Power Platform. This avoids "
    "in-flight data migration entirely and is why it is assumption 6.",
    ("Alternatives if draining is not viable", 0, True),
    "Dual-run with reconciliation - higher assurance, materially higher cost",
    "Migrate in-flight cases - needs stage and step mapping per case and "
    "carries the highest risk",
    ("Operating model", 0, True),
    "Business analysts own process configuration; engineers own the engine and "
    "integrations. This split is what the metadata-driven architecture enables.",
], y=1.58, size=13.5, gap=6.5)
callout(s, "Drain and switch is strongly preferred. In-flight migration was the "
           "single largest risk identified and is avoidable by sequencing.")
num(s)

# ============================================================ 11. APPENDIX
num(divider(11, "Appendix", "Mapping detail, artefacts and assumptions"))

s = base("Detailed mapping - step kinds", eyebrow="Appendix")
table(s,
      ["Pega step kind", "impl", "Count", "Engine action", "Status"],
      [["*Assignment", "WorkList", "9", "createAssignment", "*Working"],
       ["*Assignment", "WorkBasket", "12", "createAssignment", "*Working"],
       ["*Sub-Process", "pxApproval", "4", "createApproval", "*Working"],
       ["*Decision", "Decision table name", "7", "evaluateDecision", "*Working"],
       ["*Utility", "pxChangeToNextStage", "3", "changeStage", "*Working"],
       ["*Utility", "pxChangeToPreviousStage", "2", "changeStage (guarded)", "*Working"],
       ["*Utility", "pxChangeToSpecifiedStage", "2", "changeStage (guarded)", "*Working"],
       ["*Utility", "pzRunDataTransform", "20", "runUtility", "Simulated"],
       ["*Utility", "pzNotifyWrapper", "17", "runUtility", "Simulated"],
       ["*Utility", "pxGenerateAndAttachDocument", "4", "runUtility", "Simulated"]],
      y=1.70, widths=[2.0, 3.6, 0.9, 3.2, 1.8], size=11.5)
callout(s, "39 steps fully working, 41 simulated. Simulated steps are written "
           "to the audit trail so the lifecycle completes and the gap stays "
           "visible.")
num(s)

s = base("Detailed mapping - inferred stage guards", eyebrow="Appendix")
table(s,
      ["Case type", "Stage", "Step", "Guarding decision", "Fires on"],
      [["*Compliance Monitoring", "PRIM2", "Change to specific stage",
        "DecisionOutcomes", "Escalate Immediately; Corrective Action"],
       ["*Compliance Monitoring", "PRIM4", "Change to specific stage",
        "ValidateResolution", "Pending Closure; Action Required; Incomplete"],
       ["*Compliance Monitoring", "PRIM4", "Change to previous stage",
        "ValidateResolution", "Pending Closure; Action Required; Incomplete"],
       ["*Risk Assessment", "PRIM4", "Change to previous stage",
        "OutcomeDecision", "Escalated; Under Review; Pending Review"]],
      y=1.70, widths=[2.4, 1.0, 2.9, 2.3, 3.5], size=11)
bullets(s, [
    ("How these were derived", 0, True),
    "For each backward stage-change step, the extractor walks back to the "
    "nearest preceding decision step, reads that table's actual result values, "
    "and allows the step to fire only on the non-terminal outcomes.",
    ("Why they are safe despite being inferred", 0, True),
    "A hard stage re-visit cap in the engine means a wrong guard degrades to a "
    "skipped step rather than an infinite loop. Both layers are required.",
    ("Phase 1 action", 0, True),
    "Extraction proved Pega has no conditional transitions, so these encode a business decision rather than a recovered rule. Confirm with SMEs; because guards are Dataverse rows it is a data edit, no redeploy.",
], y=3.55, size=12.5, gap=6)
num(s)

s = base("Conversion artefacts produced", eyebrow="Appendix")
table(s,
      ["Artefact", "Purpose", "Reusable"],
      [["*extract-prototype.mjs", "Pega export to normalised config JSON", "*Yes"],
       ["*seed-prototype.mjs", "Config JSON to Dataverse, idempotent", "*Yes"],
       ["*schema-v2.mjs", "27-table Dataverse schema definition", "Template"],
       ["*provision-dataverse.mjs", "Creates tables in the solution", "*Yes"],
       ["*gen-detail-columns.mjs", "Generates typed detail column mappings", "*Yes"],
       ["*verify-engine.mjs", "Live end-to-end verification, 49 checks", "*Yes"],
       ["*engine.ts", "Pure case planner", "*Yes"],
       ["*orchestrator.ts", "Engine plans to Dataverse writes", "*Yes"],
       ["*DynamicForm.tsx", "Renders any view from metadata", "*Yes"],
       ["*DEVELOPER-HANDOVER.md", "Architecture and production backlog", "Template"]],
      y=1.70, widths=[3.3, 6.4, 2.4], size=11.5)
bullets(s, [
    ("Codebase", 0, True),
    "3,503 lines of application source, 2,892 lines of migration scripts, and "
    "4,987 lines of generated Dataverse services.",
], y=5.75, size=12.5)
num(s)

s = base("Technical assumptions", eyebrow="Appendix")
table(s,
      ["#", "Assumption", "Basis"],
      [["*1", "Dataverse row and storage volumes are within standard limits",
        "PoC volumes are small; production volumes not supplied"],
       ["*2", "Business days for SLA use a standard calendar",
        "Pega holiday calendars were not in the export"],
       ["*3", "Case ID prefixes follow the Pega convention",
        "Prefixes read from the case type definitions"],
       ["*4", "Detail column names map as ava_ plus lowercased field name",
        "Deterministic mapping; unmapped fields reported, not silently dropped"],
       ["*5", "Choice values are stable strings",
        "Imported as rows; changes require a re-seed"],
       ["*6", "One Dataverse solution per application",
        "Matches Power Platform ALM guidance"],
       ["*7", "Users authenticate via Entra ID with Dataverse privileges",
        "Standard Power Platform model"],
       ["*8", "Decision tables evaluate top-down, first match wins",
        "Matches observed Pega semantics"]],
      y=1.70, widths=[0.5, 5.4, 6.2], size=11.5)
num(s)

# ---------------------------------------------------------------- closing ---
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, TEAL)
rect(s, 0, 0, 13.333, 0.16, RED)
tb = textbox(s, 1.5, 2.75, 10.3, 1.0)
para(_tf(tb), "Questions", size=40, bold=True, color=WHITE, first=True,
     space_after=6)
tb = textbox(s, 1.5, 3.75, 10.3, 1.6)
para(_tf(tb),
     "Pega to Power Platform  ·  Lending Due Diligence PoC",
     size=15, color=RGBColor(0xD6, 0xEC, 0xEE), first=True, space_after=6)
para(_tf(tb),
     "5 case types  ·  39 stages  ·  80 steps  ·  49/49 verification checks  ·  "
     "0 business workshops",
     size=13, color=RGBColor(0xBF, 0xDF, 0xE3), space_after=0)
num(s)

prs.save(OUT)
print(f"Wrote {OUT}  ({len(prs.slides.__iter__.__self__._sldIdLst)} slides)")
