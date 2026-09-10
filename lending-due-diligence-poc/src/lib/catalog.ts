/** Dashboard catalogue, mirroring the Dashboards list in the source application. */
export interface DashboardDef {
  id: string;
  name: string;
  description: string;
  visibility: string;
  updated: string;
  operator: string;
}

export const DASHBOARDS: DashboardDef[] = [
  {
    id: 'work-metrics',
    name: 'Work metrics',
    description: 'Track work item creation, resolution and deadline performance.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
  },
  {
    id: 'email-bot-metrics',
    name: 'Email bot metrics',
    description: 'Monitor inbound correspondence handled by the email bot.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
  },
];

/** Insight catalogue backing Explore Data and the insight detail pages. */
export interface InsightDef {
  id: string;
  name: string;
  description: string;
  visibility: string;
  updated: string;
  operator: string;
  /** Which derived metric the detail page renders. */
  metric: 'createdThisMonth' | 'resolvedThisMonth' | 'averageResolutionDays' | 'pastDeadline';
  suffix?: string;
}

export const INSIGHTS: InsightDef[] = [
  {
    id: 'work-items-resolved-this-month',
    name: 'Work items resolved this month',
    description: 'Number of work items resolved in the current month.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
    metric: 'resolvedThisMonth',
  },
  {
    id: 'work-items-created-this-month',
    name: 'Work items created this month',
    description: 'Number of work items created in the current month.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
    metric: 'createdThisMonth',
  },
  {
    id: 'average-resolution-duration',
    name: 'Average resolution duration (days)',
    description: 'Average number of days taken to resolve a work item.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
    metric: 'averageResolutionDays',
    suffix: ' days',
  },
  {
    id: 'tasks-past-deadline',
    name: 'Tasks past deadline',
    description: 'Open assignments whose deadline has already passed.',
    visibility: 'PUBLIC',
    updated: '2 months ago',
    operator: 'System Administrator',
    metric: 'pastDeadline',
  },
];
