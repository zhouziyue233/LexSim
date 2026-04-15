import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { LegalEntity, RelationshipGraph, EntityRole, RelationType } from '@shared/types'
import { useT } from '../../hooks/useT'
import type { TranslationKey } from '../../i18n/translations'

// ─── Visual Config (MiroFish light palette) ─────────────────────────────────

const NODE_COLORS: Record<EntityRole, string> = {
  PLAINTIFF:          '#3B82F6',
  DEFENDANT:          '#EF4444',
  PLAINTIFF_LAWYER:   '#8B5CF6',
  DEFENDANT_LAWYER:   '#E11D48',
  JUDGE:              '#16A34A',
  WITNESS:            '#6B7280',
  PUBLIC_STAKEHOLDER: '#B45309',
  ONLINE_INFLUENCER:  '#EC4899',
  LEGISLATOR:         '#0891B2',
  GOVERNMENT_AGENCY:  '#7C3AED',
  MEDIA_OUTLET:       '#EA580C',
  EXPERT_COMMENTATOR: '#6366F1',
  ADVOCACY_GROUP:     '#0D9488',
}

/** Compute node radius (6–18) based on influence */
const ROLE_BASE_INFLUENCE: Partial<Record<EntityRole, number>> = {
  JUDGE: 90,
  PLAINTIFF: 75,
  DEFENDANT: 75,
  PLAINTIFF_LAWYER: 65,
  DEFENDANT_LAWYER: 65,
  WITNESS: 40,
}

function getNodeRadius(node: { role: EntityRole; category: 'COURT' | 'SOCIAL'; caseInfluence?: number }): number {
  const influence = node.category === 'COURT'
    ? (ROLE_BASE_INFLUENCE[node.role] ?? 50)
    : (node.caseInfluence ?? 30)
  // Map 0-100 influence → 6-18 radius
  return 6 + (Math.max(0, Math.min(100, influence)) / 100) * 12
}

const EDGE_COLOR = '#CBD5E1'
const EDGE_LABEL_COLOR = '#94A3B8'

const DOT_GRID_BG = `radial-gradient(circle, #D5E0EF 1px, transparent 1px)`

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  role: EntityRole
  category: 'COURT' | 'SOCIAL'
  caseInfluence?: number
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string
  type: RelationType
  label: string
  strength: number
  adversarial: boolean
}

interface TooltipState {
  x: number
  y: number
  entity: LegalEntity
}

interface Props {
  graph: RelationshipGraph
  expanded?: boolean
  collapsed?: boolean
  onToggleExpand?: () => void
  onToggleCollapse?: () => void
}

export default function RelationshipGraphPanel({ graph, expanded, collapsed, onToggleExpand, onToggleCollapse }: Props) {
  const T = useT()
  const roleLabel = (role: EntityRole) => T(`role.${role}` as TranslationKey)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 })
  const [showEdgeLabels, setShowEdgeLabels] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }
  }, [])

  useEffect(() => {
    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [updateDimensions])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graph.nodes.length === 0) return

    const { width, height } = dimensions

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const defs = svg.append('defs')
    // Create arrow markers for different node sizes
    const markerSizes = [6, 8, 10, 12, 14, 16, 18]
    for (const size of markerSizes) {
      defs.append('marker')
        .attr('id', `arrow-r${size}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', size + 10)
        .attr('refY', 0)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', EDGE_COLOR)
        .attr('opacity', 0.5)
    }

    const nodes: SimNode[] = graph.nodes.map(n => ({
      id: n.id, name: n.name, role: n.role, category: n.category,
      caseInfluence: n.caseInfluence,
    }))

    // Build a quick lookup for node radius by id
    const nodeRadiusMap = new Map(nodes.map(n => [n.id, Math.round(getNodeRadius(n))]))

    const links: SimLink[] = graph.edges.map(e => ({
      id: e.id, source: e.source, target: e.target,
      type: e.type, label: e.label, strength: e.strength, adversarial: e.adversarial,
    }))

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(140)
        .strength(d => d.strength * 0.4 + 0.08)
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX<SimNode>(width / 2).strength(d => d.category === 'COURT' ? 0.1 : 0.03))
      .force('y', d3.forceY<SimNode>(height / 2).strength(d => d.category === 'COURT' ? 0.1 : 0.03))
      .force('collision', d3.forceCollide<SimNode>(d => getNodeRadius(d) + 24))

    simulationRef.current = simulation

    const g = svg.append('g')

    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', ({ transform }) => g.attr('transform', transform))
    )

    const link = g.append('g').selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#D1D5DB')
      .attr('stroke-width', d => 0.5 + d.strength * 1)
      .attr('stroke-opacity', 0.8)
      .attr('marker-end', d => {
        const targetId = typeof d.target === 'string' ? d.target : (d.target as SimNode).id
        const r = nodeRadiusMap.get(targetId) ?? 8
        // Snap to nearest available marker size
        const snapped = markerSizes.reduce((prev, curr) => Math.abs(curr - r) < Math.abs(prev - r) ? curr : prev)
        return `url(#arrow-r${snapped})`
      })
      .style('transition', 'stroke 0.6s, stroke-width 0.6s')

    const edgeLabel = g.append('g')
      .attr('class', 'edge-labels')
      .style('display', showEdgeLabels ? 'block' : 'none')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(links)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', EDGE_LABEL_COLOR)
      .attr('pointer-events', 'none')
      .text(d => d.label)

    const nodeGroup = g.append('g').selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')

    nodeGroup.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => NODE_COLORS[d.role] ?? '#6B7280')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)

    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d) + 14)
      .attr('font-size', 10)
      .attr('font-weight', '500')
      .attr('fill', '#374D6B')
      .attr('pointer-events', 'none')
      .text(d => d.name.length > 7 ? d.name.slice(0, 6) + '…' : d.name)

    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      })
    nodeGroup.call(drag)

    const container = containerRef.current
    nodeGroup
      .on('mouseenter', (event, d) => {
        const entity = graph.nodes.find(n => n.id === d.id)
        if (entity && container) {
          const rect = container.getBoundingClientRect()
          setTooltip({ x: event.clientX - rect.left + 12, y: event.clientY - rect.top - 8, entity })
        }
      })
      .on('mouseleave', () => setTooltip(null))

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0)

      edgeLabel
        .attr('x', d => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr('y', d => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2)

      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [graph, dimensions, showEdgeLabels, refreshKey])

  const presentRoles = new Set(graph.nodes.map(n => n.role))

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background: `#FAFCFF`,
        backgroundImage: DOT_GRID_BG,
        backgroundSize: '24px 24px',
      }}
    >
      <svg ref={svgRef} className="w-full h-full" />

      {/* ── Title (top-left, floating on canvas) ───────────────────── */}
      <div className="absolute top-4 left-5">
        <span className="text-sm font-semibold" style={{ color: '#0F1E35' }}>
          Graph Relationship Visualization
        </span>
      </div>

      {/* ── Top-right controls ─────────────────────────────────────── */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            color: '#374D6B',
            border: '1px solid #D5E0EF',
            background: '#FFFFFF',
            boxShadow: '0 1px 4px rgba(15,30,53,0.06)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>

        {/* Expand / collapse button */}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{
              color: '#6B8AAD',
              border: '1px solid #D5E0EF',
              background: '#FFFFFF',
              boxShadow: '0 1px 4px rgba(15,30,53,0.06)',
            }}
            title={expanded ? T('graph.collapseTitle') : T('graph.expandTitle')}
          >
            {expanded ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        )}

        {/* Collapse button (hide graph, give full width to right panel) */}
        {onToggleCollapse && !expanded && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{
              color: '#6B8AAD',
              border: '1px solid #D5E0EF',
              background: '#FFFFFF',
              boxShadow: '0 1px 4px rgba(15,30,53,0.06)',
            }}
            title={T('graph.hideTitle')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Edge label toggle (below top-right controls) ───────────── */}
      <div className="absolute top-14 right-4">
        <button
          onClick={() => setShowEdgeLabels(!showEdgeLabels)}
          className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background: '#FFFFFF',
            border: '1px solid #D5E0EF',
            boxShadow: '0 1px 4px rgba(15,30,53,0.06)',
            color: '#374D6B',
          }}
        >
          <span
            className="relative flex items-center rounded-full transition-colors"
            style={{
              width: 36,
              height: 20,
              background: showEdgeLabels ? '#3B82F6' : '#CBD5E1',
              padding: 2,
            }}
          >
            <span
              className="block w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
              style={{ transform: showEdgeLabels ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </span>
          Show Edge Labels
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg p-3 shadow-lg max-w-xs"
          style={{
            left: tooltip.x, top: tooltip.y,
            background: '#FFFFFF',
            border: '1px solid #D5E0EF',
            boxShadow: '0 4px 16px rgba(15,30,53,0.1)',
          }}
        >
          <p className="font-semibold text-sm mb-1" style={{ color: '#0F1E35' }}>{tooltip.entity.name}</p>
          <p className="text-[10px] mb-1.5" style={{ color: '#6B8AAD' }}>{roleLabel(tooltip.entity.role)}</p>
          <p className="text-xs" style={{ color: '#374D6B' }}>{tooltip.entity.position}</p>
        </div>
      )}

      {/* Entity types legend (MiroFish-style, bottom-left, white card) */}
      <div
        className="absolute bottom-4 left-4 rounded-xl p-4"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(15,30,53,0.06)',
        }}
      >
        <p className="font-bold text-[10px] mb-2.5" style={{ color: '#EF4444', letterSpacing: '0.1em' }}>
          ENTITY TYPES
        </p>
        <div className="grid grid-cols-3 gap-x-5 gap-y-1.5">
          {(Object.entries(NODE_COLORS) as [EntityRole, string][])
            .filter(([role]) => presentRoles.has(role))
            .map(([role, color]) => (
              <div key={role} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span style={{ fontSize: 11, color: '#374D6B', whiteSpace: 'nowrap' }}>
                  {roleLabel(role)}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
