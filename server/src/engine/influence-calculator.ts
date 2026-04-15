/**
 * 社会主体案件影响力加权算法
 *
 * 最终影响力 = 角色权重 × 50% + 受众规模 × 25% + LLM案件相关性 × 25%
 *
 * 角色权重层级（结构性权力）：
 *   政府单位 (0.90) > 立法议员 (0.78) > 媒体机构 (0.65)
 *   > 行业协会/NGO (0.52) = 专家学者 (0.52) = 利益公众 (0.52)
 *   KOL/博主 基础较低 (0.35)，但受 followerScale 放大明显
 */

import type { LegalEntity, EntityRole } from '@shared/types.js'

// ─── Role base authority (structural power, 0-1) ────────────────────────────

const ROLE_AUTHORITY: Partial<Record<EntityRole, number>> = {
  GOVERNMENT_AGENCY:  0.90,
  LEGISLATOR:         0.78,
  MEDIA_OUTLET:       0.65,
  ADVOCACY_GROUP:     0.52,
  EXPERT_COMMENTATOR: 0.52,
  PUBLIC_STAKEHOLDER: 0.52,
  ONLINE_INFLUENCER:  0.35,
}

// ─── Follower scale → reach score (0-1) ─────────────────────────────────────

type FollowerScale = 'INDIVIDUAL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE'

const SCALE_SCORE: Record<FollowerScale, number> = {
  INDIVIDUAL: 0.15,
  SMALL:      0.35,
  MEDIUM:     0.55,
  LARGE:      0.78,
  MASSIVE:    1.00,
}

const DEFAULT_SCALE_SCORE = 0.45

// ─── Weights ────────────────────────────────────────────────────────────────

const W_ROLE      = 0.50   // 50% — 角色结构性权力
const W_SCALE     = 0.25   // 25% — 受众规模/传播力
const W_RELEVANCE = 0.25   // 25% — LLM 判断的案件相关度

// ─── Core function ──────────────────────────────────────────────────────────

/**
 * 计算单个社会主体的案件影响力
 *
 * @param role         实体角色
 * @param followerScale 受众规模
 * @param llmRawInfluence LLM 原始输出的 caseInfluence (0-100)，作为案件相关性因子
 * @returns 最终 caseInfluence (5-100)
 */
export function computeCaseInfluence(
  role: EntityRole,
  followerScale?: FollowerScale,
  llmRawInfluence?: number,
): number {
  const roleScore      = ROLE_AUTHORITY[role] ?? 0.45
  const scaleScore     = followerScale ? (SCALE_SCORE[followerScale] ?? DEFAULT_SCALE_SCORE) : DEFAULT_SCALE_SCORE
  const relevanceScore = Math.max(0, Math.min(1, (llmRawInfluence ?? 50) / 100))

  const raw = (roleScore * W_ROLE + scaleScore * W_SCALE + relevanceScore * W_RELEVANCE) * 100

  return Math.round(Math.max(5, Math.min(100, raw)))
}

/**
 * 批量校准所有 SOCIAL 主体的 caseInfluence
 * COURT 主体不受影响
 */
export function calibrateEntityInfluence(entities: LegalEntity[]): LegalEntity[] {
  return entities.map(entity => {
    if (entity.category !== 'SOCIAL') return entity

    const calibrated = computeCaseInfluence(
      entity.role,
      entity.followerScale as FollowerScale | undefined,
      entity.caseInfluence,  // LLM 原始值作为相关性因子
    )

    return { ...entity, caseInfluence: calibrated }
  })
}
