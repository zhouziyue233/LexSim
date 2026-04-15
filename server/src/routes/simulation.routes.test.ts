import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationSchema } from './simulation.routes.js'

test('createSimulationSchema rejects out-of-range roundCount', () => {
  const result = createSimulationSchema.safeParse({
    caseInput: '这是一个用于测试非法轮数校验的案件事实，长度已经超过二十个字符。',
    roundCount: 101,
  })

  assert.equal(result.success, false)
})
