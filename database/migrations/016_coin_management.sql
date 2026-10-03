CREATE TABLE coin_sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 distributor_id uuid NOT NULL REFERENCES users(id), counterparty_id uuid NOT NULL REFERENCES users(id),
 coins_granted numeric(14,2) NOT NULL CHECK(coins_granted>0), amount_inr numeric(14,2) NOT NULL CHECK(amount_inr>0),
 recorded_by uuid NOT NULL REFERENCES users(id), payment_reference text, created_at timestamptz NOT NULL DEFAULT now(), note text,
 CHECK(distributor_id<>counterparty_id)
);
CREATE INDEX coin_sales_distributor_time_idx ON coin_sales(distributor_id,created_at DESC);
CREATE TABLE coin_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
 amount numeric(14,2) NOT NULL CHECK(amount>0), remaining numeric(14,2) NOT NULL CHECK(remaining>=0 AND remaining<=amount),
 granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 source_transaction_id uuid REFERENCES coin_transactions(id), CHECK(expires_at>granted_at)
);
CREATE INDEX coin_batches_owner_live_idx ON coin_batches(owner_id,expires_at) WHERE remaining>0;
CREATE UNIQUE INDEX coin_batches_source_idx ON coin_batches(source_transaction_id) WHERE source_transaction_id IS NOT NULL;
CREATE TABLE issuance_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), monthly_target numeric(14,2) NOT NULL DEFAULT 0 CHECK(monthly_target>=0),
 enforce_hard_cap boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX issuance_settings_singleton ON issuance_settings((true));
INSERT INTO issuance_settings DEFAULT VALUES;
-- Carry existing balances forward without inventing cash receipts or rewriting audit history.
INSERT INTO coin_batches(owner_id,amount,remaining,expires_at)
 SELECT id,coins,coins,now()+interval '1 year' FROM users WHERE role IN ('ADMIN','CLIENT') AND coins>0;
