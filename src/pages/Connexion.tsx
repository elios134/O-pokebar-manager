import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageAccueil } from '../auth/pageAccueil'

export default function Connexion() {
  const { chargement, profil, connexion } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (!chargement && profil) return <Navigate to={pageAccueil(profil.role)} replace />

  async function valider(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(await connexion(email.trim(), motDePasse))
    setEnvoi(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={valider}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Planning employés</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez-vous pour voir votre planning.</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Mot de passe</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
