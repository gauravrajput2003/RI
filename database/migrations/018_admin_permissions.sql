-- Per-admin permissions extend role and ownership authorization. Existing packet-health denials survive.
CREATE TABLE permissions (
 key text PRIMARY KEY, name text NOT NULL, category text NOT NULL, resource text NOT NULL,
 action text NOT NULL CHECK (action IN ('view','add','edit','delete')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(resource,action)
);
INSERT INTO permissions(key,name,category,resource,action) VALUES
('dashboard.view','Dashboard','Dashboard','dashboard','view'),
('playback.view','Playback','Dashboard','playback','view'),
('vehicle.view','Vehicle','Vehicle','vehicle','view'),
('vehicle.add','Vehicle','Vehicle','vehicle','add'),
('vehicle.edit','Vehicle','Vehicle','vehicle','edit'),
('vehicle.delete','Vehicle','Vehicle','vehicle','delete'),
('admin.view','Admin','Admin','admin','view'),
('admin.add','Admin','Admin','admin','add'),
('admin.edit','Admin','Admin','admin','edit'),
('admin.delete','Admin','Admin','admin','delete'),
('client.view','Client','Client','client','view'),
('client.add','Client','Client','client','add'),
('client.edit','Client','Client','client','edit'),
('client.delete','Client','Client','client','delete'),
('geofence.view','Geofence','Geofence','geofence','view'),
('geofence.add','Geofence','Geofence','geofence','add'),
('geofence.edit','Geofence','Geofence','geofence','edit'),
('geofence.delete','Geofence','Geofence','geofence','delete'),
('alert.view','Configure Alert','Alerts','alert','view'),
('alert.add','Configure Alert','Alerts','alert','add'),
('alert.edit','Configure Alert','Alerts','alert','edit'),
('alert.delete','Configure Alert','Alerts','alert','delete'),
('announcement.view','Announcement','Alerts','announcement','view'),
('announcement.add','Announcement','Alerts','announcement','add'),
('announcement.edit','Announcement','Alerts','announcement','edit'),
('announcement.delete','Announcement','Alerts','announcement','delete'),
('notifications.view','Notifications History','Alerts','notifications','view'),
('reports.distance.view','Distance Report','Reports','reports.distance','view'),
('reports.ac.view','AC Report','Reports','reports.ac','view'),
('reports.packet.view','Packet Report','Reports','reports.packet','view'),
('reports.travel-summary.view','Travel Summary','Reports','reports.travel-summary','view'),
('reports.daily-trip-summary.view','Daily Trip Summary','Reports','reports.daily-trip-summary','view'),
('reports.status.view','Status Report','Reports','reports.status','view'),
('reports.idle.view','Idle Report','Reports','reports.idle','view'),
('reports.running.view','Running Report','Reports','reports.running','view'),
('reports.stoppage.view','Stoppage Report','Reports','reports.stoppage','view'),
('reports.overspeed.view','Overspeed Report','Reports','reports.overspeed','view'),
('reports.unreachable.view','Unreachable Report','Reports','reports.unreachable','view'),
('coin_distribution.view','Coin Distribution','Coin Distribution','coin_distribution','view'),
('coin_distribution.add','Coin Distribution','Coin Distribution','coin_distribution','add'),
('packet_health.view','Packet Health','Diagnostics','packet_health','view'),
('device.view','Device','API resources','device','view'),
('event.view','Event','API resources','event','view'),
('group.view','Group','API resources','group','view'),
('subscription.view','Subscription','API resources','subscription','view'),
('profile.view','Account profile','Account','profile','view'),
('profile.edit','Account profile','Account','profile','edit');
ALTER TABLE users ADD COLUMN permissions_version integer NOT NULL DEFAULT 0;
CREATE TABLE admin_permissions (
 admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 permission_key text NOT NULL REFERENCES permissions(key) ON DELETE RESTRICT,
 allowed boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(admin_id,permission_key)
);
CREATE INDEX admin_permissions_permission_idx ON admin_permissions(permission_key);
CREATE TABLE permission_change_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 admin_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 old_permissions jsonb NOT NULL, new_permissions jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permission_change_audit_admin_idx ON permission_change_audit(admin_id,created_at DESC);
INSERT INTO admin_permissions(admin_id,permission_key,allowed)
 SELECT u.id,p.key,CASE WHEN p.key='packet_health.view' THEN u.can_view_packet_health ELSE true END
 FROM users u CROSS JOIN permissions p WHERE u.role='ADMIN';
CREATE FUNCTION initialize_admin_permissions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='ADMIN' AND (TG_OP='INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
  INSERT INTO admin_permissions(admin_id,permission_key,allowed) SELECT NEW.id,key,true FROM permissions ON CONFLICT DO NOTHING;
  UPDATE users SET can_view_packet_health=(SELECT allowed FROM admin_permissions WHERE admin_id=NEW.id AND permission_key='packet_health.view') WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_initialize_permissions AFTER INSERT OR UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION initialize_admin_permissions();
CREATE FUNCTION validate_admin_permission_target() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.admin_id AND role='ADMIN') THEN
  RAISE EXCEPTION 'Permissions may only target Admin accounts' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER admin_permissions_validate_target BEFORE INSERT OR UPDATE ON admin_permissions
 FOR EACH ROW EXECUTE FUNCTION validate_admin_permission_target();
