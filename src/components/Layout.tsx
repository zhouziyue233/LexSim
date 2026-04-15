import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useT } from '../hooks/useT'

interface Props {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  const location = useLocation()
  const { lang, toggle } = useLanguage()
  const T = useT()

  const NAV_LINKS = [
    { label: T('nav.home'),     path: '/' },
    { label: T('nav.simulate'), path: '/simulate' },
    { label: T('nav.history'),  path: '/history' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F7FB' }}>
      {/* Navbar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          borderBottom: '1px solid #D5E0EF',
          boxShadow: '0 1px 8px rgba(15, 30, 53, 0.05)',
        }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-5 h-[54px] flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="LexSim logo" style={{ height: 'fit-content', width: '26px', flexShrink: 0 }} />
            <span
              className="font-semibold px-0 py-0 tracking-tight"
              style={{ color: '#0F1E35', fontFamily: 'Georgia, serif', fontSize: '20px', letterSpacing: '0px', marginTop: '-1px', marginLeft: '-0px' }}
            >
              LexSim
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            {NAV_LINKS.map(link => {
              const active =
                link.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(link.path)
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150"
                  style={{
                    color: active ? '#1E4A82' : '#6B8AAD',
                    background: active ? 'rgba(30, 74, 130, 0.07)' : 'transparent',
                  }}
                >
                  {active && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full"
                      style={{ background: '#1E4A82' }}
                    />
                  )}
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right: Language toggle */}
          <div className="w-[80px] shrink-0 flex justify-end">
            <button
              onClick={toggle}
              aria-label={lang === 'zh' ? 'Switch to English' : '切换为中文'}
              className="flex items-center gap-0.5 px-3 py-1.5 rounded-md transition-all duration-150"
              style={{
                color: '#1E4A82',
                background: 'rgba(30, 74, 130, 0.07)',
                border: '1px solid #D5E0EF',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              <span style={{ opacity: lang === 'zh' ? 1 : 0.4, transition: 'opacity 0.15s' }}>中</span>
              <span style={{ color: '#C0D0E6', margin: '0 3px', fontWeight: 400 }}>/</span>
              <span style={{ opacity: lang === 'en' ? 1 : 0.4, transition: 'opacity 0.15s' }}>EN</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #D5E0EF', background: '#FFFFFF', marginTop: 'auto' }}>
        <div
          className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"
          style={{ color: '#374D6B', fontSize: '11px' }}
        >
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="w-4 h-4 rounded" style={{ opacity: 1.0 }} />
            <span>{T('footer.tagline')}</span>
          </div>
          <span>&copy; All Rights Reserved.</span>
        </div>
      </footer>
    </div>
  )
}
