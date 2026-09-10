import type { AppData } from '../lib/appdata';
import { Icon } from '../components/Icon';
import { INSIGHTS } from '../lib/catalog';
import { workMetrics } from '../lib/analytics';

interface InsightScreenProps {
  data: AppData;
  id: string;
  onBack: () => void;
}

/** Insight detail: the single large metric with its period-on-period delta. */
export function InsightScreen({ data, id, onBack }: InsightScreenProps) {
  const insight = INSIGHTS.find((i) => i.id === id) ?? INSIGHTS[0];
  const metrics = workMetrics(data.cases, data.assignments);

  const value = metrics[insight.metric];
  const change =
    insight.metric === 'createdThisMonth'
      ? metrics.createdChange
      : insight.metric === 'resolvedThisMonth'
        ? metrics.resolvedChange
        : insight.metric === 'pastDeadline'
          ? metrics.pastDeadlineChange
          : undefined;

  return (
    <>
      <div className="crumbs">
        <a onClick={onBack}>Explore Data</a>
        <span>/</span>
        <strong>{insight.name}</strong>
      </div>

      <div className="ph">
        <div className="badge">
          <Icon name="chart" />
        </div>
        <div>
          <h1>{insight.name}</h1>
          <div className="sub">{insight.description}</div>
        </div>
      </div>

      <section className="insight-big">
        <div className="lab">{insight.name}</div>
        <div className="val">
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}
          {insight.suffix ?? ''}
        </div>
        {change === undefined ? null : (
          <div className={change < 0 ? 'delta down' : 'delta'}>
            {change < 0 ? '↓' : '↑'} {Math.abs(change)}% since last month
          </div>
        )}
      </section>
    </>
  );
}
