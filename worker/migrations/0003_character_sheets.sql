CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  notable_features TEXT NOT NULL DEFAULT '',
  archetype TEXT NOT NULL DEFAULT '',
  desire TEXT NOT NULL DEFAULT '',
  quest TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT '',
  fate INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_characters_session_slot
  ON characters (session_id, slot);
