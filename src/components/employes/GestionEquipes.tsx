import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Equipe, Profil } from '../../lib/types'
import { boutonPrincipal, champ } from '../Fenetre'

/** Bloc « Équipes » : liste, création et suppression. */
export default function GestionEquipes({
  equipes,
  profils,
  onChange,
}: {
  equipes: Equipe[]
  profils: Profil[]
  onChange: (m: { type: 'ok' | 'erreur'; texte: string }) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function creer(e: FormEvent) {
    e.preventDefault()
    const propre = nom.trim()
    if (!propre) return
    setEnvoi(true)
    const { error } = await supabase.from('equipes').insert({ nom: propre })
    setEnvoi(false)
    if (error) {
      onChange({
        type: 'erreur',
        texte: error.code === '23505' ? 'Une équipe porte déjà ce nom.' : "Création de l'équipe impossible.",
      })
    } else {
      setNom('')
      onChange({ type: 'ok', texte: `Équipe ${propre} créée.` })
    }
  }

  async function supprimer(eq: Equipe) {
    const n = profils.filter((p) => p.equipe_id === eq.id).length
    const texte = n
      ? `Supprimer l'équipe ${eq.nom} ? Ses ${n} membre${n > 1 ? 's' : ''} n'auront plus d'équipe.`
      : `Supprimer l'équipe ${eq.nom} ?`
    if (!window.confirm(texte)) return
    const { error } = await supabase.from('equipes').delete().eq('id', eq.id)
    onChange(error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: `Équipe ${eq.nom} supprimée.` })
  }

  return (
    <section className="mb-4 rounded-2xl border border-ligne bg-white">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-bold"
      >
        Équipes
        <span className="text-sm font-semibold text-gris">({equipes.length})</span>
        <span className="ml-auto text-sm font-semibold text-marque-fonce">{ouvert ? 'Fermer' : 'Gérer'}</span>
      </button>
      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-ligne p-4">
          {equipes.length === 0 && <p className="text-sm text-gris">Aucune équipe pour l'instant.</p>}
          <ul className="flex flex-wrap gap-2">
            {equipes.map((eq) => {
              const n = profils.filter((p) => p.equipe_id === eq.id).length
              return (
                <li key={eq.id} className="flex items-center gap-1 rounded-full border border-[#C9CCD4] py-1 pr-1 pl-3.5 text-sm font-semibold">
                  {eq.nom}
                  <span className="font-medium text-gris">· {n}</span>
                  <button
                    type="button"
                    onClick={() => void supprimer(eq)}
                    aria-label={`Supprimer l'équipe ${eq.nom}`}
                    className="ml-1 flex size-8 items-center justify-center rounded-full text-gris hover:bg-red-50 hover:text-[#9B1C1C]"
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
          <form onSubmit={creer} className="flex gap-2">
            <label className="sr-only" htmlFor="nouvelle-equipe">
              Nom de la nouvelle équipe
            </label>
            <input
              id="nouvelle-equipe"
              value={nom}
              maxLength={60}
              placeholder="Nouvelle équipe (ex. : Cuisine, Salle…)"
              onChange={(e) => setNom(e.target.value)}
              className={`${champ} flex-1`}
            />
            <button type="submit" disabled={envoi || !nom.trim()} className={`${boutonPrincipal} shrink-0`}>
              Créer
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
