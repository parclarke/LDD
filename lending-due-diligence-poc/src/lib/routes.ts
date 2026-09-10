/** Route model for the PoC shell, mirroring the prototype's hash routes. */
export type PocRoute =
  | { name: 'home' }
  | { name: 'mywork' }
  | { name: 'explore' }
  | { name: 'records' }
  | { name: 'type'; code: string };

export function routeKey(route: PocRoute): string {
  return route.name === 'type' ? `type:${route.code}` : route.name;
}
