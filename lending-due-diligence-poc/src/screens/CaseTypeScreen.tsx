import { caseTypeName, openAssignmentFor, type AppData } from '../lib/appdata';
import { PageHeader, StatusChip, Toolbar } from '../components/Primitives';
import { ChartCard } from '../components/Chart';
import { iconFor } from '../lib/icons';
import { urgencyOf } from '../lib/status';
import { formatDate } from '../lib/format';
import { asSeries, countBy, crossTab, created, monthlySeries, statusBucket } from '../lib/analytics';
import type { LddWorkCase } from '../lib/types';

interface CaseTypeScreenProps {
  data: AppData;
  code: string;
  onOpenCase: (caseId: string) => void;
  onOpenAssignment: (caseId: string, assignmentId: string) => void;
  onCreate: (code: string) => void;
}

/** The three insight cards each case type reports on, keyed by Pega case type code. */
const REPORTS: Record<string, { bar: string; barX: string; barY: string; line: string; lineX: string; lineY: string; pie: string }> = {
  LendingReview: {
    bar: 'Quality Review Results Across Business Units',
    barX: 'Business unit',
    barY: 'Count Quality revi…',
    line: 'Lending Review Requests Over Time',
    lineX: 'Review requested date',
    lineY: 'Count Case ID',
    pie: 'Breakdown of Reviews by Risk Rating',
  },
  RiskAssessment: {
    bar: 'Distribution of Risk Ratings Across Assessments',
    barX: 'Risk rating',
    barY: 'Count Risk rating',
    line: 'Number of Assessments Completed Each Month',
    lineX: 'Assessment date',
    lineY: 'Count Assessment dat…',
    pie: 'Final Outcomes Grouped by Risk Type',
  },
  ComplianceMonitoring: {
    bar: 'Distribution of Compliance Findings by Severity Level',
    barX: 'Issue severity',
    barY: 'Count Case ID',
    line: 'Compliance Reviews Conducted Over Time',
    lineX: 'Review date',
    lineY: 'Count Case ID',
    pie: 'Compliance Assessment Results Across Regulatory Requirements',
  },
  EscalationManagement: {
    bar: 'Distribution of Cases Across Urgency Levels',
    barX: 'Escalation urgency level',
    barY: 'Count Case ID',
    line: 'Escalation Volume Over Time by Month',
    lineX: 'Date escalated',
    lineY: 'Count Case ID',
    pie: 'Case Distribution Across Escalation Categories',
  },
  QualityRecommendation: {
    bar: 'Distribution of Quality Recommendations Across Types',
    barX: 'Recommendation type',
    barY: 'Count Quality recom…',
    line: 'Monthly Trend of Recommendation Resolutions Over Time',
    lineX: 'Actual resolution date',
    lineY: 'Count Actual resol…',
    pie: 'Breakdown of Recommendations by Business Priority Level',
  },
};

const DEFAULT_REPORT = {
  bar: 'Distribution of Cases by Stage',
  barX: 'Stage',
  barY: 'Count Case ID',
  line: 'Case Volume Over Time by Month',
  lineX: 'Created date',
  lineY: 'Count Case ID',
  pie: 'Breakdown of Cases by Status',
};

/**
 * A case type landing page. Pega renders these as an insight report: three
 * staggered charts over the case list. Every series is computed from the live
 * work cases rather than a static extract.
 */
export function CaseTypeScreen({ data, code, onOpenCase, onOpenAssignment, onCreate }: CaseTypeScreenProps) {
  const index = data.caseTypes.findIndex((t) => t.ava_code === code);
  const rows = data.cases.filter((c) => c.ava_casetypecode === code);
  const report = REPORTS[code] ?? DEFAULT_REPORT;

  const stage = (c: LddWorkCase) => c.ava_stagename ?? c.ava_stagecode ?? 'N/A';
  const barSlices = countBy(rows, (c) => (code === 'EscalationManagement' ? c.ava_urgency : stage(c)));
  const lineData = monthlySeries(rows, created, () => 'Count Case ID');
  const pieSlices = countBy(rows, (c) => (code === 'RiskAssessment' ? c.ava_urgency : statusBucket(c)));

  return (
    <>
      <PageHeader icon={iconFor(code, Math.max(0, index))} title={caseTypeName(data, code)}>
        <button className="btn" type="button" onClick={() => onCreate(code)}>
          <span className="sparkle">✦</span> Create
        </button>
      </PageHeader>

      <div className="reportstack">
        <ChartCard
          title={report.bar}
          kind="bar"
          xLabel={report.barX}
          yLabel={report.barY}
          data={asSeries(barSlices, 'Count Case ID')}
        />
        <ChartCard title={report.line} kind="line" xLabel={report.lineX} yLabel={report.lineY} data={lineData} />
        <ChartCard
          title={report.pie}
          kind={code === 'ComplianceMonitoring' || code === 'RiskAssessment' ? 'bar' : 'pie'}
          xLabel={code === 'ComplianceMonitoring' ? 'Regulatory requirement' : code === 'RiskAssessment' ? 'Risk type' : undefined}
          yLabel={code === 'ComplianceMonitoring' || code === 'RiskAssessment' ? 'Count Outcome, C…' : undefined}
          slices={pieSlices}
          data={crossTab(rows, stage, statusBucket)}
        />
      </div>

      <div className="card flush">
        <div className="cardhd">
          <h3>{caseTypeName(data, code)}:</h3>
          <span className="selv">All ▾</span>
          <span className="count">{rows.length} results</span>
          <Toolbar />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Assignment</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Due date</th>
                <th className="num">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No cases of this type
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const a = openAssignmentFor(data, c.ava_lddworkcaseid);
                  return (
                    <tr key={c.ava_lddworkcaseid}>
                      <td>
                        <a onClick={() => onOpenCase(c.ava_lddworkcaseid)}>{c.ava_name}</a>
                      </td>
                      <td>
                        {a ? (
                          <a onClick={() => onOpenAssignment(c.ava_lddworkcaseid, a.ava_lddassignmentid)}>{a.ava_name}</a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{stage(c)}</td>
                      <td className="statcell">
                        <StatusChip status={c.ava_status} />
                      </td>
                      <td className="muted">{a?.ava_deadline ? formatDate(a.ava_deadline) : '—'}</td>
                      <td className="num">{urgencyOf(c)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
