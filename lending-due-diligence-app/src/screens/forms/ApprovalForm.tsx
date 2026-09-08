import { useState } from 'react';
import { submitApproval } from '../../lib/orchestrator';
import type { CaseBundle, CurrentUser, LddApproval, ProcessConfig } from '../../lib/types';

interface Props {
  bundle: CaseBundle;
  approval: LddApproval;
  config: ProcessConfig;
  user: CurrentUser;
  onCancel: () => void;
  onDone: (message: string) => void;
}

/**
 * Approve / reject form for a pxApproval sub-process step. Rejecting moves the case
 * to its Approval Rejection stage and resolves it, matching the prototype's
 * RejectionAction of UpdateStatus with Resolved-Rejected.
 */
export function ApprovalForm({ bundle, approval, config, user, onCancel, onDone }: Props) {
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: 'Approved' | 'Rejected') => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitApproval(
        bundle.record,
        approval.ava_lddapprovalid,
        decision,
        comments,
        config,
        user
      );
      onDone(
        `Approval ${decision.toLowerCase()}.${
          result.actionsTaken.length ? ` ${result.actionsTaken.join('; ')}` : ''
        }`
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="task-head">
        <span className="avatar">{user.initials}</span>
        <div>
          <div className="task-title">{approval.ava_name}</div>
          <div className="task-sub">
            Approval required &nbsp;•&nbsp; approver type: {approval.ava_approvertype ?? 'Manager'}
          </div>
        </div>
      </div>

      {error && <div className="banner-msg error">{error}</div>}

      <div className="field-grid cols-1">
        <div className="field">
          <label htmlFor="approvalComments">Comments</label>
          <textarea
            id="approvalComments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="spacer" />
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => decide('Rejected')}
          disabled={busy}
        >
          Reject
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => decide('Approved')}
          disabled={busy}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
