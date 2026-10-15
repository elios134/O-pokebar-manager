import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageAccueil } from '../auth/pageAccueil'
import ChampMotDePasse from '../components/ChampMotDePasse'
import { boutonPrincipal } from '../components/Fenetre'
import PageAccueilSimple from '../components/PageAccueilSimple'
import { supabase } from '../lib/supabase'

/** Page ouverte depuis le lien reçu par email : le lien connecte la personne, elle choisit son mot de passe. */
export default function NouveauMotDePasse() {
  const { chargement, profil } = useAuth()
  const naviguer = useNavigate()
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (chargement) {
    return (
      <PageAccueilSimple titre="Nouveau mot de passe">
        <p className="text-gris">Vérification du lien…</p>
      </PageAccueilSimple>
    )
  }

  if (!profil) {
    return (
      <PageAccueilSimple titre="Lien expiré">
        <p className="mb-4 text-[15px] text-gris">Ce lien n'est plus valable. Faites une nouvelle demande.</p>
        <Link to="/mot-de-passe-oublie" className="font-semibold text-marque-fonce hover:underline">
          Recevoir un nouveau lien
        </Link>
      </PageAccueilSimple>
    )
  }

  const differents = confirmation !== '' && mdp !== confirmation

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (mdp.length < 8 || mdp !== confirmation) return
    setEnvoi(true)
    const { error } = await supabase.auth.updateUser({ password: mdp })
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible. Choisissez un autre mot de passe et réessayez.')
    naviguer(pageAccueil(profil!.role), { replace: true })
  }

  return (
    <PageAccueilSimple titre="Nouveau mot de passe">
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <p className="text-[15px] text-gris">Bonjour {profil.prenom}, choisissez votre nouveau mot de passe.</p>
        <ChampMotDePasse libelle="Nouveau mot de passe" valeur={mdp} onChange={setMdp} autoComplete="new-password" minLength={8} aide="8 caractères minimum." />
        <ChampMotDePasse libelle="Confirmer" valeur={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8} />
        {differents && <p className="-mt-2 text-sm font-semibold text-red-800">Les deux mots de passe ne sont pas identiques.</p>}
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <button type="submit" disabled={envoi || mdp.length < 8 || mdp !== confirmation} className={boutonPrincipal}>
          {envoi ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
      </form>
    </PageAccueilSimple>
  )
}
