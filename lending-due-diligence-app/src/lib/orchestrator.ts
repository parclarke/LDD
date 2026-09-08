/**
 * Case orchestration: turns the engine's plan into Dataverse writes.
 *
 * The engine (lib/engine.ts) is pure and decides *what* should happen. This module
 * performs the side effects: creating assignments and approvals, advancing stages,
 * recording decision results and writing the audit trail.
 *
 * Notification, data-transform and document-generation steps are recorded in the
 * audit trail but not executed - see docs/DEVELOPER-HANDOVER.md for the
 * integration work required to make those real.
 */
import {
  addHistory,
  completeAssignment,
  createApproval,
  createAssignment,
  createWorkCase,
  createCaseDetail,
  decideApproval,
  getCaseDetail,
  listAssignmentsForCase,
  listHistoryForCase,
  listWorkCases,
  updateCaseDetail,
  updateWorkCase,
} from './data';
import {
  addBusinessDays,
  evaluateDecision,
  nextCaseId,
  planNextActions,
  primaryStages,
  stageByCode,
  stepsForStage,
} from './engine';
import type { EngineAction } from './engine';
import type {
  CaseDetail,
  CaseTypeCode,
  CurrentUser,
  LddCaseType,
  LddStage,
  LddStep,
  LddWorkCase,
  ProcessConfig,
} from './types';

/** Steps whose side effect is not implemented; they are logged and skipped. */
export const SIMULATED_EFFECTS = new Set(['notify', 'dataTransform', 'generateDocument']);

/** How many times advanceCase may re-plan after a decision before giving up. */
const MAX_REPLAN_DEPTH = 8;

export interface AdvanceResult {
  record: LddWorkCase;
  actionsTaken: string[];
  pausedOn: 'assignment' | 'approval' | 'resolved' | 'none';
  /** The plan the engine produced, useful for tracing and tests. */
  plan?: EngineAction[];
}

function stagesFor(config: ProcessConfig, caseTypeId: string): LddStage[] {
  return config.stages.filter((s) => s._ava_casetypeid_value === caseTypeId);
}

function stepsFor(config: ProcessConfig, stages: LddStage[]): LddStep[] {
  const ids = new Set(stages.map((s) => s.ava_lddstageid));
  return config.steps.filter((s) => ids.has(s._ava_stageid_value ?? ''));
}

function bind(set: string, id: string) {
  return `/${set}(${id})`;
}

async function log(
  workCaseId: string,
  eventType: string,
  name: string,
  user: CurrentUser,
  extra: Record<string, unknown> = {}
) {
  await addHistory({
    ava_name: name.slice(0, 300),
    ava_eventtype: eventType,
    ava_performedby: user.displayName,
    ava_eventdate: new Date().toISOString(),
    'ava_WorkCaseId@odata.bind': bind('ava_lddworkcases', workCaseId),
    statecode: 0,
    ...extra,
  });
}

/**
 * Runs the engine from the case's current position until it pauses on an
 * assignment or approval, or resolves.
 */
export async function advanceCase(
  record: LddWorkCase,
  config: ProcessConfig,
  user: CurrentUser,
  depth = 0
): Promise<AdvanceResult> {
  const caseTypeId = record._ava_casetypeid_value ?? '';
  const stages = stagesFor(config, caseTypeId);
  const steps = stepsFor(config, stages);

  // Stage re-visit counts come from the audit trail so the loop guard survives
  // across sessions, not just within one planning pass.
  const history = await listHistoryForCase(record.ava_lddworkcaseid);
  const stageVisits: Record<string, number> = {};
  for (const h of history) {
    if (h.ava_eventtype !== 'StageChange' || !h.ava_tostage) continue;
    const stage = stages.find((s) => s.ava_name === h.ava_tostage);
    const code = stage?.ava_stagecode;
    if (code) stageVisits[code] = (stageVisits[code] ?? 0) + 1;
  }

  const actions = planNextActions(record, stages, steps, { stageVisits });
  const taken: string[] = [];
  let current = record;
  let paused: AdvanceResult['pausedOn'] = 'none';
  // A decision result can change whether a later guarded step fires, so once a
  // decision has run we stop executing this plan and re-plan with the fresh result.
  let replanAfterDecision = false;

  for (const action of actions) {
    switch (action.type) {
      case 'changeStage': {
        const target = stageByCode(stages, action.toStageCode);
        if (!target) break;
        const from = current.ava_stagename ?? '';
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_stagecode: target.ava_stagecode,
          ava_stagename: target.ava_name,
          ava_status: `Open-${target.ava_name}`,
          ava_currentstepindex: 0,
        });
        await log(
          current.ava_lddworkcaseid,
          'StageChange',
          `Moved to ${target.ava_name}`,
          user,
          { ava_fromstage: from, ava_tostage: target.ava_name, ava_details: action.reason }
        );
        taken.push(`Stage -> ${target.ava_name}`);
        break;
      }

      case 'skipStep': {
        await log(
          current.ava_lddworkcaseid,
          'StepSkipped',
          `Skipped ${action.step.ava_name}`,
          user,
          { ava_stepname: action.step.ava_name, ava_details: action.reason }
        );
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_currentstepindex: action.step.ava_sortorder ?? 1,
        });
        taken.push(`Skipped ${action.step.ava_name}`);
        break;
      }

      case 'runUtility': {
        const { step, effect } = action;
        const simulated = SIMULATED_EFFECTS.has(effect.kind);
        await log(
          current.ava_lddworkcaseid,
          'Utility',
          `${step.ava_name} (${effect.kind}${simulated ? ', simulated' : ''})`,
          user,
          {
            ava_stepname: step.ava_name,
            ava_details: JSON.stringify({ impl: step.ava_impl, effect, simulated }),
          }
        );
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_currentstepindex: (step.ava_sortorder ?? 1),
        });
        taken.push(`${step.ava_name} (${effect.kind})`);
        break;
      }

      case 'evaluateDecision': {
        const { step, decisionName } = action;
        const decision = config.decisions.find((d) => d.ava_name === decisionName);
        let result = 'No decision table configured';
        if (decision) {
          const detail = await getCaseDetail(
            (current.ava_casetypecode ?? '') as CaseTypeCode,
            current.ava_lddworkcaseid
          );
          const values = { ...(detail ?? {}), ...current } as Record<string, unknown>;
          result = evaluateDecision(decision, config.decisionRows, values).result;
        }
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_lastdecisionresult: `${decisionName}: ${result}`,
          ava_currentstepindex: step.ava_sortorder ?? 1,
        });
        await log(
          current.ava_lddworkcaseid,
          'Decision',
          `${decisionName} -> ${result}`,
          user,
          { ava_stepname: step.ava_name, ava_details: result }
        );
        taken.push(`${decisionName} -> ${result}`);
        replanAfterDecision = true;
        break;
      }

      case 'createAssignment': {
        const { step, stage } = action;
        const existing = await listAssignmentsForCase(current.ava_lddworkcaseid);
        const alreadyOpen = existing.some(
          (a) => a.ava_status === 'Pending' && a.ava_stepname === step.ava_name
        );
        if (!alreadyOpen) {
          const slaDays = step.ava_sladays ?? 2;
          const deadline = addBusinessDays(new Date(), slaDays);
          const routing = step.ava_routingtype ?? 'WorkList';
          const workbasket = step.ava_workbasket || defaultWorkbasket(current, config);
          await createAssignment({
            ava_name: step.ava_name,
            ava_stepname: step.ava_name,
            ava_viewname: step.ava_viewname,
            ava_stagecode: stage.ava_stagecode,
            ava_status: 'Pending',
            ava_assignedto: routing === 'WorkList' ? user.displayName : workbasket,
            ava_assignmenttype: routing,
            ava_workbasket: workbasket,
            ava_goal: addBusinessDays(new Date(), Math.max(1, slaDays - 1)).toISOString(),
            ava_deadline: deadline.toISOString(),
            ava_assignmentdate: new Date().toISOString(),
            ava_stepindex: step.ava_sortorder ?? 0,
            'ava_WorkCaseId@odata.bind': bind('ava_lddworkcases', current.ava_lddworkcaseid),
            statecode: 0,
          });
          current = await updateWorkCase(current.ava_lddworkcaseid, {
            ava_assignedto: routing === 'WorkList' ? user.displayName : workbasket,
            ava_assignmenttype: routing,
            ava_workbasket: workbasket,
            ava_sladeadline: deadline.toISOString(),
            ava_currentstepindex: (step.ava_sortorder ?? 1) - 1,
          });
          await log(
            current.ava_lddworkcaseid,
            'Assignment',
            `Assignment created: ${step.ava_name}`,
            user,
            { ava_stepname: step.ava_name, ava_details: `routing=${routing} workbasket=${workbasket}` }
          );
          taken.push(`Assignment: ${step.ava_name}`);
        }
        paused = 'assignment';
        break;
      }

      case 'createApproval': {
        const { step } = action;
        await createApproval({
          ava_name: step.ava_name,
          ava_approvertype: step.ava_approvertype ?? 'Manager',
          ava_status: 'Pending',
          ava_rejectionstatus: 'Approval Rejection',
          'ava_WorkCaseId@odata.bind': bind('ava_lddworkcases', current.ava_lddworkcaseid),
          statecode: 0,
        });
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_status: `Pending-Approval`,
          ava_currentstepindex: (step.ava_sortorder ?? 1) - 1,
        });
        await log(
          current.ava_lddworkcaseid,
          'Approval',
          `Approval requested: ${step.ava_name}`,
          user,
          { ava_stepname: step.ava_name }
        );
        taken.push(`Approval: ${step.ava_name}`);
        paused = 'approval';
        break;
      }

      case 'resolve': {
        current = await updateWorkCase(current.ava_lddworkcaseid, {
          ava_status: action.status,
          ava_resolvedon: new Date().toISOString(),
          ava_resolvedby: user.displayName,
          ava_resolutioncode: action.status,
        });
        await log(current.ava_lddworkcaseid, 'Resolved', action.status, user);
        taken.push(action.status);
        paused = 'resolved';
        break;
      }
    }
    if (paused !== 'none') break;
    if (replanAfterDecision) break;
  }

  if (replanAfterDecision && paused === 'none' && depth < MAX_REPLAN_DEPTH) {
    const next = await advanceCase(current, config, user, depth + 1);
    return {
      record: next.record,
      actionsTaken: [...taken, ...next.actionsTaken],
      pausedOn: next.pausedOn,
      plan: [...actions, ...(next.plan ?? [])],
    };
  }

  return { record: current, actionsTaken: taken, pausedOn: paused, plan: actions };
}

function defaultWorkbasket(record: LddWorkCase, config: ProcessConfig): string {
  const ct = config.caseTypes.find((c) => c.ava_code === record.ava_casetypecode);
  return record.ava_workbasket || `TheLending:${ct?.ava_code ?? 'Users'}`;
}

/**
 * Completes the open assignment: saves the form values onto the case detail row,
 * marks the assignment done, then lets the engine run on.
 */
export async function submitAssignment(
  record: LddWorkCase,
  assignmentId: string,
  stepName: string,
  detailChanges: Record<string, unknown>,
  caseChanges: Record<string, unknown>,
  config: ProcessConfig,
  user: CurrentUser
): Promise<AdvanceResult> {
  const code = (record.ava_casetypecode ?? '') as CaseTypeCode;

  if (Object.keys(detailChanges).length) {
    const detail = await getCaseDetail(code, record.ava_lddworkcaseid);
    if (detail) {
      const idField = Object.keys(detail).find((k) => k.endsWith('id') && k.startsWith('ava_ldd'));
      const detailId = idField ? (detail[idField] as string) : undefined;
      if (detailId) await updateCaseDetail(code, detailId, detailChanges);
    } else {
      await createCaseDetail(code, {
        ava_name: record.ava_name,
        ...detailChanges,
        'ava_WorkCaseId@odata.bind': bind('ava_lddworkcases', record.ava_lddworkcaseid),
        statecode: 0,
      });
    }
  }

  await completeAssignment(assignmentId, user.displayName);
  await log(record.ava_lddworkcaseid, 'StepComplete', `Completed ${stepName}`, user, {
    ava_stepname: stepName,
  });

  // Move past the completed step before re-planning.
  const stages = stagesFor(config, record._ava_casetypeid_value ?? '');
  const stage = stageByCode(stages, record.ava_stagecode);
  const steps = stage ? stepsForStage(stepsFor(config, stages), stage.ava_lddstageid) : [];
  const completedIndex = steps.findIndex((s) => s.ava_name === stepName);
  const nextIndex = completedIndex >= 0 ? completedIndex + 1 : (record.ava_currentstepindex ?? 0) + 1;

  const updated = await updateWorkCase(record.ava_lddworkcaseid, {
    ...caseChanges,
    ava_currentstepindex: nextIndex,
  });

  return advanceCase(updated, config, user);
}

/** Records an approval decision and either continues or diverts to the rejection stage. */
export async function submitApproval(
  record: LddWorkCase,
  approvalId: string,
  decision: 'Approved' | 'Rejected',
  comments: string,
  config: ProcessConfig,
  user: CurrentUser
): Promise<AdvanceResult> {
  await decideApproval(approvalId, decision, user.displayName, comments);
  await log(record.ava_lddworkcaseid, 'Approval', `Approval ${decision}`, user, {
    ava_details: comments,
  });

  if (decision === 'Rejected') {
    const stages = stagesFor(config, record._ava_casetypeid_value ?? '');
    const rejection = stages.find((s) => s.ava_name === 'Approval Rejection');
    const updated = await updateWorkCase(record.ava_lddworkcaseid, {
      ava_stagecode: rejection?.ava_stagecode ?? record.ava_stagecode,
      ava_stagename: rejection?.ava_name ?? record.ava_stagename,
      ava_status: 'Resolved-Rejected',
      ava_resolvedon: new Date().toISOString(),
      ava_resolvedby: user.displayName,
      ava_resolutioncode: 'Resolved-Rejected',
      ava_currentstepindex: 0,
    });
    return { record: updated, actionsTaken: ['Approval rejected'], pausedOn: 'resolved' };
  }

  const stages = stagesFor(config, record._ava_casetypeid_value ?? '');
  const stage = stageByCode(stages, record.ava_stagecode);
  const steps = stage ? stepsForStage(stepsFor(config, stages), stage.ava_lddstageid) : [];
  const idx = steps.findIndex((s) => s.ava_kind === 'Sub-Process');
  const updated = await updateWorkCase(record.ava_lddworkcaseid, {
    ava_status: `Open-${record.ava_stagename ?? ''}`,
    ava_currentstepindex: idx >= 0 ? idx + 1 : (record.ava_currentstepindex ?? 0) + 1,
  });
  return advanceCase(updated, config, user);
}

/** Manually switches the case onto an alternate stage such as Escalation or Rework. */
export async function changeStage(
  record: LddWorkCase,
  toStageCode: string,
  note: string,
  config: ProcessConfig,
  user: CurrentUser
): Promise<AdvanceResult> {
  const stages = stagesFor(config, record._ava_casetypeid_value ?? '');
  const target = stageByCode(stages, toStageCode);
  if (!target) throw new Error(`Unknown stage ${toStageCode}`);

  const updated = await updateWorkCase(record.ava_lddworkcaseid, {
    ava_stagecode: target.ava_stagecode,
    ava_stagename: target.ava_name,
    ava_status: `Open-${target.ava_name}`,
    ava_currentstepindex: 0,
  });
  await log(updated.ava_lddworkcaseid, 'StageChange', `Moved to ${target.ava_name}`, user, {
    ava_fromstage: record.ava_stagename,
    ava_tostage: target.ava_name,
    ava_details: note,
  });
  return advanceCase(updated, config, user);
}

/** Creates a case of the given type and runs it up to its first pause point. */
export async function createCase(
  caseType: LddCaseType,
  detailValues: Record<string, unknown>,
  caseValues: Record<string, unknown>,
  config: ProcessConfig,
  user: CurrentUser
): Promise<AdvanceResult> {
  const code = (caseType.ava_code ?? '') as CaseTypeCode;
  const stages = stagesFor(config, caseType.ava_lddcasetypeid);
  const first = primaryStages(stages)[0];
  if (!first) throw new Error(`${caseType.ava_name} has no primary stages configured`);

  const existing = (await listWorkCases()).map((c) => c.ava_name);
  const caseId = nextCaseId(caseType, existing);

  const created = await createWorkCase({
    ava_name: caseId,
    ava_casetypecode: code,
    ava_stagecode: first.ava_stagecode,
    ava_stagename: first.ava_name,
    ava_status: `Open-${first.ava_name}`,
    ava_urgency: caseType.ava_urgency || 'Medium',
    ava_priority: Number(caseType.ava_urgency) || 10,
    ava_currentstepindex: 0,
    ava_createdbyuser: user.displayName,
    'ava_CaseTypeId@odata.bind': bind('ava_lddcasetypes', caseType.ava_lddcasetypeid),
    statecode: 0,
    ...caseValues,
  });

  await createCaseDetail(code, {
    ava_name: caseId,
    ...detailValues,
    'ava_WorkCaseId@odata.bind': bind('ava_lddworkcases', created.ava_lddworkcaseid),
    statecode: 0,
  });

  await log(created.ava_lddworkcaseid, 'Created', `Case ${caseId} created`, user, {
    ava_tostage: first.ava_name,
  });

  return advanceCase(created, config, user);
}

export type { CaseDetail };
