import test from 'node:test'
import assert from 'node:assert/strict'
import type { AgentAction, LegalEntity, RelationshipGraph } from '@shared/types'
import { ROLE_ALLOWED_ACTIONS } from '@shared/constants'
import { Agent } from './Agent.js'
import { GameMaster } from './GameMaster.js'
import type { WorldState } from './WorldState.js'
import { persistence } from '../services/persistence.service.js'

const entities: LegalEntity[] = [
  {
    id: 'plaintiff',
    name: '原告',
    role: 'PLAINTIFF',
    category: 'COURT',
    supportsPlaintiff: true,
    position: '支持原告诉求',
    interests: ['胜诉'],
    strategy: '提交证据',
    agentPersona: '坚定',
  },
  {
    id: 'defendant',
    name: '被告',
    role: 'DEFENDANT',
    category: 'COURT',
    supportsPlaintiff: false,
    position: '反对原告诉求',
    interests: ['免赔'],
    strategy: '辩驳',
    agentPersona: '强硬',
  },
  {
    id: 'judge',
    name: '法官',
    role: 'JUDGE',
    category: 'COURT',
    position: '居中裁判',
    interests: ['查明事实'],
    strategy: '审慎裁量',
    agentPersona: '中立',
  },
  {
    id: 'influencer',
    name: '博主',
    role: 'ONLINE_INFLUENCER',
    category: 'SOCIAL',
    supportsPlaintiff: true,
    position: '同情受害者',
    interests: ['公众关注'],
    strategy: '发声',
    agentPersona: '敏锐',
    caseInfluence: 75,
  },
]

const graph: RelationshipGraph = {
  nodes: entities,
  edges: [],
}

test('GameMaster honors dynamic total round count and final-round judge participation', async () => {
  const originalDecide = Agent.prototype.decide
  const originalSaveEvent = persistence.saveEvent
  const roundStarts: Array<{ round: number; activeAgents: string[] }> = []

  Agent.prototype.decide = async function decide(worldState: WorldState): Promise<AgentAction> {
    return {
      agentId: this.entityId,
      round: worldState.round,
      actionType: ROLE_ALLOWED_ACTIONS[this.entity.role][0],
      reasoning: 'test',
      description: `${this.entity.name} 在第 ${worldState.round} 轮行动`,
      intensity: 0.6,
    }
  }

  const emitter = {
    emit(event: string, data: unknown) {
      if (event === 'round:start') {
        roundStarts.push(data as { round: number; activeAgents: string[] })
      }
    },
    close() {},
  }

  try {
    persistence.saveEvent = () => undefined

    const gameMaster = new GameMaster(
      entities,
      graph,
      '测试案件',
      3,
      { apiKey: 'test', apiBase: 'https://example.com', model: 'mock-model' },
      emitter,
      'sim-test',
    )

    const timeline = await gameMaster.run()
    assert.equal(roundStarts.length, 3)
    assert.deepEqual(roundStarts.map(item => item.round), [1, 2, 3])
    assert.ok(roundStarts[2].activeAgents.includes('judge'))
    assert.equal(Math.max(...timeline.events.map(event => event.round)), 3)
  } finally {
    Agent.prototype.decide = originalDecide
    persistence.saveEvent = originalSaveEvent
  }
})
