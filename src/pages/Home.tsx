import { Fragment, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Users, BarChart3, Globe,
  Sparkles, Network, FileText, Brain, ChevronRight,
} from 'lucide-react'
import { listSimulations } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { useT } from '../hooks/useT'

const EXAMPLE_PROJECT_NAME = '87名专才子女挑战香港教育局本地学生入学资格政策'

// Pre-run demo simulation IDs (legalsim.db) — direct replay links
const DEMO_SIM_IDS: Record<string, string> = {
  zh: '6fcd440e-b0dd-4e8f-88ff-ff6b5593dd9c',
  en: '48d97bda-a7b5-441a-a6a8-43b7e1d69e14',
}

// ─── Feature card metadata (no text — resolved via T()) ──────────────────────
const FEATURE_META = [
  {
    icon: <Users size={17} style={{ color: '#1E4A82' }} />,
    accent: '#1E4A82',
    accentRgb: '30,74,130',
    color: 'rgba(30,74,130,0.07)',
    borderColor: 'rgba(30,74,130,0.22)',
    titleKey: 'feature.0.title',
    descKey:  'feature.0.desc',
  },
  {
    icon: <Globe size={17} style={{ color: '#BE185D' }} />,
    accent: '#BE185D',
    accentRgb: '190,24,93',
    color: 'rgba(190,24,93,0.06)',
    borderColor: 'rgba(190,24,93,0.18)',
    titleKey: 'feature.1.title',
    descKey:  'feature.1.desc',
  },
  {
    icon: <Brain size={17} style={{ color: '#0369A1' }} />,
    accent: '#0369A1',
    accentRgb: '3,105,161',
    color: 'rgba(3,105,161,0.07)',
    borderColor: 'rgba(3,105,161,0.2)',
    titleKey: 'feature.2.title',
    descKey:  'feature.2.desc',
  },
  {
    icon: <BarChart3 size={17} style={{ color: '#047857' }} />,
    accent: '#047857',
    accentRgb: '4,120,87',
    color: 'rgba(4,120,87,0.06)',
    borderColor: 'rgba(4,120,87,0.18)',
    titleKey: 'feature.3.title',
    descKey:  'feature.3.desc',
  },
] as const

// ─── Workflow step icons ──────────────────────────────────────────────────────
const WORKFLOW_ICONS = [
  <FileText size={18} strokeWidth={1.75} />,
  <Users size={18} strokeWidth={1.75} />,
  <Network size={18} strokeWidth={1.75} />,
  <Brain size={18} strokeWidth={1.75} />,
  <BarChart3 size={18} strokeWidth={1.75} />,
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const T = useT()
  const [activeStep, setActiveStep] = useState<number | null>(null)

  async function handleExampleClick() {
    // Navigate directly to the pre-run demo simulation for the current language
    const demoId = DEMO_SIM_IDS[lang]
    if (demoId) {
      navigate(`/simulate/${demoId}`)
      return
    }
    // Fallback: search DB by name, then fall back to example form
    const targetName = lang === 'en' ? 'SFFA vs Harvard' : EXAMPLE_PROJECT_NAME
    try {
      const sims = await listSimulations()
      const target = sims.find(s => s.projectName === targetName)
      navigate(target ? `/simulate/${target.id}` : '/simulate?example=1')
    } catch {
      navigate('/simulate?example=1')
    }
  }

  // Scroll-triggered reveal animations
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed')
          obs.unobserve(e.target)
        }
      }),
      { threshold: 0.12 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const WORKFLOW = [
    { step: '01', labelKey: 'workflow.0.label', descKey: 'workflow.0.desc', icon: WORKFLOW_ICONS[0] },
    { step: '02', labelKey: 'workflow.1.label', descKey: 'workflow.1.desc', icon: WORKFLOW_ICONS[1] },
    { step: '03', labelKey: 'workflow.2.label', descKey: 'workflow.2.desc', icon: WORKFLOW_ICONS[2] },
    { step: '04', labelKey: 'workflow.3.label', descKey: 'workflow.3.desc', icon: WORKFLOW_ICONS[3] },
    { step: '05', labelKey: 'workflow.4.label', descKey: 'workflow.4.desc', icon: WORKFLOW_ICONS[4] },
  ] as const

  return (
    <div style={{ background: '#F4F7FB', minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          paddingTop: 80,
          paddingBottom: 88,
          background: '#FFFFFF',
          borderBottom: '1px solid #D5E0EF',
        }}
      >
        {/* Subtle dot-grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #C8D8EA 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.45,
          }}
        />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 animate-fade-up"
            style={{
              background: 'rgba(30,74,130,0.07)',
              border: '1px solid rgba(30,74,130,0.18)',
            }}
          >
            <Sparkles size={11} style={{ color: '#1E4A82' }} />
            <span className="label-micro" style={{ color: 'var(--color-ink)', fontSize: '12px' }}>
              {T('home.badge')}
            </span>
          </div>

          {/* Logo + brand */}
          <div className="flex items-center justify-center gap-4 mb-5 animate-fade-up delay-100">
            <img src="/logo.svg" alt="LexSim" style={{ height: 'fit-content', width: '85px' }} />
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: '60px', color: 'rgba(15, 30, 53, 1)', letterSpacing: '-0.01em' }}>
              LexSim
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up delay-200"
            style={{
              fontFamily: lang === 'zh' ? 'Noto Serif SC, Georgia, serif' : 'Georgia, serif',
              fontWeight: 900,
              fontSize: 'clamp(2.0rem, 4.5vw, 4rem)',
              lineHeight: 1.2,
              color: '#0F1E35',
              marginBottom: '1.25rem',
            }}
          >
            {T('home.headline.prefix')}{lang === 'en' && <br />}<span className="gradient-text-animate">{T('home.headline.gradient')}</span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-up delay-300"
            style={{
              color: '#6B8AAD',
              fontSize: '1rem',
              lineHeight: 1.75,
              maxWidth: 520,
              margin: '0 auto 2.25rem',
            }}
          >
            {T('home.subtitle')}
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 animate-fade-up delay-400">
            <Link
              to="/simulate"
              className="btn-primary gap-2"
              style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 13, paddingBottom: 13, fontSize: '0.9375rem' }}
            >
              {T('home.cta.simulate')}
              <ArrowRight size={16} />
            </Link>
            <button
              onClick={handleExampleClick}
              className="btn-outline"
              style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 13, paddingBottom: 13, fontSize: '0.9375rem' }}
            >
              {T('home.cta.example')}
            </button>
          </div>

          {/* Holmes quote */}
          <p
            className="animate-fade-up delay-400"
            style={{
              marginTop: '3.5rem',
              fontStyle: 'italic',
              fontWeight: 500,
              fontFamily: lang === 'zh' ? 'Noto Serif SC, Georgia, serif' : 'Georgia, serif',
              fontSize: lang === 'zh' ? '1.2rem' : '1.0rem',
              color: '#5A6675',
              letterSpacing: '0.01em',
            }}
          >
            {T('home.quote')}
          </p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_META.map((f, i) => (
            <div
              key={i}
              className="feat-card reveal rounded-xl p-5 transition-all duration-300 cursor-default"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D5E0EF',
                boxShadow: '0 1px 2px rgba(15,30,53,0.04), 0 8px 24px rgba(15,30,53,0.04)',
                '--reveal-delay': `${i * 0.1}s`,
                '--accent': f.accent,
              } as React.CSSProperties}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = f.borderColor
                el.style.boxShadow = `0 2px 4px rgba(15,30,53,0.04), 0 14px 36px rgba(${f.accentRgb},0.18)`
                el.style.transform = 'translateY(-6px) scale(1.015)'
                const title = el.querySelector('h3') as HTMLElement | null
                if (title) title.style.color = f.accent
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = '#D5E0EF'
                el.style.boxShadow = '0 1px 2px rgba(15,30,53,0.04), 0 8px 24px rgba(15,30,53,0.04)'
                el.style.transform = 'translateY(0) scale(1)'
                const title = el.querySelector('h3') as HTMLElement | null
                if (title) title.style.color = '#0F1E35'
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: `linear-gradient(135deg, rgba(${f.accentRgb},0.13), rgba(${f.accentRgb},0.04))`,
                  border: `1px solid ${f.borderColor}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px rgba(${f.accentRgb},0.10)`,
                }}
              >
                {f.icon}
              </div>
              <h3
                className="font-semibold text-sm mb-2 transition-colors duration-200"
                style={{ color: '#0F1E35' }}
              >
                {T(f.titleKey)}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: '#6B8AAD' }}>{T(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="glow-divider" />

      {/* ── Workflow ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div
          className="reveal rounded-xl p-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFCFF 100%)',
            border: '1px solid #D5E0EF',
            boxShadow: '0 1px 2px rgba(15,30,53,0.04), 0 12px 36px rgba(15,30,53,0.05)',
            '--reveal-delay': '0.05s',
          } as React.CSSProperties}
        >
          {/* Watermark icon, bottom-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              right: -30,
              bottom: -30,
              opacity: 0.05,
              color: '#1E4A82',
            }}
          >
            <Brain size={220} />
          </div>

          {/* Step nodes row */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-0 mb-0 relative">
            {WORKFLOW.map((s, i) => {
              const isActive = activeStep === i
              return (
                <Fragment key={i}>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-2 relative z-10 flex-1"
                    style={{ background: 'none', border: 'none', cursor: 'default', padding: 0 }}
                    onMouseEnter={() => setActiveStep(i)}
                    onMouseLeave={() => setActiveStep(null)}
                  >
                    {/* Node wrapper (for ring + halo) */}
                    <div
                      className={`relative ${isActive ? 'node-ring-active' : ''}`}
                      style={{ width: 48, height: 48 }}
                    >
                      {/* Ground halo */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute"
                        style={{
                          left: '50%',
                          bottom: -8,
                          transform: 'translateX(-50%)',
                          width: 60,
                          height: 14,
                          background: 'radial-gradient(ellipse at center, rgba(30,74,130,0.18), transparent 70%)',
                          opacity: isActive ? 1 : 0.5,
                          transition: 'opacity 0.2s ease',
                          filter: 'blur(2px)',
                        }}
                      />
                      {/* Node */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 relative"
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, #1E4A82, #2563EB)'
                            : 'linear-gradient(135deg, rgba(30,74,130,0.12), rgba(30,74,130,0.03))',
                          border: isActive
                            ? '2px solid #1E4A82'
                            : '1px solid rgba(30,74,130,0.22)',
                          color: isActive ? '#fff' : '#1E4A82',
                          transform: isActive ? 'scale(1.12)' : 'scale(1)',
                          boxShadow: isActive
                            ? '0 6px 20px rgba(30,74,130,0.32), inset 0 1px 0 rgba(255,255,255,0.25)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.6)',
                        }}
                      >
                        {s.icon}
                      </div>
                    </div>
                    <span
                      className="label-micro"
                      style={{
                        color: isActive ? '#1E4A82' : '#6B8AAD',
                        fontSize: '9px',
                        transition: 'color 0.2s',
                        marginTop: 2,
                      }}
                    >
                      STEP {s.step}
                    </span>
                    <p
                      className="text-xs text-center font-medium transition-colors duration-200"
                      style={{ color: isActive ? '#0F1E35' : '#374D6B' }}
                    >
                      {T(s.labelKey)}
                    </p>
                  </button>

                  {/* Connector — refined dot trail + chevron arrow (desktop only) */}
                  {i < WORKFLOW.length - 1 && (
                    <div
                      className="hidden sm:flex items-center flex-1"
                      style={{ paddingTop: 27, maxWidth: 90 }}
                    >
                      <div style={{
                        flex: 1,
                        height: 6,
                        backgroundImage:
                          'radial-gradient(circle, #B6C7DC 1.6px, transparent 1.8px)',
                        backgroundSize: '9px 6px',
                        backgroundRepeat: 'repeat-x',
                        backgroundPosition: 'left center',
                        WebkitMaskImage:
                          'linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%)',
                        maskImage:
                          'linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%)',
                      }} />
                      {/* Chevron arrow */}
                      <ChevronRight
                        size={16}
                        strokeWidth={2.25}
                        style={{
                          color: '#94AECD',
                          flexShrink: 0,
                          marginLeft: -2,
                        }}
                      />
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>

          {/* Expandable description */}
          <div
            style={{
              marginTop: activeStep !== null ? 24 : 0,
              maxHeight: activeStep !== null ? 90 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.3s ease, margin-top 0.3s ease, opacity 0.25s ease',
              opacity: activeStep !== null ? 1 : 0,
            }}
          >
            {activeStep !== null && (
              <div
                className="rounded-lg px-5 py-3.5 flex items-start gap-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,74,130,0.06), rgba(37,99,235,0.03))',
                  border: '1px solid rgba(30,74,130,0.14)',
                  borderLeft: '3px solid #2563EB',
                }}
              >
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-0.5 shrink-0"
                  style={{
                    background: 'rgba(30,74,130,0.10)',
                    border: '1px solid rgba(30,74,130,0.18)',
                    color: '#1E4A82',
                  }}
                >
                  <Sparkles size={10} />
                  <span className="label-micro" style={{ fontSize: '9px' }}>
                    STEP {WORKFLOW[activeStep].step}
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#374D6B', lineHeight: 1.6 }}>
                  {T(WORKFLOW[activeStep].descKey)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
