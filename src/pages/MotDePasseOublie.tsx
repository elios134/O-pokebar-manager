import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { boutonPrincipal, champ, etiquette } from '../components/Fenetre'
import PageAccueilSimple from '../components/PageAccueilSimple'
import { supabase } from '../lib/supabase'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [envoye, setEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    })
    setEnvoi(false)
    // Trop de demandes : on le dit. Sinon, même message que le compte existe ou non (pas d'indice aux curieux).
    if (error && error.status === 429) return setErreur('Trop de demandes. Réessayez dans quelques minutes.')
    setEnvoye(true)
  }

  return (
    <PageAccueilSimple titre="Mot de passe oublié">
      {envoye ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-lg bg-[#DDF5E6] px-3 py-2 text-sm text-[#145C32]">
            Si un compte existe avec cet email, vous allez recevoir un lien pour choisir un nouveau mot de passe.
          </p>
          <p className="text-sm text-gris">
            Rien reçu après quelques minutes ? Regardez dans les spams, ou demandez à votre responsable de vous donner un
            nouveau mot de passe.
          </p>
          <Link to="/connexion" className="font-semibold text-marque-fonce hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={envoyer} className="flex flex-col gap-4">
          <p className="text-[15px] text-gris">Entrez votre email : nous vous envoyons un lien pour en choisir un nouveau.</p>
          <label className={etiquette}>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={champ}
            />
          </label>
          {erreur && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <button type="submit" disabled={envoi} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : 'Envoyer le lien'}
          </button>
          <Link to="/connexion" className="text-center text-sm font-semibold text-marque-fonce hover:underline">
            Retour à la connexion
          </Link>
        </form>
      )}
    </PageAccueilSimple>
  )
}
