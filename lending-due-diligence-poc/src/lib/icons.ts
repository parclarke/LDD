/**
 * Icon set lifted verbatim from the Pegakit prototype (`app.js` ICONS) so the
 * PoC renders the same glyphs as the generated design.
 */
export const ICONS: Record<string, string> = {
  plus: 'M10 4v12M4 10h12',
  home: 'M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1z',
  work: 'M4 3h12v14H4zM7 3V2h6v1M7 8h6M7 11h6',
  search: 'M9 3a6 6 0 104.2 10.2L17 17M9 3a6 6 0 010 12',
  apps: 'M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z',
  data: 'M10 3c3.3 0 6 1.3 6 3s-2.7 3-6 3-6-1.3-6-3 2.7-3 6-3zM4 6v8c0 1.7 2.7 3 6 3s6-1.3 6-3V6',
  chart: 'M3 17V8M8 17V3M13 17v-6M18 17v-9',
  clip: 'M6 2h8v16H6zM8 2V1h4v1M8 7h4M8 10h4M8 13h3',
  risk: 'M10 2l8 15H2zM10 8v3M10 14h.01',
  shield: 'M10 2l6 2.5v4.5c0 3.6-2.5 6.6-6 7.5-3.5-.9-6-3.9-6-7.5V4.5z',
  flag: 'M5 2v16M5 3h10l-2 3.5L15 10H5',
  bulb: 'M10 2a4.5 4.5 0 00-2.6 8.2V13h5.2v-2.8A4.5 4.5 0 0010 2zM8 16h4',
  gauge: 'M10 17a7 7 0 110-14 7 7 0 010 14zM10 10l3.5-3',
  wave: 'M2 10h2l2-5 3 10 3-8 2 3h4',
  bell: 'M10 3a4 4 0 00-4 4v3l-1.5 2.5h11L14 10V7a4 4 0 00-4-4zM8 16h4',
  clock: 'M10 17a7 7 0 110-14 7 7 0 010 14zM10 6v4l2.5 2',
  spark: 'M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6z',
  play: 'M6 4l9 6-9 6z',
  colv: 'M3 4h14M3 10h14M3 16h14',
  expand: 'M3 8V3h5M17 12v5h-5M3 3l6 6M17 17l-6-6',
  kebab: 'M10 5.5h.01M10 10h.01M10 14.5h.01',
  image: 'M3 4h14v12H3zM3 13l4-4 3 3 3-3 4 4M7.5 7.5h.01',
  paper: 'M11 3L5 9a3 3 0 004.2 4.2l6-6a4.5 4.5 0 00-6.4-6.4L3 6.6',
  pencil: 'M13.5 3.5l3 3L7 16H4v-3zM12 5l3 3',
  collapse: 'M12 4l-5 6 5 6M4 3v14',
  expandnav: 'M8 4l5 6-5 6M16 3v14',
  mic: 'M10 3a2 2 0 012 2v4a2 2 0 01-4 0V5a2 2 0 012-2zM5 9a5 5 0 0010 0M10 14v3',
  emoji: 'M10 17a7 7 0 110-14 7 7 0 010 14zM7.5 8h.01M12.5 8h.01M7 12c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4',
  send: 'M3 10l14-6-5 14-2.5-5.5z',
  filter: 'M3 4h14l-5.5 6.5V16l-3 1.5v-7z',
};

/** Case-type icon mapping, also from the prototype. */
const CASE_ICON: Record<string, string> = {
  LendingReview: 'clip',
  RiskAssessment: 'risk',
  ComplianceMonitoring: 'shield',
  EscalationManagement: 'flag',
  QualityRecommendation: 'bulb',
};

const FALLBACK = ['clip', 'risk', 'shield', 'flag', 'bulb', 'gauge', 'wave'];

export function iconFor(code: string | undefined, index: number): string {
  if (code && CASE_ICON[code]) return CASE_ICON[code];
  return FALLBACK[index % FALLBACK.length];
}
