import { dash, formatDate, formatDateTime } from '../lib/format';
import type { LddCase, LddCaseError, LddRating, LddTransaction } from '../lib/types';

interface Props {
  section: string;
  record: LddCase;
  transaction: LddTransaction | null;
  ratings: LddRating[];
  caseErrors: LddCaseError[];
}

/** Read-only case sections reachable from the left-hand case navigation. */
export function CaseSections({ section, record, transaction, ratings, caseErrors }: Props) {
  if (section === 'Transaction Information') {
    return (
      <div className="panel">
        <div className="section-title">Transaction Information</div>
        <hr className="rule" />
        <div className="field-grid" style={{ rowGap: 24 }}>
          <RO label="Transaction Level Unique ID" v={dash(transaction?.ava_name)} />
          <RO label="Source" v={dash(transaction?.ava_source)} />
          <RO label="Application number" v={dash(transaction?.ava_applicationnumber)} />
          <RO label="Class Number" v={dash(transaction?.ava_classnumber)} />
          <RO label="Application Date" v={formatDate(transaction?.ava_applicationdate)} />
          <RO label="Approval Date" v={formatDate(transaction?.ava_approvaldate)} />
          <RO label="Funded Date" v={formatDate(transaction?.ava_fundeddate)} />
          <RO label="Status" v={dash(transaction?.ava_status)} />
          <RO label="Approval Type" v={dash(transaction?.ava_approvaltype)} />
          <RO label="Customer name" v={dash(transaction?.ava_customername)} />
          <RO label="Product Type" v={dash(transaction?.ava_producttype)} />
          <RO label="Purpose" v={dash(transaction?.ava_purpose)} />
          <RO label="PID Description" v={dash(transaction?.ava_piddescription)} />
          <RO label="CID Description" v={dash(transaction?.ava_ciddescription)} />
          <RO label="Property Usage" v={dash(transaction?.ava_propertyusage)} />
          <RO label="Income Type" v={dash(transaction?.ava_incometype)} />
          <RO label="Mortgage Number" v={dash(transaction?.ava_mortgagenumber)} />
          <RO label="MMortgage Number" v={dash(transaction?.ava_mmortgagenumber)} />
          <RO label="Channel" v={dash(transaction?.ava_channel)} />
          <RO label="Transit" v={dash(transaction?.ava_transit)} />
        </div>
      </div>
    );
  }

  if (section === 'Additional Metrics') {
    return (
      <div className="panel">
        <div className="section-title">Additional Metrics</div>
        <hr className="rule" />
        <div className="field-grid" style={{ rowGap: 24 }}>
          <RO label="Requested Amount" v={money(transaction?.ava_requestedamount)} />
          <RO label="Funded Amount" v={money(transaction?.ava_fundedamount)} />
          <RO label="Credit Score" v={dash(transaction?.ava_creditscore)} />
          <RO label="Loan To Value" v={pct(transaction?.ava_loantovalue)} />
          <RO label="GDSR" v={pct(transaction?.ava_gdsr)} />
          <RO label="TDSR" v={pct(transaction?.ava_tdsr)} />
        </div>
      </div>
    );
  }

  if (section === 'Employee Information') {
    return (
      <div className="panel">
        <div className="section-title">Employee Information</div>
        <hr className="rule" />
        <div className="field-grid" style={{ rowGap: 24 }}>
          <RO label="Operator ID" v={dash(transaction?.ava_operatorid)} />
          <RO label="Overrider ID" v={dash(transaction?.ava_overriderid)} />
          <RO label="Region" v={dash(transaction?.ava_region)} />
          <RO label="Market" v={dash(transaction?.ava_market)} />
        </div>

        <div className="subpanel" style={{ marginTop: 26 }}>
          <div className="subpanel-title">1st level manager details</div>
          <hr className="rule" style={{ margin: '10px 0 18px' }} />
          <div className="field-grid" style={{ rowGap: 22 }}>
            <RO label="Operator ID" v={dash(record.ava_mgr1operatorid)} />
            <RO label="COINS ID" v={dash(record.ava_mgr1coinsid)} />
            <RO label="Employee Name" v={dash(record.ava_mgr1name)} />
            <RO label="Email address" v={dash(record.ava_mgr1email)} />
            <RO label="Job Title" v={dash(record.ava_mgr1jobtitle)} />
            <RO label="Transit" v={dash(record.ava_mgr1transit)} />
          </div>
        </div>

        <div className="subpanel">
          <div className="subpanel-title">2nd level manager details</div>
          <hr className="rule" style={{ margin: '10px 0 18px' }} />
          <div className="field-grid" style={{ rowGap: 22 }}>
            <RO label="Operator ID" v={dash(record.ava_mgr2operatorid)} />
            <RO label="COINS ID" v={dash(record.ava_mgr2coinsid)} />
            <RO label="Employee Name" v={dash(record.ava_mgr2name)} />
            <RO label="Email address" v={dash(record.ava_mgr2email)} />
            <RO label="Job Title" v={dash(record.ava_mgr2jobtitle)} />
            <RO label="Transit" v={dash(record.ava_mgr2transit)} />
          </div>
        </div>
      </div>
    );
  }

  if (section === 'Rating and Recommendation') {
    return (
      <div className="panel">
        <div className="section-title">Rating and Recommendation</div>
        <hr className="rule" />
        {ratings.length === 0 && <div className="empty-row">✧ No results.</div>}
        {ratings.map((r) => {
          const errs = caseErrors.filter((e) => e._ava_ratingid_value === r.ava_lddratingid);
          const primary = errs.find((e) => e.ava_isprimary) ?? errs[0];
          const secondary = errs.filter((e) => e !== primary);
          return (
            <div key={r.ava_lddratingid} style={{ marginBottom: 28 }}>
              <div className="tabs">
                <button type="button" className="tab active">
                  {r.ava_role}
                </button>
              </div>
              <div className="field-grid" style={{ rowGap: 22 }}>
                <RO label="Operator ID ⓘ" v={dash(r.ava_operatorid)} />
                <RO label="Employee Name" v={dash(r.ava_employeename)} />
              </div>

              <div className="section-title" style={{ marginTop: 24 }}>
                Primary and Secondary Error(s)
              </div>
              <hr className="rule" />
              {primary ? (
                <>
                  <div className="readonly-pair">
                    <span className="tag">Primary Error</span>
                    <span className="arrow">→</span>
                    <span>{primary.ava_name}</span>
                  </div>
                  {secondary.map((e) => (
                    <div className="readonly-pair" key={e.ava_lddcaseerrorid}>
                      <span className="tag">Secondary Error</span>
                      <span className="arrow">→</span>
                      <span>{e.ava_name}</span>
                    </div>
                  ))}
                  <div className="section-title" style={{ marginTop: 22 }}>
                    Erreurs primaire et secondaire
                  </div>
                  <hr className="rule" />
                  <div className="readonly-pair">
                    <span className="tag">Erreur principale</span>
                    <span className="arrow">→</span>
                    <span>{primary.ava_namefr || primary.ava_name}</span>
                  </div>
                </>
              ) : (
                <div className="empty-row">No errors recorded.</div>
              )}

              <div className="field-grid" style={{ marginTop: 24, rowGap: 26 }}>
                <RO label="BC due diligence" v={dash(r.ava_bcduediligence)} />
                <RO label="Employee Accountable" v={dash(r.ava_employeeaccountable)} />
                <RO
                  label="Reason for Reversal or Reduced to coaching"
                  v={dash(r.ava_reasonforreversal)}
                />
                <RO label="Comments by analyst" v={dash(r.ava_comments)} />
                <RO label="Reversal Status" v={dash(r.ava_reversalstatus)} />
                <RO label="Attestation Provided?" v={dash(r.ava_attestationprovided)} />
                <RO label="Comments by Frontline Manager" v={dash(r.ava_frontlinemanagercomments)} />
                <RO label="Response Date" v={formatDateTime(r.ava_responsedate)} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'Attachment List') {
    return (
      <div className="panel">
        <div className="section-title">Attachment List</div>
        <hr className="rule" />
        <div className="empty-row">✧ No results.</div>
      </div>
    );
  }

  return null;
}

function RO({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="readonly-label">{label}</div>
      <div className="readonly-value">{v}</div>
    </div>
  );
}

function money(v?: number | null): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

function pct(v?: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v}%`;
}
