import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Cpu, PlusCircle, CheckCircle2,
  Network, FileText, ChevronDown, Download, MessageCircle,
} from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSimulation } from '../hooks/useSimulation'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import type { StageStatus, SimulationStage } from '@shared/types'
import LLMConfigPanel from '../components/LLMConfigPanel'
import CaseInputForm from '../components/simulate/CaseInputForm'
import EntityOntologyPanel from '../components/simulate/EntityOntologyPanel'
import RelationshipGraphPanel from '../components/simulate/RelationshipGraph'
import GameplayTimelinePanel from '../components/simulate/GameplayTimeline'
import PredictionReportPanel, { generateReportMarkdown } from '../components/simulate/PredictionReport'
import AgentChat from '../components/simulate/AgentChat'
import { useT } from '../hooks/useT'

// ─── Stage metadata keys ─────────────────────────────────────────────────────

type StageMeta = { titleKey: string; sub: string; descKey: string }

const STAGE_META: Record<number, StageMeta> = {
  1: { titleKey: 'stage.1.title', sub: 'Entity Ontology',    descKey: 'stage.1.desc' },
  2: { titleKey: 'stage.2.title', sub: 'Relationship Graph', descKey: 'stage.2.desc' },
  3: { titleKey: 'stage.3.title', sub: 'Legal Gameplay',     descKey: 'stage.3.desc' },
  4: { titleKey: 'stage.4.title', sub: 'Prediction Report',  descKey: 'stage.4.desc' },
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StageStatus }) {
  const T = useT()
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
        style={{ color: '#047857', background: 'rgba(4,120,87,0.1)', border: '1px solid rgba(4,120,87,0.2)' }}>
        <CheckCircle2 size={12} /> {T('simulate.stage.done')}
      </span>
    )
  }
  if (status === 'loading') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
        style={{ color: '#B45309', background: 'rgba(180,83,9,0.1)', border: '1px solid rgba(180,83,9,0.2)' }}>
        <span className="w-2.5 h-2.5 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
        {T('simulate.stage.loading')}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
        style={{ color: '#DC2626', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <AlertCircle size={12} /> {T('simulate.stage.error')}
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 rounded-md text-xs font-semibold"
      style={{ color: '#A8BDD8', background: 'rgba(168,189,216,0.1)', border: '1px solid rgba(168,189,216,0.2)' }}>
      {T('simulate.stage.idle')}
    </span>
  )
}

// ─── Stage connector ─────────────────────────────────────────────────────────

function StageConnector({ fromStatus }: { fromStatus: StageStatus }) {
  const isDone = fromStatus === 'done'
  const isRunning = fromStatus === 'loading'
  return (
    <div style={{ paddingLeft: 34, height: 10, display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          width: 2,
          height: 10,
          borderRadius: 1,
          background: isDone
            ? 'linear-gradient(180deg, rgba(30,74,130,0.45), rgba(30,74,130,0.15))'
            : isRunning
            ? 'rgba(180,83,9,0.45)'
            : '#EDF2F9',
          transition: 'background 0.5s ease',
        }}
      />
    </div>
  )
}

function StageCard({ step, status, titleExtra, children }: {
  step: number
  status: StageStatus
  titleExtra?: React.ReactNode
  children?: React.ReactNode
}) {
  const T = useT()
  const meta = STAGE_META[step]
  const showContent = status !== 'idle'
  const isRunning = status === 'loading'

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-300${isRunning ? ' stage-card-running' : ''}`}
      style={{
        background: '#FFFFFF',
        border: isRunning
          ? '1.5px solid rgba(180,83,9,0.35)'
          : status === 'done'
          ? '1px solid rgba(4,120,87,0.2)'
          : '1px solid #D5E0EF',
        boxShadow: isRunning ? undefined : '0 1px 4px rgba(15,30,53,0.04)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-start justify-between px-5 py-4"
        style={{
          borderBottom: showContent ? '1px solid #EDF2F9' : 'none',
        }}
      >
        <div className="flex items-start gap-4">
          <span
            className={`font-bold tabular-nums shrink-0${isRunning ? ' stage-num-running' : ''}`}
            style={{
              fontSize: 28,
              lineHeight: 1,
              color: isRunning ? 'rgba(180,83,9,0.55)' : status === 'done' ? 'rgba(4,120,87,0.28)' : 'rgba(168,189,216,0.4)',
              fontFamily: 'Georgia, serif',
              marginTop: 2,
            }}
          >
            {String(step).padStart(2, '0')}
          </span>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <h3
                className="font-bold text-base"
                style={{ color: '#0F1E35' }}
              >
                {T(meta.titleKey as Parameters<typeof T>[0])}
              </h3>
              {titleExtra}
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: '#6B8AAD', maxWidth: 400 }}
            >
              {T(meta.descKey as Parameters<typeof T>[0])}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Card content */}
      {showContent && children && (
        <div>{children}</div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Simulate() {
  const { simulationId } = useParams()
  const [searchParams] = useSearchParams()
  const { state, runSimulation, loadSimulation, reset } = useSimulation()
  const { config, hasKey, save } = useLLMConfig()
  const T = useT()
  const [configWarning, setConfigWarning] = useState(false)
  const [loadExample, setLoadExample] = useState(false)
  const [graphExpanded, setGraphExpanded] = useState(false)
  const [graphCollapsed, setGraphCollapsed] = useState(false)
  const [caseExpanded, setCaseExpanded] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!simulationId) {
      if (searchParams.get('example') === '1') {
        reset()
        setLoadExample(true)
        return
      }
      reset()
      return
    }
    loadSimulation(simulationId)
      .then((sim) => {
        if (sim?.projectName) setProjectName(sim.projectName)
        // 数据渲染后滚回顶部（用 rAF 确保 DOM 已更新）
        requestAnimationFrame(() => {
          if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0
        })
      })
      .catch(() => {})
  }, [loadSimulation, reset, simulationId, searchParams])

  const handleStart = async (caseInput: string, roundCount: number, fileContent?: string, fileName?: string, pName?: string) => {
    if (!hasKey) {
      setConfigWarning(true)
      setTimeout(() => setConfigWarning(false), 4000)
      return
    }
    setConfigWarning(false)
    if (pName) setProjectName(pName)
    await runSimulation(caseInput, roundCount, fileContent, fileName, pName)
  }

  const handleDownloadReport = () => {
    if (!state.report) return
    const md = generateReportMarkdown(state.report, projectName || undefined)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'LexSim'}_预测报告.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isRunning = Object.values(state.stageStatuses).some(s => s === 'loading')
  const hasResult = state.stageStatuses[4] === 'done'
  const simulationStarted = state.stage > 0 || state.stageStatuses[1] !== 'idle'

  const activeStageNum = ([4, 3, 2, 1] as SimulationStage[]).find(
    s => state.stageStatuses[s] === 'loading',
  ) ?? (hasResult ? 4 : state.stage || 0)
  const activeMeta = STAGE_META[activeStageNum]

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB' }}>
      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: '1px solid #D5E0EF',
          background: '#FFFFFF',
          padding: '8px 0',
        }}
      >
        <div
          className="px-4 sm:px-6 flex items-center justify-between"
          style={{ maxWidth: simulationStarted ? 'none' : '72rem', margin: '0 auto', position: 'relative' }}
        >
          <div className="flex items-center gap-3">
            {isRunning && <span className="live-dot" />}
            <Cpu size={12} style={{ color: isRunning ? '#B45309' : '#1E4A82', transition: 'color 0.4s' }} />
            <span className="label-micro" style={{ color: isRunning ? '#B45309' : '#1E4A82', fontSize: '9px', transition: 'color 0.4s' }}>
              CASE PREDICTION ENGINE
            </span>
            {simulationStarted && activeMeta && (
              <>
                <span style={{ color: '#D5E0EF' }}>·</span>
                <span className="label-micro" style={{ color: '#A8BDD8', fontSize: '9px' }}>
                  Step {activeStageNum}/4
                </span>
                <span className="text-xs font-semibold" style={{ color: '#374D6B' }}>
                  {T(activeMeta.titleKey as Parameters<typeof T>[0])}
                </span>
                <span
                  className="label-micro px-1.5 py-0.5 rounded"
                  style={{
                    fontSize: '9px',
                    color: isRunning ? '#B45309' : '#047857',
                    background: isRunning ? 'rgba(180,83,9,0.08)' : 'rgba(4,120,87,0.08)',
                    border: `1px solid ${isRunning ? 'rgba(180,83,9,0.2)' : 'rgba(4,120,87,0.2)'}`,
                  }}
                >
                  {isRunning ? 'Running' : 'Finished'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {hasResult && state.entities.length > 0 && (
              <button
                onClick={() => setChatOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: chatOpen ? '#FFFFFF' : '#1E4A82',
                  background: chatOpen ? '#1E4A82' : 'rgba(30,74,130,0.07)',
                  border: '1px solid rgba(30,74,130,0.18)',
                }}
              >
                <MessageCircle size={13} />
                {T('chat.title')}
              </button>
            )}
            {simulationStarted && !isRunning && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: '#1E4A82', background: 'rgba(30,74,130,0.07)', border: '1px solid rgba(30,74,130,0.18)' }}
              >
                <PlusCircle size={13} />
                {T('simulate.newSim')}
              </button>
            )}
            {!simulationStarted && <LLMConfigPanel config={config} hasKey={hasKey} onSave={save} />}
          </div>
        </div>
      </div>

      {/* ── Pre-simulation: full-width input form ──────────────────────── */}
      {!simulationStarted && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {configWarning && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm animate-fade-in mb-5"
              style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', color: '#B45309' }}
            >
              <AlertCircle size={15} />
              {T('simulate.configWarn')}
            </div>
          )}
          <CaseInputForm
            initialCaseInput={state.caseInput}
            initialRoundCount={state.roundCount}
            onStart={handleStart}
            onReset={reset}
            isRunning={isRunning}
            hasResult={hasResult}
            autoLoadExample={loadExample}
            onExampleLoaded={() => setLoadExample(false)}
          />
        </div>
      )}

      {/* ── Post-simulation: dual-panel MiroFish layout ────────────────── */}
      {simulationStarted && (
        <div
          className="dual-panel-grid"
          style={{
            display: 'flex',
            minHeight: 'calc(100vh - 54px)',
          }}
        >

          {/* ─── Left panel: Relationship Graph ─────────────────────────── */}
          <div
            className="graph-left-panel"
            style={{
              background: '#FAFCFF',
              borderRight: graphExpanded || graphCollapsed ? 'none' : '1px solid #E2E8F0',
              position: 'sticky',
              top: 54,
              height: 'calc(100vh - 54px)',
              overflow: 'hidden',
              width: graphCollapsed ? '0%' : graphExpanded ? '100%' : '50%',
              opacity: graphCollapsed ? 0 : 1,
              flexShrink: 0,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
            }}
          >
            {state.graph !== null && state.graph.nodes.length > 0 ? (
              <RelationshipGraphPanel
                graph={state.graph}
                expanded={graphExpanded}
                collapsed={graphCollapsed}
                onToggleExpand={() => { setGraphCollapsed(false); setGraphExpanded(v => !v) }}
                onToggleCollapse={() => { setGraphExpanded(false); setGraphCollapsed(v => !v) }}
              />
            ) : (
              <div
                className="relative flex flex-col h-full"
                style={{
                  backgroundImage: 'radial-gradient(circle, #D5E0EF 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              >
                <div className="absolute top-4 left-5">
                  <span className="text-sm font-semibold" style={{ color: '#0F1E35' }}>
                    {T('simulate.graphTitle')}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                  <Network size={48} style={{ color: '#D5E0EF' }} />
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: '#6B8AAD' }}>
                      {state.stageStatuses[2] === 'loading' ? T('simulate.buildingGraph') : T('simulate.graphPending')}
                    </p>
                    {state.stageStatuses[2] === 'loading' && (
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        <span className="text-xs" style={{ color: '#6B8AAD' }}>{T('simulate.buildingIndicator')}</span>
                      </div>
                    )}
                    {state.streamingText && state.stage === 2 && (
                      <div className="mt-3 mx-auto font-mono text-xs max-w-sm max-h-20 overflow-hidden" style={{ color: '#94A3B8' }}>
                        {state.streamingText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right panel: Stage pipeline ─────────────────────────────── */}
          <div
            ref={rightPanelRef}
            style={{
              background: '#F4F7FB',
              overflowY: graphExpanded ? 'hidden' : 'auto',
              overflowX: 'hidden',
              height: 'calc(100vh - 54px)',
              position: 'sticky',
              top: 54,
              width: graphCollapsed ? '100%' : graphExpanded ? '0%' : '50%',
              flexShrink: 0,
              opacity: graphExpanded ? 0 : 1,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
            }}
          >
            {/* Restore graph button (when collapsed) */}
            {graphCollapsed && state.graph && (
              <div className="px-5 pt-4 pb-1">
                <button
                  onClick={() => setGraphCollapsed(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[rgba(30,74,130,0.08)]"
                  style={{
                    color: '#1E4A82',
                    background: 'rgba(30,74,130,0.04)',
                    border: '1px solid rgba(30,74,130,0.15)',
                  }}
                >
                  <Network size={13} />
                  {T('simulate.showGraph')}
                </button>
              </div>
            )}

            {/* Alerts */}
            <div className="px-5 pt-5">
              {configWarning && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm animate-fade-in mb-4"
                  style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', color: '#B45309' }}
                >
                  <AlertCircle size={15} />
                  {T('simulate.configWarn')}
                </div>
              )}
              {state.error && (
                <div
                  className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm animate-fade-in mb-4"
                  style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626' }}
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">{T('simulate.simError')}</p>
                    <p style={{ fontSize: '12px', opacity: 0.8 }}>{state.error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Project name */}
            <div className="px-5 mb-2">
              <h2 className="text-base font-semibold" style={{ color: '#0F1E35' }}>
                {projectName || T('simulate.unnamed')}
              </h2>
            </div>

            {/* Input summary card */}
            <div className="px-5 mb-3">
              <div
                className="rounded-xl px-5 py-3"
                style={{ background: 'rgba(30,74,130,0.04)', border: '1px solid rgba(30,74,130,0.1)' }}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setCaseExpanded(v => !v)}
                >
                  <FileText size={14} style={{ color: '#1E4A82', flexShrink: 0 }} />
                  <p className="text-xs flex-1 truncate" style={{ color: '#374D6B' }}>
                    {state.caseSummary
                      ? state.caseSummary.slice(0, 120) + (state.caseSummary.length > 120 ? '...' : '')
                      : state.caseInput
                        ? state.caseInput.slice(0, 120) + (state.caseInput.length > 120 ? '...' : '')
                        : T('simulate.caseSubmitted')}
                  </p>
                  <ChevronDown
                    size={14}
                    style={{
                      color: '#1E4A82',
                      flexShrink: 0,
                      transform: caseExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </div>
                {caseExpanded && (state.caseSummary || state.caseInput) && (
                  <div
                    className="mt-3 pt-3 text-xs leading-relaxed whitespace-pre-wrap"
                    style={{
                      color: '#374D6B',
                      borderTop: '1px solid rgba(30,74,130,0.1)',
                      maxHeight: 280,
                      overflowY: 'auto',
                    }}
                  >
                    {(state.caseSummary || state.caseInput || '').replace(/^\*{0,2}案件结构化摘要[^*\n]*\*{0,2}\s*\n*/i, '')}
                  </div>
                )}
              </div>
            </div>

            {/* Stage cards */}
            <div className="px-5 pb-6">
              {/* Stage 01 — Entity Ontology */}
              <StageCard step={1} status={state.stageStatuses[1]}>
                <EntityOntologyPanel
                  entities={state.entities}
                  status={state.stageStatuses[1]}
                  streamingText={state.stage === 1 ? state.streamingText : ''}
                />
              </StageCard>

              <StageConnector fromStatus={state.stageStatuses[1]} />

              {/* Stage 02 — Relationship Graph (stats only, graph is in left panel) */}
              <StageCard step={2} status={state.stageStatuses[2]}>
                {state.stageStatuses[2] === 'loading' && !state.graph && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6B8AAD' }}>
                      <span className="spinner" />
                      {T('simulate.buildingGraph')}
                    </div>
                  </div>
                )}
                {state.graph && (
                  <div
                    className="grid grid-cols-3 gap-px"
                    style={{ background: '#EDF2F9', borderTop: '1px solid #EDF2F9' }}
                  >
                    <div style={{ background: '#FFFFFF', padding: '14px 20px', textAlign: 'center' }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: '#0F1E35' }}>{state.graph.nodes.length}</p>
                      <p className="label-micro mt-1" style={{ color: '#A8BDD8', fontSize: '8px' }}>{T('simulate.graph.nodes')}</p>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '14px 20px', textAlign: 'center' }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: '#0F1E35' }}>{state.graph.edges.length}</p>
                      <p className="label-micro mt-1" style={{ color: '#A8BDD8', fontSize: '8px' }}>{T('simulate.graph.edges')}</p>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '14px 20px', textAlign: 'center' }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: '#0F1E35' }}>
                        {new Set(state.graph.edges.map(e => e.type)).size}
                      </p>
                      <p className="label-micro mt-1" style={{ color: '#A8BDD8', fontSize: '8px' }}>{T('simulate.graph.types')}</p>
                    </div>
                  </div>
                )}
              </StageCard>

              <StageConnector fromStatus={state.stageStatuses[2]} />

              {/* Stage 03 — Gameplay */}
              <StageCard step={3} status={state.stageStatuses[3]}>
                <GameplayTimelinePanel
                  timeline={state.timeline}
                  entities={state.entities}
                  status={state.stageStatuses[3]}
                  currentPhase={state.currentPhase}
                  activeDirectives={state.activeDirectives}
                  totalRounds={state.roundCount}
                />
              </StageCard>

              <StageConnector fromStatus={state.stageStatuses[3]} />

              {/* Stage 04 — Prediction Report */}
              <StageCard
                step={4}
                status={state.stageStatuses[4]}
                titleExtra={state.report ? (
                  <button
                    onClick={handleDownloadReport}
                    className="p-1 rounded transition-colors hover:bg-[rgba(30,74,130,0.08)]"
                    title={T('simulate.downloadTitle')}
                    style={{ color: '#6B8AAD' }}
                  >
                    <Download size={15} />
                  </button>
                ) : undefined}
              >
                <PredictionReportPanel
                  report={state.report}
                  status={state.stageStatuses[4]}
                  streamingText={state.stage === 4 ? state.streamingText : ''}
                />
              </StageCard>

            </div>
          </div>
        </div>
      )}

      {/* ── Agent Chat Drawer ─────────────────────────────────────────────── */}
      {chatOpen && state.simulationId && state.entities.length > 0 && (
        <div
          className="animate-slide-in-right"
          style={{
            position: 'fixed', right: 0, top: 102, zIndex: 50,
            width: '50%', maxWidth: 600,
            boxShadow: '-4px 4px 24px rgba(15,30,53,0.12)',
            borderRadius: '12px 0 0 12px',
            overflow: 'hidden',
          }}
        >
          <AgentChat
            simulationId={state.simulationId}
            entities={state.entities}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
