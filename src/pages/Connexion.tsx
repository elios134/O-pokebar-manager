import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageAccueil } from '../auth/pageAccueil'
import { boutonPrincipal, champ, etiquette } from '../components/Fenetre'
import { IconeCalendrier, IconeOeil, IconeOeilBarre } from '../components/Icones'

export default function Connexion() {
  const { chargement, profil, connexion } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [voirMdp, setVoirMdp] = useState(false)

  if (!chargement && profil) return <Navigate to={pageAccueil(profil.role)} replace />

  async function valider(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(await connexion(email.trim(), motDePasse))
    setEnvoi(false)
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white lg:flex-row lg:bg-fond">
      <section className="flex flex-col justify-between gap-8 bg-nuit px-6 pt-14 pb-8 text-white lg:w-[44%] lg:max-w-[560px] lg:p-14">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white text-marque-fonce">
            <IconeCalendrier width={24} height={24} />
          </div>
          <span className="text-xl font-bold">O'pokebar · Planning</span>
        </div>
        <div>
          <p className="text-[32px] leading-[1.1] font-extrabold tracking-tight lg:text-[44px]">
            Votre planning,
            <br />
            toujours à jour.
          </p>
          <p className="mt-4 hidden max-w-sm text-[17px] leading-relaxed text-[#D9DAF5] lg:block">
            Consultez vos horaires de la semaine depuis votre ordinateur, votre tablette ou votre téléphone.
          </p>
        </div>
        <div className="hidden text-[13px] text-[#C7C9F0] lg:block">O'pokebar</div>
      </section>

      <section className="flex flex-1 items-start justify-center px-6 py-8 lg:items-center">
        <form onSubmit={valider} className="flex w-full max-w-sm flex-col gap-5">
          <div>
            <h1 className="text-2xl font-extrabold lg:text-3xl">Connexion</h1>
            <p className="mt-1 text-[15px] text-gris">Entrez votre email et votre mot de passe.</p>
          </div>

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

          <div className={etiquette}>
            <label htmlFor="mot-de-passe">Mot de passe</label>
            <div className="relative">
              <input
                id="mot-de-passe"
                type={voirMdp ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className={`${champ} pr-12`}
              />
              <button
                type="button"
                onClick={() => setVoirMdp((v) => !v)}
                aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={voirMdp}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-gris hover:text-encre"
              >
                {voirMdp ? <IconeOeilBarre width={20} height={20} /> : <IconeOeil width={20} height={20} />}
              </button>
            </div>
          </div>

          {erreur && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}

          <button type="submit" disabled={envoi} className={boutonPrincipal}>
            {envoi ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="text-center text-[13px] text-gris">Pas de compte ? Demandez-le à votre responsable.</p>
        </form>
      </section>
    </main>
  )
}
