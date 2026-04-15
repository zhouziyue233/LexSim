import { useEffect, useRef, useMemo, useState } from 'react'
import {
  FileText, MessageSquare, Scale, HandshakeIcon, Gavel, Mic,
  Newspaper, Share2, Building, AlertTriangle, Users, BookOpen,
  TrendingUp, TrendingDown, Minus, ScrollText,
} from 'lucide-react'
import type { GameplayTimeline, GameplayEvent, LegalEntity, ProceedingType, StageStatus, TrialPhase, JudgeDirective } from '@shared/types'
import { IN_COURT_TYPES } from '@shared/constants'
import { useT } from '../../hooks/useT'
import { useLanguage } from '../../contexts/LanguageContext'

const TYPE_ICON: Record<ProceedingType, React.ReactNode> = {
  EVIDENCE_SUBMISSION:  <FileText size={11} />,
  CROSS_EXAMINATION:    <MessageSquare size={11} />,
  ORAL_ARGUMENT:        <Scale size={11} />,
  SETTLEMENT_OFFER:     <HandshakeIcon size={11} />,
  JUDICIAL_RULING:      <Gavel size={11} />,
  WITNESS_TESTIMONY:    <Mic size={11} />,
  MEDIA_REPORT:         <Newspaper size={11} />,
  SOCIAL_POST:          <Share2 size={11} />,
  LEGISLATIVE_MOTION:   <Building size={11} />,
  GOVT_STATEMENT:       <AlertTriangle size={11} />,
  PUBLIC_PROTEST:       <Users size={11} />,
  EXPERT_OPINION:       <BookOpen size={11} />,
}

const IMPACT_STYLE = {
  POSITIVE: { bg: 'rgba(4,120,87,0.12)', border: 'rgba(4,120,87,0.25)', icon: '#047857' },
  NEGATIVE: { bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.22)', icon: '#DC2626' },
  NEUTRAL:  { bg: 'rgba(107,138,173,0.1)', border: 'rgba(107,138,173,0.2)', icon: '#6B8AAD' },
}

const PROCEEDING_LABELS: Record<'zh' | 'en', Record<ProceedingType, string>> = {
  zh: {
    EVIDENCE_SUBMISSION: '证据提交',
    CROSS_EXAMINATION:   '交叉询问',
    ORAL_ARGUMENT:       '法庭辩论',
    SETTLEMENT_OFFER:    '和解要约',
    JUDICIAL_RULING:     '法官裁量',
    WITNESS_TESTIMONY:   '证人证词',
    MEDIA_REPORT:        '媒体报道',
    SOCIAL_POST:         '网络发声',
    LEGISLATIVE_MOTION:  '议员质询',
    GOVT_STATEMENT:      '政府声明',
    PUBLIC_PROTEST:      '公众行动',
    EXPERT_OPINION:      '专家意见',
  },
  en: {
    EVIDENCE_SUBMISSION: 'Evidence Submission',
    CROSS_EXAMINATION:   'Cross-Examination',
    ORAL_ARGUMENT:       'Oral Argument',
    SETTLEMENT_OFFER:    'Settlement Offer',
    JUDICIAL_RULING:     'Judicial Ruling',
    WITNESS_TESTIMONY:   'Witness Testimony',
    MEDIA_REPORT:        'Media Report',
    SOCIAL_POST:         'Social Post',
    LEGISLATIVE_MOTION:  'Legislative Motion',
    GOVT_STATEMENT:      'Government Statement',
    PUBLIC_PROTEST:      'Public Protest',
    EXPERT_OPINION:      'Expert Opinion',
  },
}

// ── Trial phase helpers ─────────────────────────────────────────────────────
const PHASE_KEYS: { key: TrialPhase; color: string }[] = [
  { key: 'OPENING', color: '#6366F1' },
  { key: 'EVIDENCE', color: '#2563EB' },
  { key: 'DEBATE',   color: '#D97706' },
  { key: 'CLOSING',  color: '#DC2626' },
]

function getPhaseFromRound(round: number, totalRounds: number): TrialPhase {
  const ratio = round / totalRounds
  if (ratio <= 0.15) return 'OPENING'
  if (ratio <= 0.50) return 'EVIDENCE'
  if (ratio <= 0.80) return 'DEBATE'
  return 'CLOSING'
}

// ── Phase progress bar ──────────────────────────────────────────────────────
function PhaseProgressBar({ currentPhase, currentRound, totalRounds }: {
  currentPhase: TrialPhase | null
  currentRound: number
  totalRounds: number
}) {
  const T = useT()
  const effectivePhase: TrialPhase | null = currentPhase
    ?? (currentRound > 0 ? getPhaseFromRound(currentRound, totalRounds) : null)
  const isComplete = currentRound >= totalRounds && totalRounds > 0
  const activeIdx = effectivePhase ? PHASE_KEYS.findIndex(p => p.key === effectivePhase) : -1
  const FILL_COLOR = '#1E4A82'

  return (
    <div style={{ padding: '10px 20px 8px', borderBottom: '1px solid #EDF2F9' }}>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>{T('gameplay.trialPhase')}</span>
        {isComplete && (
          <span className="label-micro" style={{ fontSize: '9px', color: '#047857' }}>
            {T('gameplay.completed')}
          </span>
        )}
      </div>
      <div className="flex gap-1" style={{ height: 6 }}>
        {PHASE_KEYS.map((phase, idx) => {
          const isDone = isComplete || idx < activeIdx
          const isActive = !isComplete && idx === activeIdx
          return (
            <div
              key={phase.key}
              style={{
                flex: idx === 0 ? 0.15 : idx === 1 ? 0.35 : idx === 2 ? 0.30 : 0.20,
                borderRadius: 3,
                background: isDone ? FILL_COLOR : isActive ? FILL_COLOR : '#EDF2F9',
                opacity: isDone && !isActive && !isComplete ? 0.5 : 1,
                transition: 'background 0.4s, opacity 0.4s',
              }}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        {PHASE_KEYS.map((phase, idx) => {
          const isDone = isComplete || idx < activeIdx
          const isActive = !isComplete && idx === activeIdx
          return (
            <span
              key={phase.key}
              style={{
                fontSize: '10px',
                color: isActive ? FILL_COLOR : isDone ? '#374D6B' : '#9BB0CA',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {T(`gameplay.phase.${phase.key}` as Parameters<typeof T>[0])}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Judge directives panel ──────────────────────────────────────────────────
function DirectivesPanel({ directives, currentRound }: {
  directives: JudgeDirective[]
  currentRound: number
}) {
  const T = useT()
  if (directives.length === 0) return null
  return (
    <div style={{ padding: '8px 20px', borderBottom: '1px solid #EDF2F9', background: 'rgba(245,158,11,0.04)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <ScrollText size={11} style={{ color: '#D97706' }} />
        <span className="text-xs font-semibold" style={{ color: '#D97706' }}>{T('gameplay.judgeDirective')}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {directives.map(d => {
          const remaining = d.expiresRound - currentRound
          return (
            <div key={d.id} className="flex items-start gap-2" style={{ fontSize: 11, color: '#4B5563' }}>
              <Gavel size={10} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{d.description}</span>
              <span
                className="label-micro tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  fontSize: '10px', flexShrink: 0,
                  color: remaining <= 1 ? '#DC2626' : '#D97706',
                  background: remaining <= 1 ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
                }}
              >
                {T('gameplay.remainingRounds', { n: remaining })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Momentum indicator ──────────────────────────────────────────────────────
function MomentumIndicator({ events }: { events: GameplayEvent[] }) {
  const T = useT()
  const recent = events.slice(-5)
  if (recent.length < 2) return null
  const shifts = recent.map(e => e.probabilityShift)
  const pos = shifts.filter(s => s > 0).length
  const neg = shifts.filter(s => s < 0).length

  let icon: React.ReactNode
  let label: string

  if (pos >= 4) {
    icon = <TrendingUp size={12} />; label = T('gameplay.momentum.plaintiff_strong')
  } else if (neg >= 4) {
    icon = <TrendingDown size={12} />; label = T('gameplay.momentum.defendant_strong')
  } else if (pos >= 3) {
    icon = <TrendingUp size={12} />; label = T('gameplay.momentum.plaintiff_advantage')
  } else if (neg >= 3) {
    icon = <TrendingDown size={12} />; label = T('gameplay.momentum.defendant_advantage')
  } else {
    icon = <Minus size={12} />; label = T('gameplay.momentum.stalemate')
  }

  return (
    <div className="flex items-center gap-1" style={{ color: '#374D6B' }}>
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

// ── Bezier smooth path helpers ──────────────────────────────────────────────
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0].x},${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cpx = (prev.x + curr.x) / 2
    d.push(`C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`)
  }
  return d.join(' ')
}

function smoothAreaPath(pts: { x: number; y: number }[], bottomY: number): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0].x},${bottomY}`, `L ${pts[0].x},${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cpx = (prev.x + curr.x) / 2
    d.push(`C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`)
  }
  d.push(`L ${pts[pts.length - 1].x},${bottomY}`, 'Z')
  return d.join(' ')
}

// ── Mini probability line chart ─────────────────────────────────────────────
function ProbabilityChart({ probHistory, totalRounds }: { probHistory: number[]; totalRounds: number }) {
  const T = useT()
  const W = 600, H = 64, PAD = 8
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (probHistory.length < 2) return null

  const xStep = (W - PAD * 2) / (probHistory.length - 1)
  const yFor = (p: number) => PAD + (H - PAD * 2) * (1 - p / 100)

  const plaintiffPts = probHistory.map((p, i) => ({ x: PAD + i * xStep, y: yFor(p) }))
  const defendantPts = probHistory.map((p, i) => ({ x: PAD + i * xStep, y: yFor(100 - p) }))

  const plaintiffPath = smoothLinePath(plaintiffPts)
  const defendantPath = smoothLinePath(defendantPts)
  const areaPath = smoothAreaPath(plaintiffPts, H - PAD)

  const eventsPerRound = totalRounds > 0 ? probHistory.length / totalRounds : 1
  const getRound = (idx: number) => Math.min(Math.floor(idx / eventsPerRound) + 1, totalRounds || idx + 1)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round((svgX - PAD) / xStep)
    if (idx >= 0 && idx < probHistory.length) setHoverIdx(idx)
    else setHoverIdx(null)
  }

  const lastPt = plaintiffPts[plaintiffPts.length - 1]
  const lastDefPt = defendantPts[defendantPts.length - 1]

  return (
    <div style={{ padding: '12px 20px 4px', borderBottom: '1px solid #EDF2F9' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>
          {T('gameplay.winProbTrend')}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 label-micro" style={{ fontSize: '9px', color: '#1E4A82' }}>
            <span style={{ width: 12, height: 2, background: '#1E4A82', borderRadius: 1, display: 'inline-block' }} />
            {T('role.PLAINTIFF')}
          </span>
          <span className="flex items-center gap-1.5 label-micro" style={{ fontSize: '9px', color: '#DC2626' }}>
            <span style={{ width: 12, height: 2, background: '#DC2626', borderRadius: 1, display: 'inline-block' }} />
            {T('role.DEFENDANT')}
          </span>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 64, display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="plaintiff-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E4A82" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1E4A82" stopOpacity="0.01" />
          </linearGradient>
          <filter id="line-glow-p">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <line
          x1={PAD} y1={yFor(50)} x2={W - PAD} y2={yFor(50)}
          stroke="#D5E0EF" strokeWidth="1" strokeDasharray="4 3"
        />
        <path d={areaPath} fill="url(#plaintiff-fill)" />
        <path
          d={defendantPath}
          fill="none" stroke="#DC2626" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="4 2" opacity="0.75"
        />
        <path
          d={plaintiffPath}
          fill="none" stroke="#1E4A82" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'url(#line-glow-p)' }}
        />
        {hoverIdx === null && (
          <>
            <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill="#1E4A82" opacity="0.3" />
            <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill="#1E4A82" />
            <circle cx={lastDefPt.x} cy={lastDefPt.y} r="2.5" fill="#DC2626" opacity="0.7" />
          </>
        )}
        {hoverIdx !== null && (() => {
          const x = PAD + hoverIdx * xStep
          const pProb = probHistory[hoverIdx]
          const dProb = 100 - pProb
          const round = getRound(hoverIdx)
          const tooltipX = x > W * 0.75 ? x - 8 : x + 8
          const anchor = x > W * 0.75 ? 'end' : 'start'
          return (
            <g>
              <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="#A8BDD8" strokeWidth="0.5" />
              <circle cx={x} cy={yFor(pProb)} r="3" fill="#1E4A82" />
              <circle cx={x} cy={yFor(dProb)} r="3" fill="#DC2626" />
              <text x={tooltipX} y={PAD + 2} textAnchor={anchor} style={{ fontSize: 8, fill: '#374D6B', fontWeight: 600 }}>
                {T('gameplay.hoverRound', { round })}
              </text>
              <text x={tooltipX} y={PAD + 12} textAnchor={anchor} style={{ fontSize: 8, fill: '#1E4A82' }}>
                {T('gameplay.hoverPlaintiff', { n: Math.round(pProb) })}
              </text>
              <text x={tooltipX} y={PAD + 22} textAnchor={anchor} style={{ fontSize: 8, fill: '#DC2626' }}>
                {T('gameplay.hoverDefendant', { n: Math.round(dProb) })}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ── Sentiment delta micro-bar ────────────────────────────────────────────────
function SentimentBar({ delta }: { delta: number }) {
  const T = useT()
  if (delta === 0) return null
  const positive = delta > 0
  const width = Math.min(Math.abs(delta) * 1.5, 36)
  return (
    <span
      className="inline-flex items-center gap-1 label-micro"
      style={{ fontSize: '9px', color: positive ? '#047857' : '#DC2626' }}
    >
      {positive ? '+' : ''}{delta} {T('gameplay.sentiment')}
      <span style={{
        display: 'inline-block',
        width,
        height: 3,
        borderRadius: 2,
        background: positive ? '#047857' : '#DC2626',
        opacity: 0.7,
      }} />
    </span>
  )
}

interface Props {
  timeline: GameplayTimeline | null
  entities: LegalEntity[]
  status: StageStatus
  currentPhase?: TrialPhase | null
  activeDirectives?: JudgeDirective[]
  totalRounds?: number
}

function EventCard({ event, entities, seenIdsRef }: {
  event: GameplayEvent
  entities: LegalEntity[]
  seenIdsRef: React.MutableRefObject<Set<string>>
}) {
  const T = useT()
  const { lang } = useLanguage()
  const isNew = !seenIdsRef.current.has(event.id)
  if (isNew) seenIdsRef.current.add(event.id)

  const actor = entities.find(e => e.id === event.actorId)
  const impact = IMPACT_STYLE[event.impact]
  const sentimentDelta = event.publicSentimentDelta ?? 0
  const proceedingLabel = PROCEEDING_LABELS[lang][event.type] ?? event.type
  const shiftSign = event.probabilityShift > 0 ? '+' : ''

  return (
    <div
      className="flex gap-3 mb-3"
      style={isNew ? { animation: 'slideInRight 0.3s ease forwards' } : undefined}
    >
      <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 26, height: 26, background: impact.bg, border: `1px solid ${impact.border}`, color: impact.icon }}
        >
          {TYPE_ICON[event.type]}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="label-micro" style={{ color: '#6B8AAD', fontSize: '9px' }}>
            {proceedingLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-1">
          {actor && (
            <span className="text-xs font-semibold" style={{ color: '#0F1E35' }}>{actor.name}</span>
          )}
          {event.probabilityShift !== 0 && (
            <span
              className="label-micro tabular-nums"
              style={{
                fontSize: '9px',
                color: event.probabilityShift > 0 ? '#047857' : '#DC2626',
                background: event.probabilityShift > 0 ? 'rgba(4,120,87,0.08)' : 'rgba(220,38,38,0.08)',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {shiftSign}{T('gameplay.winPct', { n: event.probabilityShift })}
            </span>
          )}
          {sentimentDelta !== 0 && <SentimentBar delta={sentimentDelta} />}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: '#6B8AAD' }}>
          {event.description}
        </p>
      </div>
    </div>
  )
}

export default function GameplayTimelinePanel({ timeline, entities, status, currentPhase, activeDirectives, totalRounds }: Props) {
  const T = useT()
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline?.events.length])

  const events = timeline?.events ?? []
  const prob = Math.round(timeline?.currentPlaintiffWinProb ?? 50)
  const sentiment = timeline?.socialInfluenceScore ?? 0

  const probHistory = useMemo(() => {
    let acc = 50
    return events.map(e => {
      acc = Math.max(0, Math.min(100, acc + e.probabilityShift))
      return acc
    })
  }, [events])

  const roundGroups = useMemo(() => {
    const map = new Map<number, { court: GameplayEvent[]; social: GameplayEvent[] }>()
    for (const e of events) {
      let group = map.get(e.round)
      if (!group) { group = { court: [], social: [] }; map.set(e.round, group) }
      if (IN_COURT_TYPES.has(e.type)) group.court.push(e)
      else group.social.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [events])

  const effectiveRounds = totalRounds ?? (events.length > 0 ? Math.max(...events.map(e => e.round)) : 0)
  const currentRound = events.length > 0 ? events[events.length - 1].round : 0

  const phaseGroups = useMemo(() => {
    if (effectiveRounds === 0) return []
    const phases: { phase: TrialPhase; rounds: { round: number; court: GameplayEvent[]; social: GameplayEvent[] }[] }[] = []
    const phaseMap = new Map<TrialPhase, { round: number; court: GameplayEvent[]; social: GameplayEvent[] }[]>()

    for (const [round, group] of roundGroups) {
      const phase = getPhaseFromRound(round, effectiveRounds)
      if (!phaseMap.has(phase)) phaseMap.set(phase, [])
      phaseMap.get(phase)!.push({ round, ...group })
    }

    for (const cfg of PHASE_KEYS) {
      const rounds = phaseMap.get(cfg.key)
      if (rounds && rounds.length > 0) {
        phases.push({ phase: cfg.key, rounds })
      }
    }
    return phases
  }, [roundGroups, effectiveRounds])

  return (
    <div>
      {effectiveRounds > 0 && (
        <PhaseProgressBar currentPhase={currentPhase ?? null} currentRound={currentRound} totalRounds={effectiveRounds} />
      )}

      <ProbabilityChart probHistory={probHistory} totalRounds={effectiveRounds} />

      <DirectivesPanel directives={activeDirectives ?? []} currentRound={currentRound} />

      {/* Summary stats */}
      <div
        className="grid grid-cols-2 gap-px"
        style={{ borderBottom: '1px solid #EDF2F9', background: '#EDF2F9' }}
      >
        <div style={{ background: '#FFFFFF', padding: '12px 20px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>{T('gameplay.plaintiffWinProb')}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: prob >= 50 ? '#047857' : '#DC2626', transition: 'color 0.3s' }}>
              {prob}%
            </span>
          </div>
          <div style={{ height: 6, background: '#EDF2F9', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${prob}%`,
              background: 'linear-gradient(90deg, #1E4A82, #2563EB)',
              borderRadius: '3px 0 0 3px',
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
            <div style={{ flex: 1, background: '#EF4444', opacity: 0.7, borderRadius: '0 3px 3px 0' }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-medium" style={{ color: '#1E4A82' }}>{T('role.PLAINTIFF')} {prob}%</span>
            <span className="text-[10px] font-medium" style={{ color: '#DC2626' }}>{T('role.DEFENDANT')} {100 - prob}%</span>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '12px 20px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>{T('gameplay.socialInfluence')}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: sentiment >= 0 ? '#047857' : '#DC2626', transition: 'color 0.3s' }}>
              {sentiment > 0 ? '+' : ''}{sentiment}
            </span>
          </div>
          <div style={{ height: 6, background: '#EDF2F9', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#D5E0EF', zIndex: 1 }} />
            <div style={{
              position: 'absolute', height: '100%',
              left: sentiment >= 0 ? '50%' : `${50 + Math.max(sentiment, -100) / 2}%`,
              width: `${Math.min(Math.abs(sentiment), 100) / 2}%`,
              background: sentiment >= 0 ? '#047857' : '#DC2626',
              transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
              borderRadius: 3,
            }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-medium" style={{ color: '#6B8AAD' }}>{T('gameplay.unfavorable')}</span>
            <span className="text-[10px] font-medium" style={{ color: '#6B8AAD' }}>{T('gameplay.favorable')}</span>
          </div>
        </div>
      </div>

      {/* Momentum indicator */}
      {events.length >= 2 && (
        <div style={{ padding: '6px 20px', borderBottom: '1px solid #EDF2F9' }} className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>{T('gameplay.momentum.label')}</span>
          <MomentumIndicator events={events} />
        </div>
      )}

      {/* Events grouped by round */}
      <div style={{ padding: '16px 20px', maxHeight: 520, overflowY: 'auto' }}>
        {events.length === 0 && status === 'loading' && (
          <div className="flex flex-col items-center gap-2 py-10">
            <span className="spinner" />
            <p className="text-sm" style={{ color: '#A8BDD8' }}>{T('gameplay.waitingEvents')}</p>
          </div>
        )}

        {phaseGroups.length > 0 ? phaseGroups.map((pg, pgIdx) => {
          const phaseColor = PHASE_KEYS.find(p => p.key === pg.phase)?.color ?? '#6B8AAD'
          const phaseLabel = T(`gameplay.phase.${pg.phase}` as Parameters<typeof T>[0])
          return (
            <div key={pg.phase}>
              {pgIdx > 0 && <div style={{ height: 1, background: '#D5E0EF', margin: '16px 0 12px' }} />}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="label-micro px-2 py-0.5 rounded"
                  style={{ fontSize: '10px', color: phaseColor, background: `${phaseColor}10`, border: `1px solid ${phaseColor}25`, fontWeight: 700 }}
                >
                  {phaseLabel}
                </span>
              </div>

              {pg.rounds.map((rg, idx) => (
                <div key={rg.round}>
                  {idx > 0 && <div style={{ height: 1, background: '#EDF2F9', margin: '10px 0' }} />}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="label-micro tabular-nums px-2 py-0.5 rounded"
                      style={{ fontSize: '9px', color: '#1E4A82', background: 'rgba(30,74,130,0.06)', border: '1px solid rgba(30,74,130,0.12)' }}
                    >
                      {T('gameplay.roundLabel', { n: rg.round })}
                    </span>
                    <span className="text-[10px]" style={{ color: '#9BB0CA' }}>
                      {T('gameplay.eventsCount', { n: rg.court.length + rg.social.length })}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {rg.court.length > 0 ? (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.06em', marginBottom: 8 }}>
                            {T('gameplay.courtEvents')}
                          </div>
                          {rg.court.map(event => (
                            <EventCard key={event.id} event={event} entities={entities} seenIdsRef={seenIdsRef} />
                          ))}
                        </>
                      ) : (
                        <div style={{ fontSize: 10, color: '#C0D0E6', fontStyle: 'italic', paddingTop: 2 }}>{T('gameplay.noCourtEvents')}</div>
                      )}
                    </div>
                    <div>
                      {rg.social.length > 0 ? (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.06em', marginBottom: 8 }}>
                            {T('gameplay.socialEvents')}
                          </div>
                          {rg.social.map(event => (
                            <EventCard key={event.id} event={event} entities={entities} seenIdsRef={seenIdsRef} />
                          ))}
                        </>
                      ) : (
                        <div style={{ fontSize: 10, color: '#C0D0E6', fontStyle: 'italic', paddingTop: 2 }}>{T('gameplay.noSocialEvents')}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }) : roundGroups.map(([round, group], idx) => (
          <div key={round}>
            {idx > 0 && <div style={{ height: 1, background: '#EDF2F9', margin: '12px 0' }} />}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="label-micro tabular-nums px-2 py-0.5 rounded"
                style={{ fontSize: '9px', color: '#1E4A82', background: 'rgba(30,74,130,0.06)', border: '1px solid rgba(30,74,130,0.12)' }}
              >
                {T('gameplay.roundLabel', { n: round })}
              </span>
              <span className="text-[10px]" style={{ color: '#9BB0CA' }}>
                {T('gameplay.eventsCount', { n: group.court.length + group.social.length })}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {group.court.length > 0 ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {T('gameplay.courtEvents')}
                    </div>
                    {group.court.map(event => (
                      <EventCard key={event.id} event={event} entities={entities} seenIdsRef={seenIdsRef} />
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: '#C0D0E6', fontStyle: 'italic', paddingTop: 2 }}>{T('gameplay.noCourtEvents')}</div>
                )}
              </div>
              <div>
                {group.social.length > 0 ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {T('gameplay.socialEvents')}
                    </div>
                    {group.social.map(event => (
                      <EventCard key={event.id} event={event} entities={entities} seenIdsRef={seenIdsRef} />
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: '#C0D0E6', fontStyle: 'italic', paddingTop: 2 }}>{T('gameplay.noSocialEvents')}</div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
