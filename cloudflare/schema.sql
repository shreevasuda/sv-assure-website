-- SV Assure Report Portal D1 schema
-- Apply only to a new/empty portal database. Do not run DROP statements on production data.

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    report_type TEXT NOT NULL,
    borrower_name TEXT NOT NULL,
    borrower_mobile TEXT NOT NULL,
    gstin TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    banker_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT '',
    banker_mobile TEXT NOT NULL,
    banker_email TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New'
        CHECK (status IN ('New','Accepted','In Progress','Query Raised','Completed','Cancelled')),
    consent_confirmed INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'website',
    report_object_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(banker_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
