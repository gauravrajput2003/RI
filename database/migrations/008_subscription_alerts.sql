ALTER TABLE notification_history ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE notification_history ADD COLUMN recipient_user_id uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE notification_history ADD COLUMN subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE notification_history ADD CONSTRAINT notification_history_subject_check
  CHECK (vehicle_id IS NOT NULL OR recipient_user_id IS NOT NULL);
CREATE INDEX notification_history_recipient_time_idx ON notification_history(recipient_user_id,occurred_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE TABLE alert_subscription_event_state (
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  active boolean NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  transition_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subscription_id,event_type)
);
