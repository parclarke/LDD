/** Route model for the PoC shell, mirroring the prototype's hash routes. */
export type PocRoute =
  | { name: 'home' }
  | { name: 'mywork' }
  | { name: 'explore' }
  | { name: 'dashboards' }
  | { name: 'dashboard'; id: string }
  | { name: 'insight'; id: string }
  | { name: 'records' }
  | { name: 'agent' }
  | { name: 'case'; caseId: string }
  | { name: 'type'; code: string };

export function routeKey(route: PocRoute): string {
  if (route.name === 'type') return `type:${route.code}`;
  if (route.name === 'dashboard') return 'dashboards';
  if (route.name === 'insight') return 'explore';
  return route.name;
}
