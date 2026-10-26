export function webOriginFromEnv(raw: string | undefined): string {
  const value = raw?.split(',')[0]?.trim() ?? 'http://localhost:5777';
  return value.replace(/\/+$/, '');
}

export function activityPublicUrl(origin: string | undefined, activityId: string): string {
  return `${webOriginFromEnv(origin)}/a/${activityId}`;
}
