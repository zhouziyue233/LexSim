import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageCircle, Send, Trash2,
  Scale, Shield, Users, Megaphone, Building2, BookOpen, Globe,
} from 'lucide-react'
import type { LegalEntity, EntityRole, ChatMessage } from '@shared/types'
import { chatWithAgent } from '../../lib/api'
import { useT } from '../../hooks/useT'
import { useLanguage } from '../../contexts/LanguageContext'
import type { TranslationKey } from '../../i18n/translations'

// ─── Role config ──────────────────────────────────────────────────────────────

interface RoleMeta { labelKey: TranslationKey; color: string; bg: string; icon: React.ReactNode }

const ROLE_META: Record<EntityRole, RoleMeta> = {
  PLAINTIFF:          { labelKey: 'role.PLAINTIFF',          color: '#60A5FA', bg: 'rgba(59,130,246,0.12)',   icon: <Scale size={13} /> },
  DEFENDANT:          { labelKey: 'role.DEFENDANT',          color: '#F87171', bg: 'rgba(239,68,68,0.12)',    icon: <Scale size={13} /> },
  PLAINTIFF_LAWYER:   { labelKey: 'role.PLAINTIFF_LAWYER',   color: '#A78BFA', bg: 'rgba(139,92,246,0.12)',   icon: <Shield size={13} /> },
  DEFENDANT_LAWYER:   { labelKey: 'role.DEFENDANT_LAWYER',   color: '#FB7185', bg: 'rgba(244,63,94,0.12)',    icon: <Shield size={13} /> },
  JUDGE:              { labelKey: 'role.JUDGE',              color: '#FBBF24', bg: 'rgba(245,158,11,0.12)',   icon: <Scale size={13} /> },
  WITNESS:            { labelKey: 'role.WITNESS',            color: '#94A3B8', bg: 'rgba(100,116,139,0.12)',  icon: <Users size={13} /> },
  PUBLIC_STAKEHOLDER: { labelKey: 'role.PUBLIC_STAKEHOLDER', color: '#D97706', bg: 'rgba(217,119,6,0.12)',    icon: <Users size={13} /> },
  ONLINE_INFLUENCER:  { labelKey: 'role.ONLINE_INFLUENCER',  color: '#EC4899', bg: 'rgba(236,72,153,0.12)',   icon: <Megaphone size={13} /> },
  LEGISLATOR:         { labelKey: 'role.LEGISLATOR',         color: '#22D3EE', bg: 'rgba(6,182,212,0.12)',    icon: <Building2 size={13} /> },
  GOVERNMENT_AGENCY:  { labelKey: 'role.GOVERNMENT_AGENCY',  color: '#4ADE80', bg: 'rgba(34,197,94,0.12)',    icon: <Building2 size={13} /> },
  MEDIA_OUTLET:       { labelKey: 'role.MEDIA_OUTLET',       color: '#FB923C', bg: 'rgba(249,115,22,0.12)',   icon: <Globe size={13} /> },
  EXPERT_COMMENTATOR: { labelKey: 'role.EXPERT_COMMENTATOR', color: '#818CF8', bg: 'rgba(99,102,241,0.12)',   icon: <BookOpen size={13} /> },
  ADVOCACY_GROUP:     { labelKey: 'role.ADVOCACY_GROUP',     color: '#2DD4BF', bg: 'rgba(20,184,166,0.12)',   icon: <Users size={13} /> },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  simulationId: string
  entities: LegalEntity[]
  fullHeight?: boolean
  onClose?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentChat({ simulationId, entities, fullHeight, onClose }: Props) {
  const T = useT()
  const { lang } = useLanguage()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(180)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // ── Sidebar resize drag ─────────────────────────────────────────────────────
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: sidebarWidth }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      const next = Math.min(320, Math.max(160, dragRef.current.startWidth + delta))
      setSidebarWidth(next)
    }
    const onMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  const selectedEntity = entities.find(e => e.id === selectedId) ?? null
  const meta = selectedEntity ? ROLE_META[selectedEntity.role] : null

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectEntity = useCallback((id: string) => {
    if (id === selectedId) return
    cancelRef.current?.()
    setSelectedId(id)
    setMessages([])
    setDraft('')
    setStreaming(false)
  }, [selectedId])

  const handleSend = useCallback(() => {
    if (!selectedId || !draft.trim() || streaming) return

    const userMessage: ChatMessage = { role: 'user', content: draft.trim() }
    const nextMessages: ChatMessage[] = [...messages, userMessage]
    setMessages(nextMessages)
    setDraft('')
    setStreaming(true)

    // Placeholder for assistant reply
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    cancelRef.current = chatWithAgent(
      simulationId,
      selectedId,
      nextMessages,
      lang,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk }
          }
          return updated
        })
      },
      () => setStreaming(false),
      () => setStreaming(false),
    )
  }, [selectedId, draft, streaming, messages, simulationId, lang])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    cancelRef.current?.()
    setMessages([])
    setStreaming(false)
  }

  return (
    <div
      className={fullHeight ? '' : 'rounded-xl overflow-hidden'}
      style={{
        background: '#FFFFFF',
        border: fullHeight ? 'none' : '1px solid #D5E0EF',
        boxShadow: fullHeight ? 'none' : '0 1px 4px rgba(15,30,53,0.04)',
        ...(fullHeight ? { display: 'flex', flexDirection: 'column', height: '100%' } : {}),
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: '1px solid #E8EEF6', flexShrink: 0 }}
      >
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, background: 'rgba(30,74,130,0.08)' }}
        >
          <MessageCircle size={14} style={{ color: '#1E4A82' }} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1E293B', flex: 1 }}>
          {T('chat.title')}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94A3B8', fontSize: 16, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374D6B' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
            title="关闭"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex" style={{ ...(fullHeight ? { flex: 1, minHeight: 0 } : { height: 550 }), overflow: 'hidden' }}>
        {/* ── Entity selector (left column) ─────────────────────────────────── */}
        <div
          className="flex flex-col gap-1 overflow-y-auto shrink-0"
          style={{
            width: sidebarWidth,
            minWidth: 160,
            maxWidth: 320,
            padding: '12px 8px',
          }}
        >
          <p className="px-2 mb-2 text-[10px] font-semibold tracking-wider" style={{ color: '#94A3B8' }}>
            {T('chat.select').toUpperCase()}
          </p>
          {entities.map(entity => {
            const m = ROLE_META[entity.role]
            const isActive = entity.id === selectedId
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleSelectEntity(entity.id)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-all duration-150"
                style={{
                  background: isActive ? m.bg : 'transparent',
                  border: isActive ? `1px solid ${m.color}33` : '1px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = '#F4F7FB'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Role icon */}
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 28, height: 28, background: m.bg, color: m.color }}
                >
                  {m.icon}
                </div>
                {/* Name + role */}
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: isActive ? m.color : '#374D6B' }}
                  >
                    {entity.name}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>
                    {T(m.labelKey)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Drag divider ──────────────────────────────────────────────────── */}
        <div
          onMouseDown={handleDividerMouseDown}
          style={{
            width: 5,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            borderRight: '1px solid #E8EEF6',
            position: 'relative',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,74,130,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Drag to resize"
        >
        </div>

        {/* ── Chat area (right column) ───────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {!selectedEntity ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: '#94A3B8' }}>
              <MessageCircle size={32} style={{ opacity: 0.4 }} />
              <p className="text-sm text-center px-6" style={{ color: '#94A3B8', maxWidth: 240 }}>
                {T('chat.selectHint')}
              </p>
            </div>
          ) : (
            <>
              {/* Agent header */}
              <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ borderBottom: '1px solid #F1F5F9' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 34, height: 34, background: meta!.bg, color: meta!.color }}
                  >
                    {meta!.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                      {selectedEntity.name}
                    </p>
                    <p className="text-xs" style={{ color: meta!.color }}>
                      {T(meta!.labelKey)}
                    </p>
                  </div>
                </div>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                    style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#64748B')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                    title={T('chat.clearHistory')}
                  >
                    <Trash2 size={12} />
                    <span>{T('chat.clearHistory')}</span>
                  </button>
                )}
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                style={{ minHeight: 0 }}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: '#94A3B8' }}>{T('chat.noHistory')}</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div
                          className="flex items-center justify-center rounded-full mr-2 shrink-0 self-end"
                          style={{ width: 26, height: 26, background: meta!.bg, color: meta!.color }}
                        >
                          {meta!.icon}
                        </div>
                      )}
                      <div
                        className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                        style={{
                          maxWidth: '75%',
                          background: msg.role === 'user'
                            ? 'rgba(30,74,130,0.08)'
                            : '#F8FAFC',
                          color: '#1E293B',
                          border: msg.role === 'user'
                            ? '1px solid rgba(30,74,130,0.15)'
                            : '1px solid #E8EEF6',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content || (
                          streaming && i === messages.length - 1
                            ? <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>{T('chat.thinking')}</span>
                            : null
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div
                          className="flex items-center justify-center rounded-full ml-2 shrink-0 self-end text-xs font-semibold"
                          style={{ width: 26, height: 26, background: 'rgba(30,74,130,0.1)', color: '#1E4A82' }}
                        >
                          {T('chat.you')[0]}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div
                className="px-4 py-3 shrink-0"
                style={{ borderTop: '1px solid #F1F5F9' }}
              >
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: '#F4F7FB', border: '1px solid #D5E0EF' }}
                >
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={T('chat.placeholder')}
                    disabled={streaming}
                    className="flex-1 resize-none bg-transparent text-sm outline-none"
                    style={{
                      color: '#1E293B',
                      lineHeight: 1.5,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || streaming}
                    className="flex items-center justify-center rounded-lg shrink-0 transition-all duration-150"
                    style={{
                      width: 32,
                      height: 32,
                      background: draft.trim() && !streaming ? '#1E4A82' : '#CBD5E1',
                      border: 'none',
                      cursor: draft.trim() && !streaming ? 'pointer' : 'not-allowed',
                      color: '#FFFFFF',
                    }}
                    onMouseEnter={e => {
                      if (draft.trim() && !streaming) e.currentTarget.style.background = '#163A68'
                    }}
                    onMouseLeave={e => {
                      if (draft.trim() && !streaming) e.currentTarget.style.background = '#1E4A82'
                    }}
                    title={T('chat.send')}
                  >
                    <Send size={14} />
                  </button>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#94A3B8' }}>
                  Enter {lang === 'zh' ? '发送' : 'to send'}，Shift+Enter {lang === 'zh' ? '换行' : 'for new line'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
