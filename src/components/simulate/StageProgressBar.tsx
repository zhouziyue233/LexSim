import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Circle } from 'lucide-react'
import type { SimulationStage, StageStatus } from '@shared/types'

const STAGES: { label: string; sub: string }[] = [
  { label: '主体识别', sub: 'Entity Ontology' },
  { label: '关系网络', sub: 'Relationship Graph' },
  { label: '博弈模拟', sub: 'Legal Gameplay' },
  { label: '预测报告', sub: 'Prediction Report' },
]

interface Props {
  currentStage: SimulationStage
  statuses: Record<number, StageStatus>
}

// Animated SVG checkmark
function CheckmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke="#047857" strokeWidth="1" fill="rgba(4,120,87,0.1)" />
      <path
        d="M4.5 8 L7 10.5 L11.5 5.5"
        stroke="#047857"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 12,
          strokeDashoffset: 0,
          animation: 'drawCheck 0.4s ease-out forwards',
        }}
      />
    </svg>
  )
}

// Pulsing ring indicator for active stage
function PulseRing({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 16, height: 16, flexShrink: 0 }}>
      {/* Pulse rings */}
      <span style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        animation: 'pulse-ring 1.2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      }} />
      <span style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        animation: 'pulse-ring 1.2s cubic-bezier(0.215, 0.61, 0.355, 1) 0.4s infinite',
      }} />
      {/* Center dot */}
      <span style={{
        position: 'absolute', inset: '3px',
        borderRadius: '50%',
        background: color,
        opacity: 0.9,
      }} />
    </span>
  )
}

export default function StageProgressBar({ currentStage, statuses }: Props) {
  // Track start/end timestamps per stage
  const startTimesRef = useRef<Record<number, number>>({})
  const [elapsedTimes, setElapsedTimes] = useState<Record<number, string>>({})

  useEffect(() => {
    const entries: Record<number, string> = {}
    for (let i = 1; i <= 4; i++) {
      const status = statuses[i]
      if (status === 'loading' && !startTimesRef.current[i]) {
        startTimesRef.current[i] = Date.now()
      }
      if ((status === 'done' || status === 'error') && startTimesRef.current[i]) {
        const ms = Date.now() - startTimesRef.current[i]
        entries[i] = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
      }
    }
    setElapsedTimes(prev => ({ ...prev, ...entries }))
  }, [statuses])

  if (currentStage === 0) return null

  return (
    <>
      <style>{`
        @keyframes drawCheck {
          from { stroke-dashoffset: 12; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div
        className="sticky top-[54px] z-20 backdrop-blur-md"
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid #D5E0EF',
          padding: '10px 0',
          boxShadow: '0 1px 4px rgba(15,30,53,0.04)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1">
            {STAGES.map((s, i) => {
              const stageNum = (i + 1) as SimulationStage
              const status = statuses[stageNum] ?? 'idle'
              const isActive = status === 'loading'
              const isDone = status === 'done'
              const isError = status === 'error'

              return (
                <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 min-w-0"
                    style={{
                      background: isDone
                        ? 'rgba(4,120,87,0.07)'
                        : isActive
                        ? 'rgba(30,74,130,0.07)'
                        : isError
                        ? 'rgba(220,38,38,0.07)'
                        : 'transparent',
                      border: isDone
                        ? '1px solid rgba(4,120,87,0.2)'
                        : isActive
                        ? '1px solid rgba(30,74,130,0.2)'
                        : isError
                        ? '1px solid rgba(220,38,38,0.2)'
                        : '1px solid transparent',
                    }}
                  >
                    {/* Stage icon */}
                    {isDone ? (
                      <CheckmarkIcon />
                    ) : isActive ? (
                      <PulseRing color="#1E4A82" />
                    ) : isError ? (
                      <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                    ) : (
                      <Circle size={14} style={{ color: '#C0D0E6', flexShrink: 0 }} />
                    )}

                    {/* Labels */}
                    <span
                      className="label-micro whitespace-nowrap hidden sm:inline"
                      style={{
                        color: isDone ? '#047857' : isActive ? '#1E4A82' : isError ? '#DC2626' : '#A8BDD8',
                        fontSize: '9px',
                      }}
                    >
                      {`0${i + 1}  ${s.label}`}
                    </span>
                    <span className="hidden lg:inline" style={{ color: '#C0D0E6', fontSize: 9, letterSpacing: '0.06em' }}>
                      {s.sub}
                    </span>

                    {/* Elapsed time */}
                    {(isDone || isError) && elapsedTimes[stageNum] && (
                      <span
                        className="hidden sm:inline label-micro"
                        style={{ color: isDone ? 'rgba(4,120,87,0.5)' : 'rgba(220,38,38,0.5)', fontSize: '8px', marginLeft: 2 }}
                      >
                        {elapsedTimes[stageNum]}
                      </span>
                    )}
                  </div>

                  {/* Connector line */}
                  {i < STAGES.length - 1 && (
                    <div
                      className="h-px flex-1 mx-1 transition-all duration-500"
                      style={{
                        background: isDone
                          ? 'linear-gradient(90deg, rgba(4,120,87,0.5), rgba(4,120,87,0.15))'
                          : isActive
                          ? 'linear-gradient(90deg, rgba(30,74,130,0.3), #D5E0EF)'
                          : '#D5E0EF',
                        backgroundSize: isDone || isActive ? 'auto' : '8px 1px',
                        // dashed effect for idle
                        ...((!isDone && !isActive && !isError) && {
                          background: 'none',
                          borderTop: '1px dashed #D5E0EF',
                        }),
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
