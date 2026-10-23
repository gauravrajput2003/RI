-- Preserve available uncertainty of the fixed reference as well as each new fix.
-- NULL means that the tracker did not report reference accuracy.
ALTER TABLE parking_modes ADD COLUMN reference_accuracy_m double precision CHECK(reference_accuracy_m>=0);
