// Parse an ISO 8601 duration like "PT1H30M" into minutes.
// Returns the fallback when input is missing or unparseable.
export function isoDurationToMinutes(iso, fallback = 90) {
  if (!iso || typeof iso !== "string") return fallback;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return fallback;
  const [, d, h, mm] = m;
  const mins = (Number(d || 0) * 24 * 60) + (Number(h || 0) * 60) + Number(mm || 0);
  return mins || fallback;
}
