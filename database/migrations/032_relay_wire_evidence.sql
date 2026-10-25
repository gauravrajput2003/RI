-- Configured model command content is masked before storage; never persist passwords.
ALTER TABLE vehicle_relay_commands ADD COLUMN command_hex_redacted text, ADD COLUMN expected_response text;
