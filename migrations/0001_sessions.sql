PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL,
  overlay_token_hash TEXT NOT NULL,
  creator_session_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 50),
  prompt TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 160),
  accent TEXT NOT NULL CHECK (accent IN ('coral', 'sky', 'lime', 'violet')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'hidden')),
  selected_letter_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expires_at ON sessions (expires_at);
CREATE INDEX sessions_creator ON sessions (creator_session_id);

CREATE TABLE letters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_session_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) <= 24),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 400),
  state TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'used', 'hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX letters_session ON letters (session_id, created_at DESC);

CREATE TABLE reports (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reporter_session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, reporter_session_id)
);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (
    name IN (
      'visited',
      'session_created',
      'submit_link_copied',
      'overlay_link_copied',
      'letter_sent',
      'letter_selected',
      'overlay_opened',
      'session_closed',
      'returned'
    )
  ),
  context TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, name, context, occurred_on)
);

CREATE INDEX product_events_created_at ON product_events (created_at);
