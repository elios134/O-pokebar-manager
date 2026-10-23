import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import OngletCommandes from '../components/cuisine/OngletCommandes'
import OngletDlc from '../components/cuisine/OngletDlc'
import OngletFournisseurs from '../components/cuisine/OngletFournisseurs'
import OngletLivraisons from '../components/cuisine/OngletLivraisons'
import OngletTemperatures from '../components/cuisine/OngletTemperatures'
import Gabarit from '../components/Gabarit'
import Onglets from '../components/Onglets'
import type { Nom } from '../lib/cuisine'
import { supabase } from '../lib/supabase'

const ONGLETS = [
  { id: 'dlc', texte: 'DLC' },
  { id: 'temperatures', texte: 'Températures' },
  { id: 'commandes', texte: 'À commander' },
  { id: 'livraisons', texte: 'Livraisons' },
  { id: 'fournisseurs', texte: 'Fournisseurs' },
] as const
type Onglet = (typeof ONGLETS)[number]['id']

/** Espace Cuisine (rôle cuisine et admin) : DLC, températures, commandes, livraisons, fournisseurs. */
export default function Cuisine() {
  const { profil } = useAuth()
  const admin = profil?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const onglet: Onglet = ONGLETS.find((o) => o.id === params.get('onglet'))?.id ?? 'dlc'
  const [noms, setNoms] = useState<Nom[]>([])

  // Noms de l'équipe, pour afficher qui a demandé un produit ou reçu une livraison.
  useEffect(() => {
    void supabase.rpc('noms_equipe').then(({ data }) => setNoms((data ?? []) as Nom[]))
  }, [])

  return (
    <Gabarit
      titre="Cuisine"
      actions={
        <Link
          to="/cuisine/registre"
          className="flex h-11 items-center rounded-xl border border-[#C9CCD4] bg-white px-4 text-sm font-semibold text-encre hover:bg-fond"
        >
          Registre PDF
        </Link>
      }
    >
      <Onglets onglets={ONGLETS} actif={onglet} onChoisir={(id) => setParams(id === 'dlc' ? {} : { onglet: id })} />
      {onglet === 'dlc' && <OngletDlc />}
      {onglet === 'temperatures' && <OngletTemperatures admin={admin} />}
      {onglet === 'commandes' && profil && <OngletCommandes admin={admin} moi={profil.id} profils={noms} />}
      {onglet === 'livraisons' && <OngletLivraisons admin={admin} noms={noms} />}
      {onglet === 'fournisseurs' && <OngletFournisseurs admin={admin} />}
    </Gabarit>
  )
}
