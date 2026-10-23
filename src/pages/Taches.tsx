import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ChecklistsDuJour from '../components/checklists/ChecklistsDuJour'
import GestionChecklists from '../components/checklists/GestionChecklists'
import HistoriqueChecklists from '../components/checklists/HistoriqueChecklists'
import Gabarit from '../components/Gabarit'
import Onglets from '../components/Onglets'

const SECTIONS = [
  { id: 'jour', texte: "Aujourd'hui" },
  { id: 'gerer', texte: 'Gérer les listes' },
  { id: 'historique', texte: 'Historique' },
] as const
type Section = (typeof SECTIONS)[number]['id']

/** Checklists d'ouverture / fermeture : tout le monde coche ; l'admin gère les listes et voit l'historique. */
export default function Taches() {
  const { profil } = useAuth()
  const admin = profil?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const section: Section = (admin && SECTIONS.find((x) => x.id === params.get('onglet'))?.id) || 'jour'

  return (
    <Gabarit titre="Checklists">
      {admin && (
        <Onglets
          onglets={SECTIONS}
          actif={section}
          onChoisir={(id) => setParams(id === 'jour' ? {} : { onglet: id })}
        />
      )}
      {section === 'gerer' ? (
        <GestionChecklists />
      ) : section === 'historique' ? (
        <HistoriqueChecklists />
      ) : (
        <ChecklistsDuJour moi={profil!.id} admin={admin} />
      )}
    </Gabarit>
  )
}
