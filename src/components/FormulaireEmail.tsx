import { useState, type FormEvent } from 'react'
import { gererEmploye } from '../lib/fonctions'
import { boutonSecondaire, champ } from './Fenetre'

/** Changer l'email de connexion d'un compte (réservé aux admins, passe par la fonction serveur). */
export default function FormulaireEmail({
  id,
  emailActuel,
  onChange,
}: {
  id: string
  emailActuel: string
  onChange: (resultat: { type: 'ok' | 'erreur'; texte: string }, nouvelEmail?: string) => void
}) {
  const [email, setEmail] = useState(emailActuel)
  const [envoi, setEnvoi] = useState(false)
  const propre = email.trim().toLowerCase()

  async function changer(e: FormEvent) {
    e.preventDefault()
    if (propre === emailActuel) return
    setEnvoi(true)
    const err = await gererEmploye({ action: 'email', id, email: propre })
    setEnvoi(false)
    if (err) onChange({ type: 'erreur', texte: err })
    else onChange({ type: 'ok', texte: `Email changé : la connexion se fait maintenant avec ${propre}.` }, propre)
  }

  return (
    <form onSubmit={changer} className="flex flex-col gap-2">
      <label htmlFor={`email-${id}`} className="text-sm font-semibold">
        Email de connexion
      </label>
      <div className="flex gap-2">
        <input
          id={`email-${id}`}
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${champ} flex-1`}
        />
        <button type="submit" disabled={envoi || !propre || propre === emailActuel} className={`${boutonSecondaire} shrink-0`}>
          {envoi ? '…' : 'Changer'}
        </button>
      </div>
    </form>
  )
}
