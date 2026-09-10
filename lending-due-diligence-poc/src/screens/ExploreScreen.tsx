import { caseTypeName, openAssignmentFor, type AppData } from '../lib/appdata';
import { PageHeader, StatusChip, Toolbar } from '../components/Primitives';
import { formatDate } from '../lib/format';

interface ExploreScreenProps {
  data: AppData;
  search: string;
  onOpenCase: (caseId: string) => void;
}

/** Mirrors `pageExplore()`: every case in the application, filtered by search. */
export function ExploreScreen({ data, search, onOpenCase }: ExploreScreenProps) {
  const q = search.trim().toLowerCase();
  const cases = q
    ? data.cases.filter((c) =>
        [c.ava_name, c.ava_status, c.ava_stagename, caseTypeName(data, c.ava_casetypecode)]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : data.cases;

  return (
    <>
      <PageHeader icon="search" title="Explore" sub={q ? `Filtered by “${search}”` : undefined} />
      <div className="card flush">
        <div className="cardhd">
          <h3>All cases</h3>
          <span className="count">{cases.length} results</span>
          <Toolbar />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Case Type</th>
                <th>Status</th>
                <th>Assignment</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No cases
                  </td>
                </tr>
              ) : (
                cases.map((c) => {
                  const a = openAssignmentFor(data, c.ava_lddworkcaseid);
                  return (
                    <tr key={c.ava_lddworkcaseid}>
                      <td>
                        <a onClick={() => onOpenCase(c.ava_lddworkcaseid)}>{c.ava_name}</a>
                      </td>
                      <td>{caseTypeName(data, c.ava_casetypecode)}</td>
                      <td className="statcell">
                        <StatusChip status={c.ava_status} />
                      </td>
                      <td>{a?.ava_name ?? '—'}</td>
                      <td className="muted">{formatDate(c.createdon)}</td>
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
