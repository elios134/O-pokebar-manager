import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import OngletCommandes from '../components/cuisine/OngletCommandes'
import OngletDlc from '../components/cuisine/OngletDlc'
import OngletTemperatures from '../components/cuisine/OngletTemperatures'
import Gabarit from '../components/Gabarit'
import { supabase } from '../lib/supabase'
import { CHAMPS_PROFIL, type Profil } from '../lib/types'

const ONGLETS = [
  { id: 'dlc', texte: 'DLC' },
  { id: 'temperatures', texte: 'Températures' },
  { id: 'commandes', texte: 'À commander' },
] as const
type Onglet = (typeof ONGLETS)[number]['id']

/** Espace Cuisine (rôle cuisine et admin) : DLC, températures des frigos, produits à commander. */
export default function Cuisine() {
  const { profil } = useAuth()
  const admin = profil?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const onglet: Onglet = ONGLETS.some((o) => o.id === params.get('onglet')) ? (params.get('onglet') as Onglet) : 'dlc'
  const [profils, setProfils] = useState<Profil[]>([])

  // Noms de l'équipe, pour afficher qui a demandé un produit (l'admin les voit tous ; un cuisinier voit le sien).
  useEffect(() => {
    void supabase
      .from('profiles')
      .select(CHAMPS_PROFIL)
      .then(({ data }) => setProfils((data ?? []) as Profil[]))
  }, [])

  return (
    <Gabarit titre="Cuisine">
      <div role="tablist" className="mb-4 flex w-full gap-1 rounded-xl bg-[#E8E9EE] p-1 sm:w-fit">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setParams(o.id === 'dlc' ? {} : { onglet: o.id })}
            className={`h-10 flex-1 rounded-lg px-2 text-sm whitespace-nowrap sm:flex-none sm:px-4 ${onglet === o.id ? 'bg-white font-bold shadow-sm' : 'font-semibold text-[#4A5060]'}`}
          >
            {o.texte}
          </button>
        ))}
      </div>
      {onglet === 'dlc' && <OngletDlc />}
      {onglet === 'temperatures' && <OngletTemperatures admin={admin} />}
      {onglet === 'commandes' && profil && <OngletCommandes admin={admin} moi={profil.id} profils={profils} />}
    </Gabarit>
  )
}
