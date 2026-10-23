import { useState, type FormEvent } from 'react'
import { gererEmploye } from '../../lib/fonctions'
import type { Equipe, Role } from '../../lib/types'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'

const VIDE = { prenom: '', nom: '', email: '', motDePasse: '', role: 'employe' as Role, equipe: '' }

/** Fenêtre « Créer un compte » : nom, email, mot de passe provisoire, rôle et équipe. */
export default function FenetreCreation({
  equipes,
  onFermer,
  onCree,
}: {
  equipes: Equipe[]
  onFermer: () => void
  onCree: (nom: string) => void
}) {
  const [v, setV] = useState(VIDE)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function creer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    const { equipe, ...compte } = v
    const err = await gererEmploye({ action: 'creer', ...compte, equipe_id: equipe || null })
    setEnvoi(false)
    if (err) setErreur(err)
    else onCree(`${v.prenom} ${v.nom}`)
  }

  return (
    <Fenetre titre="Créer un compte" onFermer={onFermer}>
      <form onSubmit={creer} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Prénom
            <input required value={v.prenom} onChange={(e) => setV({ ...v, prenom: e.target.value })} className={champ} />
          </label>
          <label className={etiquette}>
            Nom
            <input required value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} className={champ} />
          </label>
        </div>
        <label className={etiquette}>
          Email
          <input
            type="email"
            required
            autoComplete="off"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Mot de passe provisoire
          <input
            type="text"
            required
            minLength={8}
            autoComplete="new-password"
            value={v.motDePasse}
            onChange={(e) => setV({ ...v, motDePasse: e.target.value })}
            className={champ}
          />
          <span className="text-xs font-medium text-gris">8 caractères minimum.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Rôle
            <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })} className={champ}>
              <option value="employe">Employé</option>
              <option value="cuisine">Cuisine</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className={etiquette}>
            Équipe
            <select value={v.equipe} onChange={(e) => setV({ ...v, equipe: e.target.value })} className={champ}>
              <option value="">Sans équipe</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi} className={boutonPrincipal}>
            {envoi ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
