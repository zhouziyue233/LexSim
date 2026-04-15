import { useEffect, useRef, useState, useCallback } from 'react'
import { Scale, Shield, Lightbulb, FileSearch, TrendingUp, Gavel, Layers } from 'lucide-react'
import type { PredictionReport, StageStatus } from '@shared/types'
import { useT } from '../../hooks/useT'
import type { TranslationKey } from '../../i18n/translations'

interface Props {
  report: PredictionReport | null
  status: StageStatus
  streamingText: string
}

const WEIGHT_KEYS: Record<string, TranslationKey> = {
  CRITICAL: 'report.weight.CRITICAL',
  STRONG:   'report.weight.STRONG',
  MODERATE: 'report.weight.MODERATE',
  WEAK:     'report.weight.WEAK',
}

const WEIGHT_STYLE: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  STRONG:   { color: '#B45309', bg: 'rgba(180,83,9,0.08)' },
  MODERATE: { color: '#1E4A82', bg: 'rgba(30,74,130,0.08)' },
  WEAK:     { color: '#6B8AAD', bg: 'rgba(107,138,173,0.08)' },
}

// ─── Animated SVG probability ring ─────────────────────────────────────────
function ProbRing({ value, label, color, animate }: {
  value: number; label: string; color: string; animate: boolean
}) {
  const r = 38
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - value / 100)
  const [offset, setOffset] = useState(circumference)
  const [displayValue, setDisplayValue] = useState(0)
  const rafRef = useRef<number>(0)
  const gradId = `ring-grad-${color.replace('#', '')}`

  useEffect(() => {
    if (!animate) return
    const t = setTimeout(() => setOffset(dashoffset), 80)
    return () => clearTimeout(t)
  }, [animate, dashoffset])

  const runCounter = useCallback(() => {
    const duration = 1100
    const startTime = Date.now()
    const target = Math.round(value)
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  useEffect(() => {
    if (!animate) return
    return runCounter()
  }, [animate, runCounter])

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg viewBox="0 0 100 100" style={{ width: 96, height: 96, overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.65" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#EDF2F9" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {animate ? displayValue : Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color: '#374D6B' }}>{label}</span>
    </div>
  )
}

// ─── Markdown generator ─────────────────────────────────────────────────────
export function generateReportMarkdown(report: PredictionReport, projectName?: string): string {
  const lines: string[] = []
  const now = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  lines.push(`# ${projectName ? `${projectName} — ` : ''}LexSim 案件预测报告`)
  lines.push('')
  lines.push(`> 生成时间：${now}`)
  lines.push('')
  lines.push('## 预测概率')
  lines.push('')
  lines.push(`| 原告胜诉 | 被告胜诉 | 和解可能 |`)
  lines.push(`| :---: | :---: | :---: |`)
  lines.push(`| **${Math.round(report.plaintiffWinProbability)}%** | **${Math.round(report.defendantWinProbability)}%** | **${Math.round(report.settlementProbability)}%** |`)
  lines.push('')
  lines.push('## 预测判决')
  lines.push('')
  lines.push(report.predictedOutcome)
  if (report.compensationRange && report.compensationRange.max > 0) {
    lines.push('')
    lines.push(`**赔偿范围预测**：${report.compensationRange.currency} ${report.compensationRange.min.toLocaleString()} — ${report.compensationRange.max.toLocaleString()}`)
  }
  lines.push('')
  if (report.disputePoints.length > 0) {
    lines.push('## 核心争议点')
    lines.push('')
    report.disputePoints.forEach((pt, i) => lines.push(`${i + 1}. ${pt}`))
    lines.push('')
  }
  if (report.courtJudgment) {
    lines.push('## 法院判决分析')
    lines.push('')
    if (report.courtJudgment.evidenceAdoption?.length > 0) {
      lines.push('### 证据采信')
      lines.push('')
      const weightLabels: Record<string, string> = { CRITICAL: '关键', STRONG: '较强', MODERATE: '一般', WEAK: '较弱' }
      report.courtJudgment.evidenceAdoption.forEach(ev => {
        const side = ev.side === 'PLAINTIFF' ? '原告' : '被告'
        const weight = weightLabels[ev.weight] ?? ev.weight
        const roundNote = ev.roundRef != null ? `（第${ev.roundRef}轮）` : ''
        lines.push(`- **${ev.key}**${roundNote} — ${side}证据 · ${weight}`)
        lines.push(`  ${ev.analysis}`)
      })
      lines.push('')
    }
    if (report.courtJudgment.judicialAnalysis) {
      lines.push('### 判决说理（IRAC）')
      lines.push('')
      lines.push(report.courtJudgment.judicialAnalysis)
      lines.push('')
    }
  }
  if (report.litigationStrategy) {
    lines.push('## 诉讼策略建议')
    lines.push('')
    lines.push('### 原告方策略')
    lines.push('')
    lines.push(report.litigationStrategy.plaintiff)
    lines.push('')
    lines.push('### 被告方策略')
    lines.push('')
    lines.push(report.litigationStrategy.defendant)
    lines.push('')
  }
  if (report.phaseAnalysis && report.phaseAnalysis.length > 0) {
    const phaseLabels: Record<string, string> = { OPENING: '开庭陈述', EVIDENCE: '举证质证', DEBATE: '法庭辩论', CLOSING: '宣判' }
    lines.push('## 审判阶段分析')
    lines.push('')
    report.phaseAnalysis.forEach(pa => {
      lines.push(`### ${phaseLabels[pa.phase] ?? pa.phase}`)
      lines.push('')
      lines.push(pa.summary)
      lines.push('')
    })
  }
  if (report.socialImpactAnalysis) {
    lines.push('## 社会影响分析')
    lines.push('')
    lines.push(report.socialImpactAnalysis)
    lines.push('')
  }
  if (report.reasoning) {
    lines.push('## 综合推理')
    lines.push('')
    lines.push(report.reasoning)
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('*本报告由 LexSim 案件预测引擎自动生成，仅供参考。*')
  return lines.join('\n')
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PredictionReportPanel({ report, status, streamingText }: Props) {
  const T = useT()
  const [animateRings, setAnimateRings] = useState(false)
  const didAnimate = useRef(false)

  useEffect(() => {
    if (report && !didAnimate.current) {
      didAnimate.current = true
      setAnimateRings(true)
    }
  }, [report])

  const phaseColors: Record<string, string> = {
    OPENING: '#6366F1', EVIDENCE: '#2563EB', DEBATE: '#D97706', CLOSING: '#DC2626',
  }

  return (
    <div>
      {/* Streaming reasoning */}
      {status === 'loading' && !report && streamingText && (
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #EDF2F9' }}>
          <p className="label-micro mb-3" style={{ color: '#A8BDD8', fontSize: '9px' }}>{T('report.aiReasoning')}</p>
          <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-36 overflow-hidden" style={{ color: '#6B8AAD' }}>
            {streamingText}<span className="streaming-cursor" style={{ background: '#6B8AAD' }} />
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {status === 'loading' && !report && !streamingText && (
        <div className="px-5 py-4 space-y-4">
          {[100, 80, 92, 70].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />
          ))}
        </div>
      )}

      {report && (
        <div className="px-5 py-5 space-y-8">

          {/* ── Probability rings ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={14} style={{ color: '#1E4A82' }} />
              <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.winProb')}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <ProbRing value={report.plaintiffWinProbability} label={T('report.plaintiffWin')} color="#1E4A82" animate={animateRings} />
              <ProbRing value={report.defendantWinProbability} label={T('report.defendantWin')} color="#DC2626" animate={animateRings} />
              <ProbRing value={report.settlementProbability}   label={T('report.settlement')}   color="#B45309" animate={animateRings} />
            </div>
          </section>

          {/* ── Predicted outcome ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Scale size={14} style={{ color: '#1E4A82' }} />
              <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.outcome')}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(30,74,130,0.04)', border: '1px solid rgba(30,74,130,0.12)' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#0F1E35' }}>{report.predictedOutcome}</p>
              {report.compensationRange && report.compensationRange.max > 0 && (
                <p className="mt-2 text-xs" style={{ color: '#6B8AAD' }}>
                  {T('report.compensationRange')}{report.compensationRange.currency}{' '}
                  {report.compensationRange.min.toLocaleString()} —{' '}
                  {report.compensationRange.max.toLocaleString()}
                </p>
              )}
            </div>
          </section>

          {/* ── Dispute points ─────────────────────────────────────────── */}
          {report.disputePoints.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileSearch size={14} style={{ color: '#1E4A82' }} />
                <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.disputePoints')}</p>
              </div>
              <ul className="space-y-2">
                {report.disputePoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="label-micro shrink-0 mt-0.5"
                      style={{ color: '#1E4A82', background: 'rgba(30,74,130,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: '9px' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: '#374D6B' }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Court judgment ────────────────────────────────────────── */}
          {report.courtJudgment && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Gavel size={14} style={{ color: '#1E4A82' }} />
                <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.courtJudgment')}</p>
              </div>

              {report.courtJudgment.evidenceAdoption?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#374D6B' }}>{T('report.evidenceAdoption')}</p>
                  <div className="space-y-2">
                    {report.courtJudgment.evidenceAdoption.map((ev, i) => {
                      const wStyle = WEIGHT_STYLE[ev.weight] ?? WEIGHT_STYLE.MODERATE
                      const wLabel = T(WEIGHT_KEYS[ev.weight] ?? 'report.weight.MODERATE')
                      const evLabel = ev.side === 'PLAINTIFF' ? T('report.plaintiffEvidence') : T('report.defendantEvidence')
                      return (
                        <div key={i} className="rounded-xl p-4" style={{ border: '1px solid #D5E0EF', background: '#FAFCFF' }}>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="label-micro px-2 py-0.5 rounded" style={{ color: wStyle.color, background: wStyle.bg, fontSize: '9px' }}>
                              {wLabel}
                            </span>
                            <span
                              className="label-micro px-2 py-0.5 rounded"
                              style={{
                                fontSize: '9px',
                                color: ev.side === 'PLAINTIFF' ? '#1E4A82' : '#DC2626',
                                background: ev.side === 'PLAINTIFF' ? 'rgba(30,74,130,0.08)' : 'rgba(220,38,38,0.08)',
                              }}
                            >
                              {evLabel}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: '#0F1E35' }}>{ev.key}</span>
                            {ev.roundRef != null && (
                              <span className="label-micro px-1.5 py-0.5 rounded" style={{ fontSize: '8px', color: '#6B8AAD', background: 'rgba(107,138,173,0.08)' }}>
                                {T('report.roundRef', { n: ev.roundRef })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: '#6B8AAD' }}>{ev.analysis}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {report.courtJudgment.judicialAnalysis && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold" style={{ color: '#374D6B' }}>{T('report.judicialAnalysis')}</p>
                  </div>
                  <div className="rounded-xl p-5" style={{ background: 'rgba(30,74,130,0.03)', border: '1px solid rgba(30,74,130,0.12)' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#374D6B' }}>
                      {report.courtJudgment.judicialAnalysis}
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Litigation strategy ───────────────────────────────────── */}
          {report.litigationStrategy && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} style={{ color: '#047857' }} />
                <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.strategy')}</p>
              </div>
              <div className="space-y-3">
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 8 }}>{T('report.plaintiffStrategy')}</div>
                  <p style={{ fontSize: 13, color: '#374D6B', lineHeight: 1.8 }}>{report.litigationStrategy?.plaintiff}</p>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 8 }}>{T('report.defendantStrategy')}</div>
                  <p style={{ fontSize: 13, color: '#374D6B', lineHeight: 1.8 }}>{report.litigationStrategy?.defendant}</p>
                </div>
              </div>
            </section>
          )}

          {/* ── Phase analysis ────────────────────────────────────────── */}
          {report.phaseAnalysis && report.phaseAnalysis.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Layers size={14} style={{ color: '#2563EB' }} />
                <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.phaseAnalysis')}</p>
              </div>
              <div className="space-y-3">
                {report.phaseAnalysis.map((pa) => {
                  const color = phaseColors[pa.phase] ?? '#6B8AAD'
                  const phaseLabel = T(`gameplay.phase.${pa.phase}` as Parameters<typeof T>[0])
                  return (
                    <div key={pa.phase} className="rounded-xl p-4" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8 }}>{phaseLabel}</div>
                      <p style={{ fontSize: 13, color: '#374D6B', lineHeight: 1.8 }}>{pa.summary}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Social impact analysis ────────────────────────────────── */}
          {report.socialImpactAnalysis && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} style={{ color: '#B45309' }} />
                <p className="text-sm font-semibold" style={{ color: '#374D6B' }}>{T('report.socialImpact')}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#374D6B' }}>{report.socialImpactAnalysis}</p>
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
