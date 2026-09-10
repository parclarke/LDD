import { useEffect, useState } from 'react';
import type { CurrentUser, LddCaseType, ProcessConfig } from '../lib/types';
import { listCustomers, listTransactions } from '../lib/data';
import { createCase } from '../lib/orchestrator';

interface Option {
  id: string;
  label: string;
}

interface CreateCaseDialogProps {
  config: ProcessConfig;
  caseTypes: LddCaseType[];
  /** Case type the operator started from, when the dialog is opened from a case type page. */
  initialCode?: string;
  user: CurrentUser;
  onClose: () => void;
  onCreated: (caseId: string, message: string) => void;
}

/**
 * Case intake form. The source application opens this from the Create menu with
 * just the two identifying references - the lending transaction the case is
 * about and the customer it belongs to. Everything else on the case is derived
 * from the case type configuration when the case is created.
 */
export function CreateCaseDialog({
  config,
  caseTypes,
  initialCode,
  user,
  onClose,
  onCreated,
}: CreateCaseDialogProps) {
  const [code, setCode] = useState(initialCode ?? caseTypes[0]?.ava_code ?? '');
  const [transactionId, setTransactionId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [transactions, setTransactions] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTransactions(), listCustomers()])
      .then(([txns, custs]) => {
        if (cancelled) return;
        setTransactions(
          txns.map((t) => ({
            id: t.ava_lddtransactionid,
            label: t.ava_customername ? `${t.ava_name} - ${t.ava_customername}` : t.ava_name,
          })),
        );
        setCustomers(custs.map((c) => ({ id: c.ava_lddcustomerid, label: c.ava_name })));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const caseType = caseTypes.find((c) => c.ava_code === code) ?? null;
  const title = caseType ? `Create ${caseType.ava_name}` : 'Create case';

  async function submit() {
    if (!caseType) {
      setError('Select a case type');
      return;
    }
    if (!transactionId || !customerId) {
      setError('Lending Transaction and Customer are both required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCase(
        caseType,
        {},
        {
          'ava_TransactionId@odata.bind': `/ava_lddtransactions(${transactionId})`,
          'ava_CustomerId@odata.bind': `/ava_lddcustomers(${customerId})`,
        },
        config,
        user,
      );
      onCreated(
        result.record.ava_lddworkcaseid,
        `${result.record.ava_name} created in ${result.record.ava_stagename ?? 'the first stage'}`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pmodal">
        <div className="pmodal-hd">
          <div className="pmodal-title">
            <b>{title}</b>
          </div>
          <button className="ic first" onClick={onClose} title="Close" type="button">
            ✕
          </button>
        </div>
        <div className="pmodal-body">
          <div className="grid c2">
            {initialCode ? null : (
              <div className="field full">
                <label htmlFor="create-casetype">
                  Case type<span className="req">*</span>
                </label>
                <select id="create-casetype" value={code} onChange={(e) => setCode(e.target.value)}>
                  {caseTypes.map((ct) => (
                    <option key={ct.ava_lddcasetypeid} value={ct.ava_code ?? ''}>
                      {ct.ava_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="create-transaction">
                Lending Transaction<span className="req">*</span>
              </label>
              <select
                id="create-transaction"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              >
                <option value="">Select…</option>
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="create-customer">
                Customer<span className="req">*</span>
              </label>
              <select
                id="create-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <div className="note" style={{ borderLeftColor: '#a4262c', background: '#fde6e6' }}>
              {error}
            </div>
          ) : null}
        </div>
        <div className="pmodal-ft">
          <button className="btn o" onClick={onClose} type="button">
            Cancel
          </button>
          <div className="right">
            <button className="btn" onClick={submit} disabled={busy} type="button">
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
