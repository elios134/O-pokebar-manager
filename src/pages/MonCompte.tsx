import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import ChampMotDePasse from '../components/ChampMotDePasse'
import { boutonPrincipal } from '../components/Fenetre'
import FormulaireEmail from '../components/FormulaireEmail'
import Gabarit from '../components/Gabarit'
import { IconeSortie } from '../components/Icones'
import { supabase } from '../lib/supabase'

export default function MonCompte() {
  const { profil, deconnexion } = useAuth()
  const [equipe, setEquipe] = useState<string | null>(null)
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (!profil?.equipe_id) return
    void supabase
      .from('equipes')
      .select('nom')
      .eq('id', profil.equipe_id)
      .maybeSingle()
      .then(({ data }) => setEquipe(data?.nom ?? null))
  }, [profil?.equipe_id])

  const differents = confirmation !== '' && mdp !== confirmation

  async function changer(e: FormEvent) {
    e.preventDefault()
    if (mdp.length < 8 || differents) return
    setEnvoi(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password: mdp })
    setEnvoi(false)
    if (error) {
      const meme = /different|same/i.test(error.message)
      setMessage({
        type: 'erreur',
        texte: meme ? "Le nouveau mot de passe doit être différent de l'ancien." : 'Changement impossible. Réessayez.',
      })
      return
    }
    setMdp('')
    setConfirmation('')
    setMessage({ type: 'ok', texte: 'Mot de passe changé. Utilisez-le à votre prochaine connexion.' })
  }

  return (
    <Gabarit titre="Mon compte">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl border border-ligne bg-white p-5">
          <h2 className="mb-3 text-lg font-extrabold">Mes informations</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-gris">Nom</dt>
            <dd className="font-semibold">
              {profil?.prenom} {profil?.nom}
            </dd>
            <dt className="text-gris">Email</dt>
            <dd className="font-semibold break-all">{profil?.email}</dd>
            <dt className="text-gris">Rôle</dt>
            <dd className="font-semibold">{profil?.role === 'admin' ? 'Administrateur' : 'Employé'}</dd>
            <dt className="text-gris">Équipe</dt>
            <dd className="font-semibold">{equipe ?? 'Aucune'}</dd>
          </dl>
          {profil?.role === 'admin' ? (
            <div className="mt-4 border-t border-ligne pt-4">
              <FormulaireEmail
                id={profil.id}
                emailActuel={profil.email}
                onChange={(r) => {
                  setMessage(r)
                  // Recharge pour afficher le nouvel email partout.
                  if (r.type === 'ok') window.setTimeout(() => window.location.reload(), 1500)
                }}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-gris">Une erreur ? Demandez à votre responsable de la corriger.</p>
          )}
          <button
            type="button"
            onClick={() => void deconnexion()}
            className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-[#C9CCD4] px-4 font-semibold hover:bg-fond"
          >
            <IconeSortie />
            Se déconnecter
          </button>
        </section>

        <form onSubmit={changer} className="flex flex-col gap-4 rounded-2xl border border-ligne bg-white p-5">
          <h2 className="text-lg font-extrabold">Changer mon mot de passe</h2>
          <ChampMotDePasse
            libelle="Nouveau mot de passe"
            valeur={mdp}
            onChange={setMdp}
            autoComplete="new-password"
            minLength={8}
            aide="8 caractères minimum."
          />
          <ChampMotDePasse
            libelle="Confirmer le nouveau mot de passe"
            valeur={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            minLength={8}
          />
          {differents && <p className="-mt-2 text-sm font-semibold text-red-800">Les deux mots de passe ne sont pas identiques.</p>}
          {message && (
            <p
              role={message.type === 'erreur' ? 'alert' : 'status'}
              className={`rounded-lg px-3 py-2 text-sm ${
                message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'
              }`}
            >
              {message.texte}
            </p>
          )}
          <button
            type="submit"
            disabled={envoi || mdp.length < 8 || mdp !== confirmation}
            className={boutonPrincipal}
          >
            {envoi ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </Gabarit>
  )
}
