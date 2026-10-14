import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Profil } from '../lib/types'
import { construirePlage, dureeHeures, formatHeures } from '../lib/dates'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from './Fenetre'

export interface ValeursHoraire {
  id?: string
  employe_id: string
  jour: string
  debut: string
  fin: string
  note: string
}

export default function FenetreHoraire({
  valeurs,
  employes,
  onFermer,
  onEnregistre,
}: {
  valeurs: ValeursHoraire
  employes: Profil[]
  onFermer: () => void
  onEnregistre: () => void
}) {
  const [v, setV] = useState(valeurs)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const modification = Boolean(valeurs.id)

  const plage = v.jour && v.debut && v.fin ? construirePlage(v.jour, v.debut, v.fin) : null
  const lendemain = plage && plage.fin.getDate() !== plage.debut.getDate()

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!plage || !v.employe_id) return
    setEnvoi(true)
    setErreur(null)
    const ligne = {
      employe_id: v.employe_id,
      debut: plage.debut.toISOString(),
      fin: plage.fin.toISOString(),
      note: v.note.trim() || null,
    }
    const { error } = modification
      ? await supabase.from('shifts').update(ligne).eq('id', v.id!)
      : await supabase.from('shifts').insert(ligne)
    setEnvoi(false)
    if (error) return setErreur("Enregistrement impossible. Vérifiez les heures et réessayez.")
    onEnregistre()
  }

  async function supprimer() {
    if (!window.confirm('Supprimer cet horaire ?')) return
    setEnvoi(true)
    const { error } = await supabase.from('shifts').delete().eq('id', v.id!)
    setEnvoi(false)
    if (error) return setErreur('Suppression impossible. Réessayez.')
    onEnregistre()
  }

  return (
    <Fenetre titre={modification ? "Modifier l'horaire" : 'Ajouter un horaire'} onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <label className={etiquette}>
          Employé
          <select
            required
            value={v.employe_id}
            onChange={(e) => setV({ ...v, employe_id: e.target.value })}
            className={champ}
          >
            <option value="">Choisir un employé…</option>
            {employes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label className={etiquette}>
          Date
          <input
            type="date"
            required
            value={v.jour}
            onChange={(e) => setV({ ...v, jour: e.target.value })}
            className={champ}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Début
            <input
              type="time"
              required
              value={v.debut}
              onChange={(e) => setV({ ...v, debut: e.target.value })}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Fin
            <input
              type="time"
              required
              value={v.fin}
              onChange={(e) => setV({ ...v, fin: e.target.value })}
              className={champ}
            />
          </label>
        </div>
        {plage && (
          <p className="-mt-2 text-[13px] text-gris">
            Durée : {formatHeures(dureeHeures(plage.debut, plage.fin))}
            {lendemain && ' · se termine le lendemain'}
          </p>
        )}
        <label className={etiquette}>
          Note (facultatif)
          <input
            type="text"
            maxLength={200}
            placeholder="Ex. : ouverture, inventaire…"
            value={v.note}
            onChange={(e) => setV({ ...v, note: e.target.value })}
            className={champ}
          />
        </label>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row">
          {modification && (
            <button
              type="button"
              onClick={() => void supprimer()}
              disabled={envoi}
              className="h-12 rounded-xl border border-[#F1B4B4] px-4 font-bold text-[#9B1C1C] hover:bg-red-50 sm:h-11"
            >
              Supprimer
            </button>
          )}
          <button type="button" onClick={onFermer} className={`${boutonSecondaire} sm:ml-auto`}>
            Annuler
          </button>
          <button type="submit" disabled={envoi} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
