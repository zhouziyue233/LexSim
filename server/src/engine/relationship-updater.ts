import type {
  RelationEdge,
  RelationType,
  GameplayEvent,
  JudgeDirective,
  LegalEntity,
} from '@shared/types'

export interface EdgeChange {
  edge: RelationEdge
  action: 'add' | 'update' | 'remove'
}

const DECAY_FACTOR = 0.95
const DECAY_THRESHOLD = 0.05

/** Find an existing edge between two entities (in either direction) */
function findEdge(edges: RelationEdge[], a: string, b: string): RelationEdge | undefined {
  return edges.find(
    e => (e.source === a && e.target === b) || (e.source === b && e.target === a),
  )
}

let edgeCounter = 0

function makeEdge(
  source: string,
  target: string,
  type: RelationType,
  label: string,
  strength: number,
  adversarial: boolean,
): RelationEdge {
  return {
    id: `rel-dyn-${++edgeCounter}`,
    source,
    target,
    type,
    label,
    strength: Math.min(1, Math.max(0, strength)),
    adversarial,
  }
}

/**
 * Compute relationship changes based on round events and directives.
 * Returns a list of edge changes (add/update/remove) to apply.
 */
export function updateRelationships(
  edges: RelationEdge[],
  events: GameplayEvent[],
  directives: JudgeDirective[],
  entities: LegalEntity[],
  round: number,
): EdgeChange[] {
  const changes: EdgeChange[] = []
  const modifiedEdgeIds = new Set<string>()

  for (const ev of events) {
    if (ev.round !== round) continue
    if (!ev.targetId) continue

    const actor = entities.find(e => e.id === ev.actorId)
    const target = entities.find(e => e.id === ev.targetId)
    if (!actor || !target) continue

    const existing = findEdge(edges, ev.actorId, ev.targetId)

    switch (ev.type) {
      case 'CROSS_EXAMINATION': {
        const intensity = Math.abs(ev.probabilityShift) / 20 // normalize to 0-1
        if (existing) {
          existing.adversarial = true
          existing.strength = Math.min(1, existing.strength + 0.1 * intensity)
          modifiedEdgeIds.add(existing.id)
          changes.push({ edge: { ...existing }, action: 'update' })
        } else {
          const edge = makeEdge(
            ev.actorId, ev.targetId, 'EVIDENCE_LINK',
            `${actor.name}质证${target.name}`, 0.3, true,
          )
          edges.push(edge)
          modifiedEdgeIds.add(edge.id)
          changes.push({ edge: { ...edge }, action: 'add' })
        }
        break
      }

      case 'SETTLEMENT_OFFER': {
        if (existing) {
          existing.strength = Math.max(0, existing.strength - 0.15)
          if (existing.strength < 0.2) existing.adversarial = false
          modifiedEdgeIds.add(existing.id)
          changes.push({ edge: { ...existing }, action: 'update' })
        } else {
          const edge = makeEdge(
            ev.actorId, ev.targetId, 'INTEREST_ALIGN',
            `${actor.name}向${target.name}提出和解`, 0.25, false,
          )
          edges.push(edge)
          modifiedEdgeIds.add(edge.id)
          changes.push({ edge: { ...edge }, action: 'add' })
        }
        break
      }

      case 'MEDIA_REPORT':
      case 'SOCIAL_POST':
      case 'PUBLIC_PROTEST':
      case 'EXPERT_OPINION': {
        if (target.category !== 'COURT') break
        const isSupport = ev.impact === 'POSITIVE'
        const type: RelationType = isSupport ? 'PUBLIC_SUPPORT' : 'PUBLIC_OPPOSITION'

        if (existing) {
          existing.type = type
          existing.strength = Math.min(1, existing.strength + 0.08)
          existing.adversarial = !isSupport
          modifiedEdgeIds.add(existing.id)
          changes.push({ edge: { ...existing }, action: 'update' })
        } else {
          const label = isSupport
            ? `${actor.name}声援${target.name}`
            : `${actor.name}施压${target.name}`
          const edge = makeEdge(ev.actorId, ev.targetId, type, label, 0.25, !isSupport)
          edges.push(edge)
          modifiedEdgeIds.add(edge.id)
          changes.push({ edge: { ...edge }, action: 'add' })
        }
        break
      }
    }
  }

  // Judge directives create/strengthen REGULATORY_OVERSIGHT edges
  for (const dir of directives) {
    if (dir.round !== round || !dir.targetAgentId) continue
    const judge = entities.find(e => e.role === 'JUDGE')
    if (!judge) continue

    const existing = findEdge(edges, judge.id, dir.targetAgentId)
    if (existing) {
      existing.type = 'REGULATORY_OVERSIGHT'
      existing.strength = Math.min(1, existing.strength + 0.12)
      modifiedEdgeIds.add(existing.id)
      changes.push({ edge: { ...existing }, action: 'update' })
    } else {
      const targetEntity = entities.find(e => e.id === dir.targetAgentId)
      const edge = makeEdge(
        judge.id, dir.targetAgentId, 'REGULATORY_OVERSIGHT',
        `法官指令: ${dir.description.slice(0, 30)}`,
        0.35, false,
      )
      edges.push(edge)
      modifiedEdgeIds.add(edge.id)
      changes.push({ edge: { ...edge }, action: 'add' })
    }
  }

  // Decay unmodified edges
  for (const edge of edges) {
    if (modifiedEdgeIds.has(edge.id)) continue
    edge.strength *= DECAY_FACTOR
    if (edge.strength < DECAY_THRESHOLD) {
      changes.push({ edge: { ...edge }, action: 'remove' })
    }
  }

  // Remove decayed edges from the array
  const removeIds = new Set(
    changes.filter(c => c.action === 'remove').map(c => c.edge.id),
  )
  if (removeIds.size > 0) {
    for (let i = edges.length - 1; i >= 0; i--) {
      if (removeIds.has(edges[i].id)) edges.splice(i, 1)
    }
  }

  return changes
}
