CREATE TABLE IF NOT EXISTS simulations (
  id             TEXT PRIMARY KEY,
  project_name   TEXT,
  case_input     TEXT NOT NULL,
  case_summary   TEXT,
  file_content   TEXT,
  file_name      TEXT,
  round_count    INTEGER NOT NULL DEFAULT 40,
  status         TEXT NOT NULL DEFAULT 'created',
  stage          INTEGER NOT NULL DEFAULT 0,
  stage_statuses TEXT NOT NULL DEFAULT '{"0":"idle","1":"idle","2":"idle","3":"idle","4":"idle"}',
  error          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entities (
  id             TEXT NOT NULL,
  simulation_id  TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  data           TEXT NOT NULL,
  PRIMARY KEY (simulation_id, id)
);

CREATE TABLE IF NOT EXISTS relationships (
  id             TEXT NOT NULL,
  simulation_id  TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  source_id      TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  data           TEXT NOT NULL,
  PRIMARY KEY (simulation_id, id)
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT NOT NULL,
  simulation_id  TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  round          INTEGER NOT NULL,
  sequence       INTEGER NOT NULL,
  data           TEXT NOT NULL,
  PRIMARY KEY (simulation_id, id)
);
CREATE INDEX IF NOT EXISTS idx_events_round ON events(simulation_id, round);

DROP TABLE IF EXISTS snapshots;

CREATE TABLE IF NOT EXISTS reports (
  id             TEXT PRIMARY KEY,
  simulation_id  TEXT NOT NULL UNIQUE REFERENCES simulations(id) ON DELETE CASCADE,
  data           TEXT NOT NULL
);
