import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  History as HistoryIcon, Trash2,
  Clock, Users, FileText, TrendingUp, AlertCircle, Network,
  Search, CheckCircle, Activity,
} from 'lucide-react'
import type { Simulation } from '@shared/types'
import PredictionReportPanel from '../components/simulate/PredictionReport'
import {
  deleteSimulation,
  getSimulation,
  listSimulations,
} from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { useT } from '../hooks/useT'
import { t } from '../i18n/translations'

type SimulationSummary = Pick<Simulation, 'id' | 'projectName' | 'caseInput' | 'caseSummary' | 'roundCount' | 'status' | 'stage' | 'createdAt'>

function StatusBadge({ status }: { status: string }) {
  const T = useT()

  const labelKey = (() => {
    switch (status) {
      case 'done':
      case 'completed': return 'status.done'
      case 'running':   return 'status.running'
      case 'error':     return 'status.error'
      case 'failed':    return 'status.failed'
      default:          return 'status.idle'
    }
  })()

  const styleMap: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    done:      { color: '#047857', bg: 'rgba(4,120,87,0.07)',    border: 'rgba(4,120,87,0.2)',    dot: '#047857' },
    completed: { color: '#047857', bg: 'rgba(4,120,87,0.07)',    border: 'rgba(4,120,87,0.2)',    dot: '#047857' },
    running:   { color: '#1E4A82', bg: 'rgba(30,74,130,0.07)',   border: 'rgba(30,74,130,0.2)',   dot: '#1E4A82' },
    error:     { color: '#DC2626', bg: 'rgba(220,38,38,0.07)',   border: 'rgba(220,38,38,0.2)',   dot: '#DC2626' },
    failed:    { color: '#DC2626', bg: 'rgba(220,38,38,0.07)',   border: 'rgba(220,38,38,0.2)',   dot: '#DC2626' },
    idle:      { color: '#6B8AAD', bg: 'rgba(107,138,173,0.07)', border: 'rgba(107,138,173,0.2)', dot: '#A8BDD8' },
  }
  const s = styleMap[status] ?? styleMap.idle
  const isRunning = status === 'running'
  const label = T(labelKey)

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }}
    >
      {isRunning
        ? <span className="live-dot" style={{ background: s.dot, width: 5, height: 5 }} />
        : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      }
      {label.toUpperCase()}
    </span>
  )
}

function formatRelativeTime(dateStr: string, lang: 'zh' | 'en'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return t('time.justNow', lang)
  if (mins < 60) return t('time.minutesAgo', lang, { n: mins })
  if (hours < 24) return t('time.hoursAgo', lang, { n: hours })
  if (days < 30) return t('time.daysAgo', lang, { n: days })
  const locale = t('time.locale', lang)
  return new Date(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #D5E0EF' }}>
      <span style={{ color: color ?? '#1E4A82' }}>{icon}</span>
      <div>
        <div className="font-semibold tabular-nums" style={{ fontSize: 13, color: '#0F1E35', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 10, color: '#6B8AAD', letterSpacing: '0.04em', lineHeight: 1.4 }}>{label}</div>
      </div>
    </div>
  )
}

export default function History() {
  const { lang } = useLanguage()
  const T = useT()

  const [simulations, setSimulations] = useState<SimulationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const refreshList = useCallback(async () => {
    const next = await listSimulations()
    setSimulations(next)
    setSelectedId(current => current ?? next[0]?.id ?? null)
    return next
  }, [])

  const loadDetails = useCallback(async (simulationId: string) => {
    const simulation = await getSimulation(simulationId)
    setSelectedSimulation(simulation)
  }, [])

  useEffect(() => {
    setLoading(true)
    refreshList().catch(err => setError(String(err))).finally(() => setLoading(false))
  }, [refreshList])

  useEffect(() => {
    if (!selectedId) { setSelectedSimulation(null); return }
    setSelectedSimulation(null)
    loadDetails(selectedId).catch(err => setError(String(err)))
  }, [loadDetails, selectedId])

  const handleDelete = async (simulationId: string) => {
    setBusyAction(`delete:${simulationId}`)
    setError(null)
    try {
      await deleteSimulation(simulationId)
      const next = await refreshList()
      const nextSelectedId = selectedId === simulationId ? next[0]?.id ?? null : selectedId
      setSelectedId(nextSelectedId)
      if (nextSelectedId) await loadDetails(nextSelectedId)
      else setSelectedSimulation(null)
    } catch (err) { setError(String(err)) }
    finally { setBusyAction(null) }
  }

  const report = selectedSimulation?.report ?? null
  const graph = selectedSimulation?.graph ?? null
  const relationTypes = graph ? new Set(graph.edges.map(e => e.type)).size : 0

  const filteredSimulations = searchQuery.trim()
    ? simulations.filter(s =>
        (s.projectName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.caseSummary ?? s.caseInput ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : simulations

  const doneCount = simulations.filter(s => s.status === 'completed').length
  const runningCount = simulations.filter(s => s.status === 'running').length
  const errorCount = simulations.filter(s => s.status === 'failed').length

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB' }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid #D5E0EF', background: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-micro mb-1" style={{ color: '#6B8AAD' }}>{T('history.pageLabel')}</p>
            <h1 className="text-xl font-semibold" style={{ color: '#0F1E35', fontFamily: 'Noto Serif SC, Georgia, serif' }}>
              {T('history.title')}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Aggregate status badges */}
            {simulations.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                {doneCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(4,120,87,0.07)', color: '#047857', border: '1px solid rgba(4,120,87,0.15)' }}>
                    <CheckCircle size={10} />{doneCount} {T('history.stat.done')}
                  </span>
                )}
                {runningCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(30,74,130,0.07)', color: '#1E4A82', border: '1px solid rgba(30,74,130,0.15)' }}>
                    <span className="live-dot" style={{ width: 5, height: 5 }} />{runningCount} {T('history.stat.running')}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
                    <AlertCircle size={10} />{errorCount} {T('history.stat.error')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626' }}
          >
            <AlertCircle size={14} />{error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5">
          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #D5E0EF', boxShadow: '0 1px 4px rgba(15,30,53,0.04)', height: 'fit-content' }}>
            {/* Sidebar header + search */}
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #D5E0EF', background: '#F4F7FB' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: '#0F1E35' }}>{T('history.tasks')}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(30,74,130,0.08)', color: '#1E4A82' }}>
                  {filteredSimulations.length}{searchQuery ? `/${simulations.length}` : ''}
                </span>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#A8BDD8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={T('history.search')}
                  className="input-field"
                  style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
                />
              </div>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading && (
                <div className="px-5 py-8 text-sm text-center" style={{ color: '#A8BDD8' }}>
                  <div className="spinner mx-auto mb-2" />{T('history.loading')}
                </div>
              )}
              {!loading && filteredSimulations.length === 0 && (
                <div className="px-5 py-10 text-sm text-center" style={{ color: '#A8BDD8' }}>
                  <FileText size={28} className="mx-auto mb-3 opacity-30" />
                  {searchQuery ? T('history.noMatch') : T('history.empty')}
                </div>
              )}
              {filteredSimulations.map((simulation, idx) => {
                const isSelected = selectedId === simulation.id
                const delayClass = idx < 5 ? `delay-${Math.min((idx + 1) * 100, 500)}` : ''
                return (
                  <button
                    key={simulation.id}
                    onClick={() => setSelectedId(simulation.id)}
                    className={`w-full text-left px-4 py-4 transition-all duration-200 animate-fade-up ${delayClass}`}
                    style={{
                      borderBottom: '1px solid #EDF2F9',
                      background: isSelected ? 'rgba(30,74,130,0.05)' : 'transparent',
                      borderLeft: `3px solid ${isSelected ? '#1E4A82' : 'transparent'}`,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        const el = e.currentTarget
                        el.style.background = '#F4F7FB'
                        el.style.transform = 'translateX(2px)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        const el = e.currentTarget
                        el.style.background = 'transparent'
                        el.style.transform = 'none'
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <StatusBadge status={simulation.status} />
                      <span className="text-xs" style={{ color: '#374D6B' }}>{formatRelativeTime(simulation.createdAt, lang)}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1 text-left" style={{ color: isSelected ? '#1E4A82' : '#0F1E35', transition: 'color 0.2s' }}>
                      {simulation.projectName || T('history.unnamed')}
                    </p>
                    <p className="text-left leading-relaxed line-clamp-2 mb-2.5" style={{ color: '#374D6B', fontSize: 12 }}>
                      {simulation.caseSummary || simulation.caseInput}
                    </p>
                    <div className="flex items-center gap-3" style={{ fontSize: 11, color: '#374D6B' }}>
                      <span className="flex items-center gap-1"><Clock size={10} />{simulation.roundCount} {T('history.item.rounds')}</span>
                      <span className="flex items-center gap-1"><Activity size={10} />Stage {simulation.stage}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* ── Detail panel ──────────────────────────────────────────── */}
          <section className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #D5E0EF', boxShadow: '0 1px 4px rgba(15,30,53,0.04)', minHeight: 560 }}>
            {!selectedSimulation && (
              <div className="h-full flex flex-col items-center justify-center py-20" style={{ color: '#A8BDD8' }}>
                <div className="mb-4 p-4 rounded-2xl" style={{ background: '#F4F7FB', border: '1px solid #D5E0EF' }}>
                  <HistoryIcon size={32} style={{ opacity: 0.35 }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: '#6B8AAD' }}>{T('history.selectHint')}</p>
                <p className="text-xs" style={{ color: '#A8BDD8' }}>{T('history.selectSub')}</p>
              </div>
            )}

            {selectedSimulation && (
              <div className="animate-fade-up">
                {/* Header bar */}
                <div style={{ borderBottom: '1px solid #D5E0EF', overflow: 'hidden' }}>
                  {/* Top gradient accent bar */}
                  <div style={{ height: 3, background: 'linear-gradient(90deg, #1E4A82 0%, #2563EB 50%, #3B82F6 100%)' }} />
                  <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-4"
                    style={{ background: 'linear-gradient(180deg, #F8FAFD 0%, #FFFFFF 100%)' }}>
                    <div>
                      {selectedSimulation.projectName && (
                        <h2 className="text-base font-semibold mb-2.5" style={{ color: '#0F1E35', fontFamily: 'Noto Serif SC, Georgia, serif' }}>
                          {selectedSimulation.projectName}
                        </h2>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <StatusBadge status={selectedSimulation.status} />
                        <span className="text-xs" style={{ color: '#374D6B' }}>
                          {new Date(selectedSimulation.createdAt).toLocaleString(t('time.locale', lang))}
                        </span>
                      </div>
                      {/* Stat chips */}
                      <div className="flex flex-wrap gap-2">
                        <StatChip
                          icon={<Clock size={12} />}
                          value={selectedSimulation.roundCount ?? (selectedSimulation.timeline?.events.length
                            ? Math.max(...selectedSimulation.timeline.events.map(e => e.round))
                            : '?')}
                          label={T('history.chip.rounds')}
                        />
                        <StatChip
                          icon={<Users size={12} />}
                          value={selectedSimulation.entities.length}
                          label={T('history.chip.entities')}
                          color="#047857"
                        />
                        <StatChip
                          icon={<Network size={12} />}
                          value={relationTypes}
                          label={T('history.chip.relations')}
                          color="#7C3AED"
                        />
                        <StatChip
                          icon={<TrendingUp size={12} />}
                          value={selectedSimulation.timeline?.events.length ?? 0}
                          label={T('history.chip.events')}
                          color="#B45309"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/simulate/${selectedSimulation.id}`}
                        className="btn-outline gap-2 text-sm"
                        style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14 }}
                      >
                        <HistoryIcon size={13} />{T('history.openReplay')}
                      </Link>
                      <button
                        onClick={() => handleDelete(selectedSimulation.id)}
                        disabled={!!busyAction}
                        className="btn-ghost gap-2 text-sm"
                        style={{ color: '#DC2626', paddingTop: 8, paddingBottom: 8 }}
                      >
                        <Trash2 size={13} />{T('history.delete')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Case background */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{ width: 3, height: 16, borderRadius: 2, background: '#1E4A82', flexShrink: 0 }} />
                      <p className="text-sm font-semibold" style={{ color: '#0F1E35' }}>{T('history.caseBackground')}</p>
                    </div>
                    <div
                      className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ background: '#F4F7FB', border: '1px solid #D5E0EF', color: '#374D6B', maxHeight: 320, overflowY: 'auto', lineHeight: 1.85 }}
                    >
                      {(selectedSimulation.caseSummary || selectedSimulation.caseInput || T('history.noCaseInfo'))
                        .replace(/^\*{0,2}案件结构化摘要[^*\n]*\*{0,2}\s*\n*/i, '')}
                    </div>
                  </div>

                  {/* Prediction Report */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{ width: 3, height: 16, borderRadius: 2, background: '#B45309', flexShrink: 0 }} />
                      <p className="text-sm font-semibold" style={{ color: '#0F1E35' }}>{T('history.predReport')}</p>
                    </div>
                    {!report ? (
                      <div className="rounded-xl p-8 text-center" style={{ background: '#F4F7FB', border: '1px solid #D5E0EF' }}>
                        <FileText size={28} className="mx-auto mb-3" style={{ color: '#D5E0EF' }} />
                        <p className="text-sm" style={{ color: '#A8BDD8' }}>{T('history.noReport')}</p>
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #D5E0EF' }}>
                        <PredictionReportPanel report={report} status="done" streamingText="" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
