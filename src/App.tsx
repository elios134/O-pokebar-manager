import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import MiseAJour from './components/pwa/MiseAJour'
import { Protege, RedirectionAccueil } from './auth/Protection'
import AdminAcomptes from './pages/AdminAcomptes'
import AdminConges from './pages/AdminConges'
import AdminEmployes from './pages/AdminEmployes'
import AdminPlanning from './pages/AdminPlanning'
import Connexion from './pages/Connexion'
import Cuisine from './pages/Cuisine'
import Impression from './pages/Impression'
import MesAcomptes from './pages/MesAcomptes'
import MesConges from './pages/MesConges'
import MonCompte from './pages/MonCompte'
import MotDePasseOublie from './pages/MotDePasseOublie'
import NouveauMotDePasse from './pages/NouveauMotDePasse'
import MonPlanning from './pages/MonPlanning'

function App() {
  return (
    <AuthProvider>
      <MiseAJour />
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/nouveau-mot-de-passe" element={<NouveauMotDePasse />} />
          <Route path="/mon-planning" element={<Protege><MonPlanning /></Protege>} />
          <Route path="/mon-compte" element={<Protege><MonCompte /></Protege>} />
          <Route path="/mes-conges" element={<Protege><MesConges /></Protege>} />
          <Route path="/impression" element={<Protege><Impression /></Protege>} />
          <Route path="/cuisine" element={<Protege cuisine><Cuisine /></Protege>} />
          <Route path="/mes-acomptes" element={<Protege><MesAcomptes /></Protege>} />
          <Route path="/admin/acomptes" element={<Protege admin><AdminAcomptes /></Protege>} />
          <Route path="/admin/conges" element={<Protege admin><AdminConges /></Protege>} />
          <Route path="/admin/planning" element={<Protege admin><AdminPlanning /></Protege>} />
          <Route path="/admin/grille" element={<Navigate to="/admin/planning" replace />} />
          <Route path="/admin/employes" element={<Protege admin><AdminEmployes /></Protege>} />
          <Route path="*" element={<RedirectionAccueil />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
