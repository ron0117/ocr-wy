export type CodesListQuery = {
  page?: number;
  pathway?: string;
  scenario?: string;
};

export function codesListHref(query: CodesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.pathway?.trim()) params.set('pathway', query.pathway.trim());
  if (query.scenario?.trim()) params.set('scenario', query.scenario.trim());
  if (query.page != null && query.page > 1) params.set('page', String(query.page));
  const qs = params.toString();
  return qs ? `/codes?${qs}` : '/codes';
}

export function sharesListApiQuery(
  query: CodesListQuery & { pageSize: number },
): string {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, query.page ?? 1)));
  params.set('pageSize', String(query.pageSize));
  if (query.pathway?.trim()) params.set('pathway', query.pathway.trim());
  if (query.scenario?.trim()) params.set('scenario', query.scenario.trim());
  return `/shares?${params.toString()}`;
}
