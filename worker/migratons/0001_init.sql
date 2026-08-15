CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  role TEXT NOT NULL,          -- "facilitator" | "player"
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_session_created_at
  ON messages (session_id, created_at);

CREATE TABLE facilitators (
  discord_user_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions_auth (
  session_token TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
