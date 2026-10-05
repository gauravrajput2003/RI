-- SIM metadata belongs to the physical tracker and follows reassignment.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sim_info text;
UPDATE devices d SET sim_info=v.sim_info
FROM vehicle_device_assignments a JOIN vehicles v ON v.id=a.vehicle_id
WHERE a.device_id=d.id AND a.unassigned_at IS NULL AND d.sim_info IS NULL;
