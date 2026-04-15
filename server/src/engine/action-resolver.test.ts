import test from 'node:test'
import assert from 'node:assert/strict'
import type { AgentAction, LegalEntity } from '@shared/types'
import { resolveActions } from './action-resolver.js'

const entities: LegalEntity[] = [
  {
    id: 'plaintiff',
    name: '原告',
    role: 'PLAINTIFF',
    category: 'COURT',
    supportsPlaintiff: true,
    position: '主张侵权成立',
    interests: ['胜诉'],
    strategy: '提交证据',
    agentPersona: '冷静',
  },
  {
    id: 'media',
    name: '媒体',
    role: 'MEDIA_OUTLET',
    category: 'SOCIAL',
    supportsPlaintiff: false,
    position: '质疑原告诉求',
    interests: ['流量'],
    strategy: '报道争议',
    agentPersona: '激进',
    caseInfluence: 90,
  },
]

test('resolveActions uses explicit supportsPlaintiff for social actors', () => {
  const actions: AgentAction[] = [
    {
      agentId: 'plaintiff',
      round: 1,
      actionType: 'EVIDENCE_SUBMISSION',
      reasoning: '证据充分',
      description: '原告提交关键证据',
      intensity: 0.8,
    },
    {
      agentId: 'media',
      round: 1,
      actionType: 'MEDIA_REPORT',
      reasoning: '媒体持续施压',
      description: '媒体发布不利报道',
      intensity: 0.9,
    },
  ]

  const events = resolveActions(actions, entities, [], 1)
  assert.equal(events.length, 2)
  assert.equal(events[0].impact, 'POSITIVE')
  assert.ok(events[0].probabilityShift > 0)
  assert.equal(events[1].impact, 'NEGATIVE')
  assert.ok((events[1].publicSentimentDelta ?? 0) < 0)
})
