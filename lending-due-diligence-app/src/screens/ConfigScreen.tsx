import { useState } from 'react';
import { stepsForStage } from '../lib/engine';
import type { ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  appName: string;
}

/**
 * Process model explorer. Shows exactly what was imported from the Pega prototype
 * so a developer or business analyst can confirm the configuration in the running
 * app matches the source design.
 */
export function ConfigScreen({ config, appName }: Props) {
  const [tab, setTab] = useState<'caseTypes' | 'views' | 'choices' | 'decisions' | 'roles'>(
    'caseTypes'
  );

  const totals = {
    caseTypes: config.caseTypes.length,
    stages: config.stages.length,
    steps: config.steps.length,
    views: config.views.length,
    viewFields: config.viewFields.length,
    choiceSets: config.choiceSets.length,
    decisions: config.decisions.length,
    roles: config.roles.length,
  };

  return (
    <>
      <div className="page-title-bar">Process model</div>
      <div className="work-area">
        <div className="panel">
          <p className="muted" style={{ marginTop: 0 }}>
            Configuration imported from the <strong>{appName}</strong> Pega prototype. Everything
            below lives in Dataverse and drives the running app.
          </p>
          <div className="stat-row" style={{ marginTop: 18 }}>
            <Stat value={totals.caseTypes} label="Case types" />
            <Stat value={totals.stages} label="Stages" />
            <Stat value={totals.steps} label="Steps" />
            <Stat value={totals.views} label="Views" />
            <Stat value={totals.viewFields} label="View fields" />
            <Stat value={totals.choiceSets} label="Choice sets" />
            <Stat value={totals.decisions} label="Decision tables" />
            <Stat value={totals.roles} label="Roles" />
          </div>
        </div>

        <div className="panel">
          <div className="tabs">
            {(
              [
                ['caseTypes', 'Case types'],
                ['views', 'Views'],
                ['choices', 'Choice sets'],
                ['decisions', 'Decision tables'],
                ['roles', 'Roles'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`tab${tab === key ? ' active' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'caseTypes' &&
            config.caseTypes.map((ct) => {
              const stages = config.stages
                .filter((s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid)
                .sort((a, b) => {
                  if (a.ava_stagetype !== b.ava_stagetype)
                    return a.ava_stagetype === 'Primary' ? -1 : 1;
                  return (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0);
                });
              return (
                <div key={ct.ava_lddcasetypeid} style={{ marginBottom: 30 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <strong style={{ fontSize: 16 }}>{ct.ava_name}</strong>
                    <span className="pill">{ct.ava_caseprefix}</span>
                    <span className="pill">{ct.ava_detailtable}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
                    {ct.ava_pegaclass}
                  </div>
                  {stages.map((s) => (
                    <div key={s.ava_lddstageid} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <strong style={{ fontSize: 13 }}>{s.ava_name}</strong>
                        <span className={`pill ${s.ava_stagetype === 'Primary' ? 'primary' : 'alt'}`}>
                          {s.ava_stagetype}
                        </span>
                        <span className="pill">{s.ava_transition}</span>
                      </div>
                      <ul className="step-list">
                        {stepsForStage(config.steps, s.ava_lddstageid).map((st, i) => (
                          <li key={st.ava_lddstepid}>
                            <span className="s-index">{i + 1}</span>
                            <span className="s-name">{st.ava_name}</span>
                            <span className="s-kind">
                              {st.ava_kind}
                              {st.ava_impl ? ` / ${st.ava_impl}` : ''}
                              {st.ava_viewname ? ` / ${st.ava_viewname}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}

          {tab === 'views' && (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>View</th>
                    <th>Case type</th>
                    <th>Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {config.views.map((v) => {
                    const fields = config.viewFields
                      .filter((f) => f._ava_viewid_value === v.ava_lddviewid)
                      .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
                    return (
                      <tr key={v.ava_lddviewid}>
                        <td>
                          <strong>{v.ava_name}</strong>
                        </td>
                        <td>{v.ava_casetypecode}</td>
                        <td>
                          {fields.map((f) => (
                            <span key={f.ava_lddviewfieldid} className="pill" style={{ margin: '0 4px 4px 0' }}>
                              {f.ava_name}: {f.ava_control}
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'choices' && (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Choice set</th>
                    <th>Values</th>
                  </tr>
                </thead>
                <tbody>
                  {config.choiceSets.map((cs) => (
                    <tr key={cs.ava_lddchoicesetid}>
                      <td>
                        <strong>{cs.ava_name}</strong>
                        <br />
                        <span className="muted">{cs.ava_label}</span>
                      </td>
                      <td>
                        {config.choiceValues
                          .filter((v) => v._ava_choicesetid_value === cs.ava_lddchoicesetid)
                          .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0))
                          .map((v) => (
                            <span key={v.ava_lddchoicevalueid} className="pill" style={{ margin: '0 4px 4px 0' }}>
                              {v.ava_name}
                            </span>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'decisions' &&
            config.decisions.map((d) => {
              const conditions: string[] = safeParse(d.ava_conditions);
              const rows = config.decisionRows
                .filter((r) => r._ava_decisionid_value === d.ava_ldddecisionid)
                .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
              return (
                <div key={d.ava_ldddecisionid} style={{ marginBottom: 26 }}>
                  <strong>{d.ava_name}</strong>{' '}
                  <span className="pill">{d.ava_casetypecode}</span>
                  <div className="muted" style={{ fontSize: 12, margin: '3px 0 8px' }}>
                    {d.ava_description}
                  </div>
                  <div className="grid-wrap">
                    <table className="grid">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Op</th>
                          {conditions.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const when: string[] = safeParse(r.ava_whenvalues);
                          return (
                            <tr key={r.ava_ldddecisionrowid}>
                              <td>{r.ava_operator}</td>
                              {conditions.map((c, i) => (
                                <td key={c}>{when[i] ?? '—'}</td>
                              ))}
                              <td>
                                <strong>{r.ava_result}</strong>
                              </td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td>otherwise</td>
                          {conditions.map((c) => (
                            <td key={c}>—</td>
                          ))}
                          <td>
                            <strong>{d.ava_otherwise}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

          {tab === 'roles' && (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Access group</th>
                    <th>Workbasket</th>
                    <th>Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {config.roles.map((r) => (
                    <tr key={r.ava_lddroleid}>
                      <td>
                        <strong>{r.ava_name}</strong>
                      </td>
                      <td>{r.ava_accessgroup}</td>
                      <td>{r.ava_workbasket}</td>
                      <td>{r.ava_ismanager ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function safeParse<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
