import { Shield, Scale, Users, Megaphone, Building2, BookOpen, Globe, X, Target, Swords, Brain, TrendingUp } from 'lucide-react'
import type { LegalEntity, EntityRole, StageStatus } from '@shared/types'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useT } from '../../hooks/useT'
import type { TranslationKey } from '../../i18n/translations'

// ─── Role config (no text — resolved via T()) ────────────────────────────────

const ROLE_META: Record<EntityRole, { labelKey: TranslationKey; color: string; bg: string; icon: ReactNode }> = {
  PLAINTIFF:          { labelKey: 'role.PLAINTIFF',          color: '#60A5FA', bg: 'rgba(59,130,246,0.1)',  icon: <Scale size={12} /> },
  DEFENDANT:          { labelKey: 'role.DEFENDANT',          color: '#F87171', bg: 'rgba(239,68,68,0.1)',   icon: <Scale size={12} /> },
  PLAINTIFF_LAWYER:   { labelKey: 'role.PLAINTIFF_LAWYER',   color: '#A78BFA', bg: 'rgba(139,92,246,0.1)',  icon: <Shield size={12} /> },
  DEFENDANT_LAWYER:   { labelKey: 'role.DEFENDANT_LAWYER',   color: '#FB7185', bg: 'rgba(244,63,94,0.1)',   icon: <Shield size={12} /> },
  JUDGE:              { labelKey: 'role.JUDGE',              color: '#FBBF24', bg: 'rgba(245,158,11,0.1)',  icon: <Scale size={12} /> },
  WITNESS:            { labelKey: 'role.WITNESS',            color: '#94A3B8', bg: 'rgba(100,116,139,0.1)', icon: <Users size={12} /> },
  PUBLIC_STAKEHOLDER: { labelKey: 'role.PUBLIC_STAKEHOLDER', color: '#D97706', bg: 'rgba(217,119,6,0.1)',   icon: <Users size={12} /> },
  ONLINE_INFLUENCER:  { labelKey: 'role.ONLINE_INFLUENCER',  color: '#EC4899', bg: 'rgba(236,72,153,0.1)',  icon: <Megaphone size={12} /> },
  LEGISLATOR:         { labelKey: 'role.LEGISLATOR',         color: '#22D3EE', bg: 'rgba(6,182,212,0.1)',   icon: <Building2 size={12} /> },
  GOVERNMENT_AGENCY:  { labelKey: 'role.GOVERNMENT_AGENCY',  color: '#4ADE80', bg: 'rgba(34,197,94,0.1)',   icon: <Building2 size={12} /> },
  MEDIA_OUTLET:       { labelKey: 'role.MEDIA_OUTLET',       color: '#FB923C', bg: 'rgba(249,115,22,0.1)',  icon: <Globe size={12} /> },
  EXPERT_COMMENTATOR: { labelKey: 'role.EXPERT_COMMENTATOR', color: '#818CF8', bg: 'rgba(99,102,241,0.1)',  icon: <BookOpen size={12} /> },
  ADVOCACY_GROUP:     { labelKey: 'role.ADVOCACY_GROUP',     color: '#2DD4BF', bg: 'rgba(20,184,166,0.1)',  icon: <Users size={12} /> },
}

const FOLLOWER_SCALE_KEY: Record<string, TranslationKey> = {
  INDIVIDUAL: 'scale.INDIVIDUAL',
  SMALL:      'scale.SMALL',
  MEDIUM:     'scale.MEDIUM',
  LARGE:      'scale.LARGE',
  MASSIVE:    'scale.MASSIVE',
}

interface Props {
  entities: LegalEntity[]
  status: StageStatus
  streamingText: string
}

export default function EntityOntologyPanel({ entities, status, streamingText }: Props) {
  const T = useT()
  const court = entities.filter(e => e.category === 'COURT')
  const social = entities.filter(e => e.category === 'SOCIAL')
  const [selected, setSelected] = useState<LegalEntity | null>(null)

  return (
    <div>
      {status === 'loading' && entities.length === 0 && (
        <div className="px-5 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-32 overflow-hidden" style={{ color: '#6B8AAD' }}>
          {streamingText || T('entity.analyzing')}
        </div>
      )}

      {entities.length > 0 && (
        <div className="px-5 py-4 space-y-5">
          {court.length > 0 && (
            <section>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#374D6B' }}>
                <span>{T('entity.court')}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#EDF2F9', color: '#6B8AAD' }}>{court.length}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {court.map(e => <EntityCard key={e.id} entity={e} onClick={() => setSelected(e)} />)}
              </div>
            </section>
          )}
          {social.length > 0 && (
            <section>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#374D6B' }}>
                <span>{T('entity.social')}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#EDF2F9', color: '#6B8AAD' }}>{social.length}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {social.map(e => <EntityCard key={e.id} entity={e} onClick={() => setSelected(e)} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Agent Detail Modal ──────────────────────────────────────────── */}
      {selected && (
        <AgentDetailModal entity={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function EntityCard({ entity, onClick }: { entity: LegalEntity; onClick: () => void }) {
  const T = useT()
  const cfg = ROLE_META[entity.role] ?? null
  const color  = cfg?.color  ?? '#94A3B8'
  const bg     = cfg?.bg     ?? 'rgba(100,116,139,0.1)'
  const icon   = cfg?.icon   ?? null
  const label  = cfg ? T(cfg.labelKey) : entity.role

  return (
    <div
      className="border rounded-lg p-4 hover:border-[#C0D0E6] transition-colors cursor-pointer"
      style={{ borderColor: '#D5E0EF', background: '#FAFCFF' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2.5 gap-2">
        <h3 className="font-semibold text-sm leading-tight" style={{ color: '#0F1E35' }}>{entity.name}</h3>
        <span
          className="label-micro px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
          style={{ color, background: bg }}
        >
          {icon}
          {label}
        </span>
      </div>

      <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: '#6B8AAD' }}>{entity.position}</p>

      {entity.category === 'SOCIAL' && entity.caseInfluence !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontSize: 10, color: '#6B8AAD', fontWeight: 600, letterSpacing: '0.04em' }}>{T('entity.influence')}</span>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{entity.caseInfluence}%</span>
          </div>
          <div style={{ height: 4, background: '#EDF2F9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#8B5CF6', width: `${entity.caseInfluence}%` }} />
          </div>
        </div>
      )}

      <p className="text-[11px] italic leading-relaxed line-clamp-2" style={{ color: '#94A3B8' }}>{entity.agentPersona}</p>
    </div>
  )
}

// ─── Agent Detail Modal ───────────────────────────────────────────────────────

function AgentDetailModal({ entity, onClose }: { entity: LegalEntity; onClose: () => void }) {
  const T = useT()
  const cfg = ROLE_META[entity.role] ?? null
  const color  = cfg?.color  ?? '#94A3B8'
  const bg     = cfg?.bg     ?? 'rgba(100,116,139,0.1)'
  const icon   = cfg?.icon   ?? null
  const label  = cfg ? T(cfg.labelKey) : entity.role

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,30,53,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(15,30,53,0.2)',
          border: '1px solid #D5E0EF',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #EDF2F9',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span
                className="label-micro px-2 py-0.5 rounded flex items-center gap-1"
                style={{ color, background: bg, fontSize: '10px' }}
              >
                {icon}{label}
              </span>
              {entity.category === 'SOCIAL' && entity.followerScale && (
                <span className="label-micro px-2 py-0.5 rounded" style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.08)', fontSize: '10px' }}>
                  {T(FOLLOWER_SCALE_KEY[entity.followerScale] ?? 'scale.INDIVIDUAL')}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F1E35', lineHeight: 1.3 }}>{entity.name}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              border: '1px solid #D5E0EF', background: '#F4F7FB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#6B8AAD',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Agent Persona */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Brain size={13} style={{ color: '#1E4A82' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#A8BDD8', textTransform: 'uppercase' }}>{T('entity.modal.persona')}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374D6B' }}>
              {entity.agentPersona}
            </p>
          </section>

          {/* Position */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Scale size={13} style={{ color: '#1E4A82' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#A8BDD8', textTransform: 'uppercase' }}>{T('entity.modal.position')}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374D6B' }}>
              {entity.position}
            </p>
          </section>

          {/* Interests */}
          {entity.interests && entity.interests.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Target size={13} style={{ color: '#1E4A82' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#A8BDD8', textTransform: 'uppercase' }}>{T('entity.modal.interests')}</span>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entity.interests.map((interest, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: 4,
                      background: 'rgba(30,74,130,0.08)', color: '#1E4A82',
                      fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.7, color: '#374D6B' }}>{interest}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Strategy */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Swords size={13} style={{ color: '#1E4A82' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#A8BDD8', textTransform: 'uppercase' }}>{T('entity.modal.strategy')}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374D6B' }}>
              {entity.strategy}
            </p>
          </section>

          {/* Case influence (social entities only) */}
          {entity.category === 'SOCIAL' && entity.caseInfluence !== undefined && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={13} style={{ color: '#1E4A82' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#A8BDD8', textTransform: 'uppercase' }}>{T('entity.modal.influence')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 6, background: '#EDF2F9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: '#8B5CF6', width: `${entity.caseInfluence}%`, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6', flexShrink: 0 }}>{entity.caseInfluence}%</span>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
