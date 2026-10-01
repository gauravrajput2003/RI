ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_message_type_check;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_body_html_check;
ALTER TABLE announcements ALTER COLUMN body_html DROP NOT NULL;
ALTER TABLE announcements ADD COLUMN image_url text;
ALTER TABLE announcements ADD COLUMN image_public_id text;
ALTER TABLE announcements ADD CONSTRAINT announcements_message_type_check CHECK (message_type IN ('TEXT','IMAGE'));
ALTER TABLE announcements ADD CONSTRAINT announcements_content_check CHECK (
 (message_type='TEXT' AND body_html IS NOT NULL AND length(trim(body_html)) BETWEEN 1 AND 20000 AND image_url IS NULL AND image_public_id IS NULL)
 OR (message_type='IMAGE' AND image_url IS NOT NULL AND image_public_id IS NOT NULL AND body_html IS NULL)
);
