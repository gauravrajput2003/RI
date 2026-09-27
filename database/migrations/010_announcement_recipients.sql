ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_target_type_check;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_check1;
ALTER TABLE announcements ADD CONSTRAINT announcements_target_type_check
  CHECK (target_type IN ('ALL_CLIENTS','CLIENT','ADMIN'));

CREATE TABLE announcement_recipients (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id,user_id)
);

CREATE INDEX announcement_recipients_user_idx ON announcement_recipients(user_id,announcement_id);

INSERT INTO announcement_recipients(announcement_id,user_id)
SELECT id,target_id FROM announcements
WHERE target_type='CLIENT' AND target_id IS NOT NULL
ON CONFLICT DO NOTHING;
