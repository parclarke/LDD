import type { Series, Slice } from '../lib/analytics';
import { colorAt } from '../lib/palette';
import { Icon } from './Icon';

const W = 560;
const H = 210;
const M = { top: 10, right: 8, bottom: 52, left: 40 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

/** Rounds an axis maximum up to a readable tick interval. */
function ticks(max: number): { max: number; values: number[] } {
  if (max <= 0) return { max: 1, values: [0, 1] };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) values.push(Number(v.toFixed(6)));
  return { max: top, values };
}

function Grid({ axis }: { axis: { max: number; values: number[] } }) {
  return (
    <g className="grid">
      {axis.values.map((v) => {
        const y = M.top + PH - (v / axis.max) * PH;
        return (
          <g key={v}>
            <line x1={M.left} x2={M.left + PW} y1={y} y2={y} />
            <text className="tick" x={M.left - 6} y={y + 3} textAnchor="end">
              {v}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CategoryLabels({ categories }: { categories: string[] }) {
  const band = PW / Math.max(1, categories.length);
  return (
    <g>
      {categories.map((c, i) => {
        const x = M.left + band * i + band / 2;
        const y = M.top + PH + 10;
        return (
          <text className="tick cat" key={`${c}-${i}`} x={x} y={y} transform={`rotate(-38 ${x} ${y})`} textAnchor="end">
            {c.length > 16 ? `${c.slice(0, 15)}…` : c}
          </text>
        );
      })}
    </g>
  );
}

function Bars({ data, stacked }: { data: Series; stacked: boolean }) {
  const totals = data.categories.map((_, i) =>
    stacked
      ? data.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
      : Math.max(...data.series.map((s) => s.values[i] ?? 0))
  );
  const axis = ticks(Math.max(...totals, 0));
  const band = PW / Math.max(1, data.categories.length);
  const groupWidth = Math.min(band * 0.55, 64);
  const barWidth = stacked ? groupWidth : groupWidth / Math.max(1, data.series.length);

  return (
    <>
      <Grid axis={axis} />
      {data.categories.map((c, i) => {
        const left = M.left + band * i + (band - groupWidth) / 2;
        let stackTop = M.top + PH;
        return (
          <g key={`${c}-${i}`}>
            {data.series.map((s, j) => {
              const value = s.values[i] ?? 0;
              const h = (value / axis.max) * PH;
              if (h <= 0) return null;
              const x = stacked ? left : left + barWidth * j;
              const y = stacked ? stackTop - h : M.top + PH - h;
              if (stacked) stackTop -= h;
              return (
                <g key={s.name}>
                  <rect x={x} y={y} width={barWidth} height={h} fill={colorAt(j)} />
                  {stacked && h > 12 ? (
                    <text className="barval" x={x + barWidth / 2} y={y + h / 2 + 3} textAnchor="middle">
                      {value}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
      <CategoryLabels categories={data.categories} />
    </>
  );
}

function Lines({ data }: { data: Series }) {
  const axis = ticks(Math.max(...data.series.flatMap((s) => s.values), 0));
  const n = Math.max(1, data.categories.length);
  const x = (i: number) => (n === 1 ? M.left + PW / 2 : M.left + (PW / (n - 1)) * i);
  const y = (v: number) => M.top + PH - (v / axis.max) * PH;

  return (
    <>
      <Grid axis={axis} />
      {data.series.map((s, j) => (
        <g key={s.name}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={colorAt(j)} strokeWidth={1.6} />
          {s.values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={2.4} fill={colorAt(j)} />
          ))}
        </g>
      ))}
      <g>
        {data.categories.map((c, i) => {
          const cy = M.top + PH + 10;
          return (
            <text className="tick cat" key={`${c}-${i}`} x={x(i)} y={cy} transform={`rotate(-38 ${x(i)} ${cy})`} textAnchor="end">
              {c}
            </text>
          );
        })}
      </g>
    </>
  );
}

/** Cumulative pie geometry, computed outside render so the component stays pure. */
function arcsFor(slices: Slice[], total: number) {
  let running = -Math.PI / 2;
  return slices.map((s) => {
    const start = running;
    const sweep = (s.value / total) * Math.PI * 2;
    running += sweep;
    return { label: s.label, start, end: running, sweep };
  });
}

function Pie({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const cx = M.left + PW / 2;
  const cy = M.top + PH / 2;
  const r = Math.min(PW, PH) / 2 - 6;

  if (total === 0) return null;
  if (slices.length === 1) return <circle cx={cx} cy={cy} r={r} fill={colorAt(0)} />;

  // Angles are accumulated up front so the render pass stays free of mutation.
  const arcs = arcsFor(slices, total);

  return (
    <>
      {arcs.map((a, i) => {
        const x1 = cx + r * Math.cos(a.start);
        const y1 = cy + r * Math.sin(a.start);
        const x2 = cx + r * Math.cos(a.end);
        const y2 = cy + r * Math.sin(a.end);
        const large = a.sweep > Math.PI ? 1 : 0;
        return (
          <path
            key={a.label}
            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
            fill={colorAt(i)}
          />
        );
      })}
    </>
  );
}

export interface ChartCardProps {
  title: string;
  kind: 'bar' | 'stacked' | 'line' | 'pie';
  xLabel?: string;
  yLabel?: string;
  data?: Series;
  slices?: Slice[];
}

/**
 * One Pega insight card: title, action icons, plot with axis titles and a
 * right-hand legend. Everything is plain SVG so the app carries no chart library.
 */
export function ChartCard({ title, kind, xLabel, yLabel, data, slices }: ChartCardProps) {
  const legend =
    kind === 'pie'
      ? (slices ?? []).map((s, i) => ({ name: s.label, color: colorAt(i) }))
      : (data?.series ?? []).map((s, i) => ({ name: s.name, color: colorAt(i) }));

  const hasData = kind === 'pie' ? (slices ?? []).some((s) => s.value > 0) : (data?.categories.length ?? 0) > 0;

  return (
    <section className="chartcard">
      <div className="chartcard-hd">
        <h3 title={title}>{title}</h3>
        <div className="acts">
          <button title="Expand" type="button">
            <Icon name="expand" />
          </button>
          <button title="More" type="button">
            <Icon name="kebab" />
          </button>
        </div>
      </div>
      <div className="chartcard-body">
        <div className="chart-plot">
          {yLabel ? <div className="axis-y">{yLabel}</div> : null}
          {hasData ? (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
              {kind === 'pie' ? <Pie slices={slices ?? []} /> : null}
              {kind === 'line' && data ? <Lines data={data} /> : null}
              {(kind === 'bar' || kind === 'stacked') && data ? <Bars data={data} stacked={kind === 'stacked'} /> : null}
            </svg>
          ) : (
            <div className="empty">No data</div>
          )}
        </div>
        <ul className="chart-legend">
          {legend.map((l) => (
            <li key={l.name}>
              <i style={{ background: l.color }} />
              <span title={l.name}>{l.name}</span>
            </li>
          ))}
        </ul>
      </div>
      {xLabel ? <div className="axis-x">{xLabel}</div> : null}
    </section>
  );
}
