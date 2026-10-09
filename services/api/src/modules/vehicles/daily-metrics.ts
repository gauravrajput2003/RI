/** Shared dashboard/vehicle-list metrics. Keep raw history intact, but never
 * measure a trip from an invalid/no-fix coordinate or between different devices.
 * India local midnight defines this fleet's day, independently of DB timezone. */
export const dailyMetricsSql=`
  SELECT
    COALESCE(SUM(CASE WHEN elapsed_seconds>0
      AND segment_metres<=elapsed_seconds*(200.0/3.6)
      AND (segment_metres>=10 OR speed>$3 OR previous_speed>$3)
      THEN segment_metres ELSE 0 END)/1000.0,0) AS today_distance_km,
    SUM(CASE WHEN next_at IS NOT NULL AND COALESCE(speed,0)>$3 THEN EXTRACT(EPOCH FROM (next_at-observed_at)) END) AS today_running_seconds,
    SUM(CASE WHEN next_at IS NOT NULL AND ignition=false AND COALESCE(speed,0)<=$3 THEN EXTRACT(EPOCH FROM (next_at-observed_at)) END) AS today_stopped_seconds,
    AVG(speed) FILTER(WHERE speed>=0) AS today_avg_speed,
    MAX(speed) FILTER(WHERE speed>=0) AS today_max_speed
  FROM (
    SELECT ordered.*,ST_Distance(previous_position,position) AS segment_metres,
      EXTRACT(EPOCH FROM (observed_at-previous_at)) AS elapsed_seconds
    FROM (
      SELECT valid.*,
        lag(position) OVER route AS previous_position,
        lag(observed_at) OVER route AS previous_at,
        lag(speed) OVER route AS previous_speed,
        lead(observed_at) OVER route AS next_at
      FROM (
        SELECT l.id,l.device_id,l.position,l.speed,l.ignition,l.server_received_at,
          COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at
        FROM locations l WHERE l.vehicle_id=v.id AND l.gps_valid=true AND l.position IS NOT NULL
          AND l.latitude BETWEEN -90 AND 90 AND l.longitude BETWEEN -180 AND 180
          AND NOT (l.latitude=0 AND l.longitude=0)
          AND COALESCE(l.tracker_timestamp,l.server_received_at)>=(date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
          AND COALESCE(l.tracker_timestamp,l.server_received_at)<((date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata')+interval '1 day') AT TIME ZONE 'Asia/Kolkata')
      ) valid WINDOW route AS (PARTITION BY device_id ORDER BY observed_at,server_received_at,id)
    ) ordered
  ) measured
`;
