/**
 * Case lifecycle engine.
 *
 * The engine is driven entirely by configuration rows in Dataverse (case types,
 * stages, steps, decision tables) rather than hard-coded process logic, so a
 * process change is a data change. This mirrors the Pega model the prototype
 * was exported from.
 *
 * Step kinds and how each is handled:
 *   Assignment   - creates a work item and pauses; the user completes a form
 *   Utility      - runs automatically (notify, data transform, stage change, doc gen)
 *   Decision     - evaluates a decision table and records the result
 *   Sub-Process  - pxApproval; creates an approval record and pauses
 */
import type {
  LddCaseType,
  LddStage,
  LddStep,
  LddWorkCase,
  LddDecision,
  LddDecisionRow,
} from './types';

export type StepKind = 'Assignment' | 'Utility' | 'Decision' | 'Sub-Process';

/** What the engine wants the caller to do next. */
export type EngineAction =
  | { type: 'createAssignment'; step: LddStep; stage: LddStage }
  | { type: 'createApproval'; step: LddStep; stage: LddStage }
  | { type: 'runUtility'; step: LddStep; stage: LddStage; effect: UtilityEffect }
  | { type: 'evaluateDecision'; step: LddStep; stage: LddStage; decisionName: string }
  | { type: 'skipStep'; step: LddStep; stage: LddStage; reason: string }
  | { type: 'changeStage'; toStageCode: string; reason: string }
  | { type: 'resolve'; status: string };

export type UtilityEffect =
  | { kind: 'notify'; notificationName: string }
  | { kind: 'dataTransform' }
  | { kind: 'generateDocument' }
  | { kind: 'changeToNextStage' }
  | { kind: 'changeToPreviousStage' }
  | { kind: 'changeToSpecifiedStage'; targetStageCode: string }
  | { kind: 'unknown'; impl: string };

/** Classifies a Utility step's implementation into an effect the engine understands. */
export function utilityEffect(step: LddStep): UtilityEffect {
  switch (step.ava_impl) {
    case 'pzNotifyWrapper':
      return { kind: 'notify', notificationName: step.ava_notificationname ?? step.ava_name };
    case 'pzRunDataTransform':
      return { kind: 'dataTransform' };
    case 'pxGenerateAndAttachDocument':
      return { kind: 'generateDocument' };
    case 'pxChangeToNextStage':
      return { kind: 'changeToNextStage' };
    case 'pxChangeToPreviousStage':
      return { kind: 'changeToPreviousStage' };
    case 'pxChangeToSpecifiedStage':
      return { kind: 'changeToSpecifiedStage', targetStageCode: step.ava_targetstagecode ?? '' };
    default:
      return { kind: 'unknown', impl: step.ava_impl ?? '' };
  }
}

/** Primary stages in lifecycle order. Alternate stages are entered explicitly. */
export function primaryStages(stages: LddStage[]): LddStage[] {
  return stages
    .filter((s) => s.ava_stagetype === 'Primary')
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
}

export function alternateStages(stages: LddStage[]): LddStage[] {
  return stages
    .filter((s) => s.ava_stagetype === 'Alternate')
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
}

export function stageByCode(stages: LddStage[], code?: string | null): LddStage | undefined {
  return stages.find((s) => s.ava_stagecode === code);
}

export function stepsForStage(steps: LddStep[], stageId: string): LddStep[] {
  return steps
    .filter((s) => s._ava_stageid_value === stageId)
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
}

/**
 * Works out what should happen next on a case.
 *
 * Returns the ordered list of actions from the current step up to (and including)
 * the first action that pauses the case - an assignment or an approval. Utility
 * and decision steps in between run automatically.
 *
 * Backward stage changes are protected two ways, because Pega's `when` guards on
 * those steps are not present in the prototype export:
 *   1. If the step carries a guard (ava_GuardDecision / ava_GuardResults) it only
 *      fires when the case's last decision result is one of the listed results.
 *   2. A stage may be re-entered at most `maxStageRevisits` times regardless, so a
 *      mis-configured guard can never loop forever.
 */
export interface PlanOptions {
  /** How many times each stage has already been entered, keyed by stage code. */
  stageVisits?: Record<string, number>;
  maxStageRevisits?: number;
  maxSteps?: number;
  /** The case's most recent decision result, used to evaluate step guards. */
  lastDecisionResult?: string | null;
}

export function planNextActions(
  record: LddWorkCase,
  stages: LddStage[],
  allSteps: LddStep[],
  options: PlanOptions = {}
): EngineAction[] {
  const {
    stageVisits = {},
    maxStageRevisits = 2,
    maxSteps = 25,
    lastDecisionResult = record.ava_lastdecisionresult ?? null,
  } = options;

  const actions: EngineAction[] = [];
  const visits: Record<string, number> = { ...stageVisits };
  let stage = stageByCode(stages, record.ava_stagecode);
  let index = record.ava_currentstepindex ?? 0;
  const decisionResult = stripDecisionName(lastDecisionResult);
  let guard = 0;

  const enter = (target: LddStage, reason: string): boolean => {
    const code = target.ava_stagecode ?? '';
    const seen = visits[code] ?? 0;
    if (seen >= maxStageRevisits) return false;
    visits[code] = seen + 1;
    actions.push({ type: 'changeStage', toStageCode: code, reason });
    return true;
  };

  while (stage && guard++ < maxSteps) {
    const steps = stepsForStage(allSteps, stage.ava_lddstageid);

    if (index >= steps.length) {
      // Stage exhausted. A resolution stage ends the case; otherwise advance.
      if (stage.ava_transition === 'resolution') {
        actions.push({ type: 'resolve', status: `Resolved-${stage.ava_name}` });
        return actions;
      }
      const next = nextPrimaryStage(stages, stage);
      if (!next || !enter(next, 'Stage complete')) {
        actions.push({ type: 'resolve', status: 'Resolved-Completed' });
        return actions;
      }
      stage = next;
      index = 0;
      continue;
    }

    const step = steps[index];

    if (step.ava_kind === 'Assignment') {
      actions.push({ type: 'createAssignment', step, stage });
      return actions;
    }
    if (step.ava_kind === 'Sub-Process') {
      actions.push({ type: 'createApproval', step, stage });
      return actions;
    }
    if (step.ava_kind === 'Decision') {
      actions.push({
        type: 'evaluateDecision',
        step,
        stage,
        decisionName: step.ava_decisionname ?? step.ava_impl ?? '',
      });
      // The caller substitutes the real result; planning continues optimistically.
      index += 1;
      continue;
    }

    // Utility.
    const effect = utilityEffect(step);
    const backward =
      effect.kind === 'changeToPreviousStage' || effect.kind === 'changeToSpecifiedStage';

    if (backward && !guardAllows(step, decisionResult)) {
      actions.push({
        type: 'skipStep',
        step,
        stage,
        reason: `guard ${step.ava_guarddecision ?? 'n/a'} not satisfied by "${decisionResult ?? 'none'}"`,
      });
      index += 1;
      continue;
    }

    actions.push({ type: 'runUtility', step, stage, effect });

    let moved: LddStage | undefined;
    if (effect.kind === 'changeToNextStage') moved = nextPrimaryStage(stages, stage);
    else if (effect.kind === 'changeToPreviousStage') moved = previousPrimaryStage(stages, stage);
    else if (effect.kind === 'changeToSpecifiedStage' && effect.targetStageCode)
      moved = stageByCode(stages, effect.targetStageCode);

    if (moved) {
      if (enter(moved, step.ava_name ?? 'Stage change')) {
        stage = moved;
        index = 0;
        continue;
      }
      // Re-visit budget exhausted: fall through to the rest of this stage instead.
      actions.push({
        type: 'skipStep',
        step,
        stage,
        reason: `stage ${moved.ava_stagecode} re-visit limit reached`,
      });
    }

    index += 1;
  }

  return actions;
}

/** A guarded step fires only when the last decision result is in its allow-list. */
function guardAllows(step: LddStep, decisionResult: string | null): boolean {
  const allowRaw = step.ava_guardresults;
  if (!allowRaw) return true; // ungated
  if (!decisionResult) return false;
  const allow = allowRaw
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(decisionResult.trim().toLowerCase());
}

/** `ava_lastdecisionresult` is stored as "DecisionName: Result". */
function stripDecisionName(value: string | null | undefined): string | null {
  if (!value) return null;
  const i = value.indexOf(':');
  return i === -1 ? value.trim() : value.slice(i + 1).trim();
}

function nextPrimaryStage(stages: LddStage[], current: LddStage): LddStage | undefined {
  const primary = primaryStages(stages);
  const i = primary.findIndex((s) => s.ava_lddstageid === current.ava_lddstageid);
  // From an alternate stage, "next" means returning to the primary path.
  if (i === -1) return primary.find((s) => s.ava_transition === 'resolution') ?? primary[primary.length - 1];
  return primary[i + 1];
}

function previousPrimaryStage(stages: LddStage[], current: LddStage): LddStage | undefined {
  const primary = primaryStages(stages);
  const i = primary.findIndex((s) => s.ava_lddstageid === current.ava_lddstageid);
  return i > 0 ? primary[i - 1] : undefined;
}

/**
 * Evaluates a decision table against the case's field values.
 *
 * Pega decision tables match on labelled conditions ("Issue severity") whose values
 * come from case properties. Condition labels are matched to property values
 * case-insensitively, ignoring spaces, so "Issue severity" resolves ava_issueseverity.
 */
export function evaluateDecision(
  decision: LddDecision,
  rows: LddDecisionRow[],
  values: Record<string, unknown>
): { result: string; matchedRow: LddDecisionRow | null } {
  const conditions: string[] = safeJson(decision.ava_conditions, []);
  const ordered = rows
    .filter((r) => r._ava_decisionid_value === decision.ava_ldddecisionid)
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));

  const actual = conditions.map((c) => normalise(lookupValue(values, c)));

  for (const row of ordered) {
    const expected: string[] = safeJson(row.ava_whenvalues, []);
    // A row matches when every value it specifies matches; trailing blanks are wildcards.
    const matches = expected.every((exp, i) => {
      if (exp === null || exp === undefined || exp === '') return true;
      return normalise(exp) === actual[i];
    });
    if (matches && expected.length > 0) {
      return { result: row.ava_result ?? '', matchedRow: row };
    }
  }
  return { result: decision.ava_otherwise ?? '', matchedRow: null };
}

/** Resolves a human condition label such as "Issue severity" to a case field value. */
function lookupValue(values: Record<string, unknown>, conditionLabel: string): unknown {
  const key = conditionLabel.replace(/\s+/g, '').toLowerCase();
  for (const [k, v] of Object.entries(values)) {
    const bare = k.replace(/^ava_/, '').replace(/\s+/g, '').toLowerCase();
    if (bare === key) return v;
  }
  return undefined;
}

const normalise = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim().toLowerCase();

export function safeJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Adds N business days, used for assignment SLA deadlines. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) remaining -= 1;
  }
  return d;
}

/** Builds the next case identifier for a type, e.g. L-26090002. */
export function nextCaseId(caseType: LddCaseType, existing: string[]): string {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `${caseType.ava_caseprefix ?? 'X'}-${stamp}`;
  const used = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
