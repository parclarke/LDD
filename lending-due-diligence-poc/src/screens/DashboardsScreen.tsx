import { PageHeader, Toolbar } from '../components/Primitives';
import { DASHBOARDS } from '../lib/catalog';

interface DashboardsScreenProps {
  onOpen: (id: string) => void;
}

/** The Dashboards catalogue page. */
export function DashboardsScreen({ onOpen }: DashboardsScreenProps) {
  return (
    <>
      <PageHeader icon="apps" title="Dashboards">
        <button className="btn" type="button">
          Create Dashboard
        </button>
      </PageHeader>

      <div className="card flush">
        <div className="cardhd">
          <h3>Dashboards</h3>
          <span className="count">{DASHBOARDS.length} results</span>
          <Toolbar />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Visibility</th>
                <th>Update time</th>
                <th>Update operator name</th>
              </tr>
            </thead>
            <tbody>
              {DASHBOARDS.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a onClick={() => onOpen(d.id)}>{d.name}</a>
                  </td>
                  <td className="muted">{d.description}</td>
                  <td>
                    <span className="vis">{d.visibility}</span>
                  </td>
                  <td className="muted">{d.updated}</td>
                  <td className="muted">{d.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
