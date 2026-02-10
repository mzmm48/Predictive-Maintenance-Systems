CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE ai4i2020v2 (
    "TS" TIMESTAMPTZ NOT NULL,
    "UDI" text NOT NULL,
    "Product ID" text NOT NULL,
    "Type" text NOT NULL,
    "Air temperature [K]" DOUBLE PRECISION NOT NULL,
    "Process temperature [K]" DOUBLE PRECISION NOT NULL,
    "Rotational speed [rpm]" bigint NOT NULL,
    "Torque [Nm]" DOUBLE PRECISION NOT NULL,
    "Tool wear [min]" bigint NOT NULL,
    "Machine failure" bigint NOT NULL,
    "TWF" bigint NOT NULL,
    "HDF" bigint NOT NULL,
    "PWF" bigint NOT NULL,
    "OSF" bigint NOT NULL,
    "RNF" bigint NOT NULL
);

SELECT create_hypertable ('ai4i2020v2', 'TS');

CREATE TABLE anmeldung (
    "Username" text NOT NULL,
    "Vorname" text NOT NULL,
    "Nachname" text NOT NULL,
    "Passwort" text NOT NULL,
    "E-Mail" text NOT NULL,
    "Rolle" text NOT NULL
);

INSERT INTO
    anmeldung
VALUES (
        'jbsd04',
        'Justus',
        'Schmidt',
        'PredictiveMaintenanceSystem2025!',
        'Nope@Nope',
        'DB_Admin'
    ),
    (
        'Make1207',
        'Marcel',
        'Kempel',
        'Make1207',
        'NopeNo@Nope',
        'Teamleiter'
    );

CREATE TABLE pipeline_state (
    last_pred_ts TIMESTAMPTZ PRIMARY KEY
);

INSERT INTO
    pipeline_state (last_pred_ts)
VALUES ('1970-01-01 00:00:00+00') ON CONFLICT DO NOTHING;