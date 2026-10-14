import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Protege, RedirectionAccueil } from './auth/Protection'
import AdminConges from './pages/AdminConges'
import AdminEmployes from './pages/AdminEmployes'
import AdminPlanning from './pages/AdminPlanning'
import Connexion from './pages/Connexion'
import MesConges from './pages/MesConges'
import MonPlanning from './pages/MonPlanning'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mon-planning" element={<Protege><MonPlanning /></Protege>} />
          <Route path="/mes-conges" element={<Protege><MesConges /></Protege>} />
          <Route path="/admin/conges" element={<Protege admin><AdminConges /></Protege>} />
          <Route path="/admin/planning" element={<Protege admin><AdminPlanning /></Protege>} />
          <Route path="/admin/employes" element={<Protege admin><AdminEmployes /></Protege>} />
          <Route path="*" element={<RedirectionAccueil />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
