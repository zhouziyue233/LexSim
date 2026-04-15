import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { v4 as uuidv4 } from 'uuid'
import type {
  Simulation,
  LegalEntity,
  RelationshipGraph,
  RelationEdge,
  GameplayEvent,
  GameplayTimeline,
  PredictionReport,
  SimulationStage,
  StageStatus,
} from '@shared/types'
import { config } from '../config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let db: DatabaseSync

function withTransaction(fn: () => void) {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

function safeParseJson<T>(raw: string, label: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[DB] Skipping malformed ${label} JSON row:`, String(error))
    return null
  }
}

export function initDatabase() {
  db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  const schema = readFileSync(resolve(__dirname, '..', 'db', 'schema.sql'), 'utf-8')
  db.exec(schema)
  ensureSchemaCompatibility()
}

function ensureSchemaCompatibility() {
  const simulationColumns = db.prepare('PRAGMA table_info(simulations)').all() as Array<{ name: string }>
  const columnNames = new Set(simulationColumns.map(column => column.name))

  if (!columnNames.has('round_count')) {
    db.exec('ALTER TABLE simulations ADD COLUMN round_count INTEGER NOT NULL DEFAULT 40')
  }
  if (!columnNames.has('file_content')) {
    db.exec('ALTER TABLE simulations ADD COLUMN file_content TEXT')
  }
  if (!columnNames.has('file_name')) {
    db.exec('ALTER TABLE simulations ADD COLUMN file_name TEXT')
  }
  if (!columnNames.has('case_summary')) {
    db.exec('ALTER TABLE simulations ADD COLUMN case_summary TEXT')
  }
  if (!columnNames.has('project_name')) {
    db.exec('ALTER TABLE simulations ADD COLUMN project_name TEXT')
  }
}

function parseStageStatuses(raw: string): Record<number, StageStatus> {
  try {
    return JSON.parse(raw)
  } catch {
    return { 0: 'idle', 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle' }
  }
}

export const persistence = {
  createSimulation(id: string, caseInput: string, roundCount: number, fileContent?: string, fileName?: string, projectName?: string) {
    db.prepare(
      'INSERT INTO simulations (id, project_name, case_input, round_count, file_content, file_name) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, projectName ?? null, caseInput, roundCount, fileContent ?? null, fileName ?? null)
  },

  saveCaseSummary(id: string, summary: string) {
    db.prepare('UPDATE simulations SET case_summary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(summary, id)
  },

  updateSimulation(
    id: string,
    updates: { status?: string; stage?: number; stageStatuses?: Record<number, StageStatus>; error?: string | null },
  ) {
    const parts: string[] = ['updated_at = datetime(\'now\')']
    const values: unknown[] = []

    if (updates.status !== undefined) { parts.push('status = ?'); values.push(updates.status) }
    if (updates.stage !== undefined) { parts.push('stage = ?'); values.push(updates.stage) }
    if (updates.stageStatuses !== undefined) { parts.push('stage_statuses = ?'); values.push(JSON.stringify(updates.stageStatuses)) }
    if (updates.error !== undefined) { parts.push('error = ?'); values.push(updates.error) }

    values.push(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE simulations SET ${parts.join(', ')} WHERE id = ?`).run(...(values as any[]))
  },

  saveEntities(simId: string, entities: LegalEntity[]) {
    const stmt = db.prepare('INSERT OR REPLACE INTO entities (id, simulation_id, data) VALUES (?, ?, ?)')
    withTransaction(() => {
      for (const e of entities) {
        stmt.run(e.id, simId, JSON.stringify(e))
      }
    })
  },

  saveRelationships(simId: string, edges: RelationEdge[]) {
    const stmt = db.prepare('INSERT OR REPLACE INTO relationships (id, simulation_id, source_id, target_id, data) VALUES (?, ?, ?, ?, ?)')
    withTransaction(() => {
      for (const e of edges) {
        stmt.run(e.id, simId, e.source, e.target, JSON.stringify(e))
      }
    })
  },

  saveEvent(simId: string, event: GameplayEvent, sequence: number) {
    db.prepare('INSERT OR REPLACE INTO events (id, simulation_id, round, sequence, data) VALUES (?, ?, ?, ?, ?)').run(
      event.id, simId, event.round, sequence, JSON.stringify(event),
    )
  },

  saveReport(simId: string, report: PredictionReport) {
    db.prepare('INSERT OR REPLACE INTO reports (id, simulation_id, data) VALUES (?, ?, ?)').run(
      uuidv4(), simId, JSON.stringify(report),
    )
  },

  getSimulation(id: string): Simulation | null {
    const row = db.prepare('SELECT * FROM simulations WHERE id = ?').get(id) as {
      id: string; project_name: string | null; case_input: string; case_summary: string | null;
      file_content: string | null; file_name: string | null;
      round_count: number; status: string; stage: number;
      stage_statuses: string; error: string | null; created_at: string; updated_at: string
    } | undefined
    if (!row) return null

    const entities = (db.prepare('SELECT data FROM entities WHERE simulation_id = ?').all(id) as { data: string }[])
      .map(r => safeParseJson<LegalEntity>(r.data, 'entity'))
      .filter((entity): entity is LegalEntity => entity !== null)

    const edges = (db.prepare('SELECT data FROM relationships WHERE simulation_id = ?').all(id) as { data: string }[])
      .map(r => safeParseJson<RelationEdge>(r.data, 'relationship'))
      .filter((edge): edge is RelationEdge => edge !== null)

    const events = (db.prepare('SELECT data FROM events WHERE simulation_id = ? ORDER BY round, sequence').all(id) as { data: string }[])
      .map(r => safeParseJson<GameplayEvent>(r.data, 'event'))
      .filter((event): event is GameplayEvent => event !== null)

    const reportRow = db.prepare('SELECT data FROM reports WHERE simulation_id = ?').get(id) as { data: string } | undefined

    const graph: RelationshipGraph | null = entities.length > 0 && edges.length > 0
      ? { nodes: entities, edges }
      : null

    let timeline: GameplayTimeline | null = null
    if (events.length > 0) {
      timeline = {
        events,
        currentPlaintiffWinProb: 50,
        socialInfluenceScore: 0,
      }
    }

    return {
      id: row.id,
      projectName: row.project_name ?? undefined,
      caseInput: row.case_input,
      caseSummary: row.case_summary ?? undefined,
      fileContent: row.file_content ?? undefined,
      fileName: row.file_name ?? undefined,
      roundCount: row.round_count,
      status: row.status as Simulation['status'],
      stage: row.stage as SimulationStage,
      stageStatuses: parseStageStatuses(row.stage_statuses),
      entities,
      graph,
      timeline,
      report: reportRow ? safeParseJson<PredictionReport>(reportRow.data, 'report') : null,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  },

  listSimulations(): Pick<Simulation, 'id' | 'projectName' | 'caseInput' | 'caseSummary' | 'roundCount' | 'status' | 'stage' | 'createdAt'>[] {
    return (db.prepare('SELECT id, project_name, case_input, case_summary, round_count, status, stage, created_at FROM simulations ORDER BY created_at DESC').all() as {
      id: string; project_name: string | null; case_input: string; case_summary: string | null; round_count: number; status: string; stage: number; created_at: string
    }[]).map(r => ({
      id: r.id,
      projectName: r.project_name ?? undefined,
      caseInput: r.case_input,
      caseSummary: r.case_summary ?? undefined,
      roundCount: r.round_count,
      status: r.status as Simulation['status'],
      stage: r.stage as SimulationStage,
      createdAt: r.created_at,
    })) as Pick<Simulation, 'id' | 'projectName' | 'caseInput' | 'caseSummary' | 'roundCount' | 'status' | 'stage' | 'createdAt'>[]
  },

  deleteSimulation(id: string) {
    db.prepare('DELETE FROM simulations WHERE id = ?').run(id)
  },

}
