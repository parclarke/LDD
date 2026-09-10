import { useState } from 'react';
import type { AppData } from '../lib/appdata';
import { PageHeader, Toolbar } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { INSIGHTS } from '../lib/catalog';
import { workMetrics } from '../lib/analytics';

interface ExploreScreenProps {
  data: AppData;
  onOpenInsight: (id: string) => void;
}

/**
 * Explore Data: a collapsible "Recently opened" strip over the insight
 * catalogue, grouped under the application heading like the source app.
 */
export function ExploreScreen({ data, onOpenInsight }: ExploreScreenProps) {
  const [recentOpen, setRecentOpen] = useState(true);
  const metrics = workMetrics(data.cases, data.assignments);
  const featured = INSIGHTS[0];

  return (
    <>
      <PageHeader icon="search" title="Explore Data">
        <button className="btn" type="button">
          Explore Data <span className="caret">▾</span>
        </button>
      </PageHeader>

      <button
        className={recentOpen ? 'section-toggle' : 'section-toggle closed'}
        type="button"
        onClick={() => setRecentOpen((v) => !v)}
      >
        <span className="caret">▾</span> Recently opened
      </button>

      {recentOpen ? (
        <div className="recentwrap">
          <button className="recent" type="button" onClick={() => onOpenInsight(featured.id)}>
            <span className="ic">
              <Icon name="chart" />
            </span>
            <span className="body">
              <span className="t">{featured.name}</span>
              <span className="n">{metrics.resolvedThisMonth}</span>
              <span className={metrics.resolvedChange < 0 ? 'delta down' : 'delta'}>
                {metrics.resolvedChange < 0 ? '↓' : '↑'} {Math.abs(metrics.resolvedChange)}% since last month
              </span>
            </span>
          </button>
        </div>
      ) : null}

      <div className="card flush">
        <div className="cardhd">
          <h3>Insights:</h3>
          <span className="selv">All ▾</span>
          <span className="count">{INSIGHTS.length} results</span>
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
              <tr className="grouprow">
                <td colSpan={5}>
                  <Icon name="apps" /> All work in my application ({INSIGHTS.length})
                </td>
              </tr>
              {INSIGHTS.map((i) => (
                <tr key={i.id}>
                  <td>
                    <a onClick={() => onOpenInsight(i.id)}>{i.name}</a>
                  </td>
                  <td className="muted">{i.description}</td>
                  <td>
                    <span className="vis">{i.visibility}</span>
                  </td>
                  <td className="muted">{i.updated}</td>
                  <td className="muted">{i.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
