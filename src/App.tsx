import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Simulate from './pages/Simulate'
import History from './pages/History'

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/simulate" element={<Simulate />} />
          <Route path="/simulate/:simulationId" element={<Simulate />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
    </LanguageProvider>
  )
}
