const GPS_ROLLOVER_MS = 1024 * 7 * 24 * 60 * 60 * 1000;
const MAX_UPLOAD_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Resolve one GPS week-number epoch only when receipt corroborates it.
 * Keep time-of-day and upload delay intact; never substitute receipt time. */
export function resolveGpsTimestamp(raw:Date|null,receivedAt:Date) {
  if(!raw)return {timestamp:null,metadata:{}};
  const candidate=new Date(+raw+GPS_ROLLOVER_MS);
  const age=+receivedAt-+candidate;
  if(!Number.isFinite(age)||age < -60000||age > MAX_UPLOAD_AGE_MS) {
    return {timestamp:raw,metadata:{}};
  }
  return {timestamp:candidate,metadata:{gpsTimestampCorrection:{
    reason:'GPS_WEEK_ROLLOVER',originalTimestamp:raw.toISOString(),
    correctedTimestamp:candidate.toISOString(),offsetWeeks:1024,
  }}};
}
