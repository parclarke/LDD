import { useEffect, useState } from 'react';
import { searchTransactions } from '../lib/data';
import type { TransactionFilter } from '../lib/data';
import { dash, formatDate } from '../lib/format';
import { StageStepper } from '../components/StageStepper';
import type { LddTransaction } from '../lib/types';

interface Props {
  onContinue: (transactionId: string) => void;
  onCancel: () => void;
  userInitials: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Initialization stage — "Collect transaction information".
 * Transaction Filter + Search Results grid with a Continue action per row.
 */
export function NewCaseTransactionScreen({ onContinue, onCancel, userInitials }: Props) {
  const [filter, setFilter] = useState<TransactionFilter>({
    applicationDateFrom: '2000-01-01',
    applicationDateTo: today(),
  });
  const [results, setResults] = useState<LddTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSearch = (f: TransactionFilter) => {
    setLoading(true);
    setError(null);
    searchTransactions(f)
      .then(setResults)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    searchTransactions({ applicationDateFrom: '2000-01-01', applicationDateTo: today() })
      .then((r) => !cancelled && setResults(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof TransactionFilter) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilter((prev) => ({ ...prev, [key]: e.target.value || undefined }));

  return (
    <div className="work-area">
      <StageStepper currentStage="Initialization" />

      <div className="panel">
        <div className="task-head">
          <span className="avatar">{userInitials}</span>
          <div>
            <div className="task-title">Collect transaction information</div>
          </div>
        </div>

        <div className="section-title">Transaction Filter</div>
        <hr className="rule" />

        <div className="field-grid">
          <div className="field">
            <label className="req" htmlFor="appFrom">
              Application Date From
            </label>
            <input
              id="appFrom"
              type="date"
              value={filter.applicationDateFrom ?? ''}
              onChange={set('applicationDateFrom')}
            />
          </div>
          <div className="field">
            <label className="req" htmlFor="appTo">
              Application Date To
            </label>
            <input
              id="appTo"
              type="date"
              value={filter.applicationDateTo ?? ''}
              onChange={set('applicationDateTo')}
            />
          </div>
          <div className="field">
            <label htmlFor="fundFrom">Funded Date From</label>
            <input
              id="fundFrom"
              type="date"
              value={filter.fundedDateFrom ?? ''}
              onChange={set('fundedDateFrom')}
            />
          </div>
          <div className="field">
            <label htmlFor="fundTo">Funded Date To</label>
            <input
              id="fundTo"
              type="date"
              value={filter.fundedDateTo ?? ''}
              onChange={set('fundedDateTo')}
            />
          </div>
        </div>

        <div className="form-actions">
          <div className="spacer" />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              const cleared: TransactionFilter = {};
              setFilter(cleared);
              runSearch(cleared);
            }}
          >
            Clear
          </button>
          <button className="btn btn-primary" type="button" onClick={() => runSearch(filter)}>
            Search
          </button>
        </div>

        <div className="section-title" style={{ marginTop: 34 }}>
          Search Results
        </div>
        <hr className="rule" />

        {error && <div className="banner-msg error">{error}</div>}
        {loading ? (
          <div className="loading">Searching transactions…</div>
        ) : (
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Application Date</th>
                  <th>Approval Date</th>
                  <th>Application number</th>
                  <th>PID Description</th>
                  <th>CID Description</th>
                  <th>Status</th>
                  <th>Approval Type</th>
                  <th>Purpose</th>
                  <th>Property Usage</th>
                  <th>Income Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && (
                  <tr>
                    <td colSpan={12} className="empty-row">
                      ✧ No results.
                    </td>
                  </tr>
                )}
                {results.map((t) => (
                  <tr key={t.ava_lddtransactionid}>
                    <td>{dash(t.ava_source)}</td>
                    <td>{formatDate(t.ava_applicationdate)}</td>
                    <td>{formatDate(t.ava_approvaldate)}</td>
                    <td>{dash(t.ava_applicationnumber)}</td>
                    <td>{dash(t.ava_piddescription)}</td>
                    <td>{dash(t.ava_ciddescription)}</td>
                    <td>{dash(t.ava_status)}</td>
                    <td>{dash(t.ava_approvaltype)}</td>
                    <td>{dash(t.ava_purpose)}</td>
                    <td>{dash(t.ava_propertyusage)}</td>
                    <td>{dash(t.ava_incometype)}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => onContinue(t.ava_lddtransactionid)}
                      >
                        Continue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
