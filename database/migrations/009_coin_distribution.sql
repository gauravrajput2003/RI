CREATE TABLE coin_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    counterparty_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount numeric(14,2) NOT NULL CHECK (amount > 0),
    transaction_type text NOT NULL CHECK (transaction_type IN ('DISTRIBUTED','RECLAIMED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (distributor_id <> counterparty_id)
);

CREATE INDEX coin_transactions_distributor_time_idx ON coin_transactions (distributor_id, created_at DESC);
CREATE INDEX coin_transactions_counterparty_time_idx ON coin_transactions (counterparty_id, created_at DESC);
