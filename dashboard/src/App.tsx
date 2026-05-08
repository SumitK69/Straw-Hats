import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { Overview } from './pages/Overview'
import { Alerts } from './pages/Alerts'
import { Agents } from './pages/Agents'
import { Events } from './pages/Events'
import { Rules } from './pages/Rules'
import { Settings } from './pages/Settings'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/events" element={<Events />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
