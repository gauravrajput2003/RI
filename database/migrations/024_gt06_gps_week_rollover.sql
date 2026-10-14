-- Repair the same bounded rollover as ingestion, retaining the original
-- timestamp for audit. No IMEI, vehicle, calendar year or receipt-time override.
UPDATE locations
SET metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
      'gpsTimestampCorrection',jsonb_build_object(
        'reason','GPS_WEEK_ROLLOVER','originalTimestamp',tracker_timestamp,
        'correctedTimestamp',tracker_timestamp + interval '7168 days',
        'offsetWeeks',1024)),
    tracker_timestamp=tracker_timestamp + interval '7168 days'
WHERE protocol='GT06' AND tracker_timestamp IS NOT NULL
  AND server_received_at-(tracker_timestamp + interval '7168 days')
      BETWEEN interval '-1 minute' AND interval '7 days'
  AND NOT COALESCE(metadata,'{}'::jsonb) ? 'gpsTimestampCorrection';
