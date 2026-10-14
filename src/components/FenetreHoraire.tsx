import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Profil } from '../lib/types'
import { construirePlage, dureeHeures, formatHeures, heureDansService, heureLocale } from '../lib/dates'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from './Fenetre'

export interface ValeursHoraire {
  id?: string
  employe_id: string
  jour: string
  debut: string
  fin: string
  /** "" = pas de pause */
  pauseDebut: string
  pauseFin: string
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
  const avecPause = v.pauseDebut !== ''

  const pause =
    plage && avecPause && v.pauseFin
      ? (() => {
          const debut = heureDansService(v.jour, v.pauseDebut, plage.debut)
          const fin = heureDansService(v.jour, v.pauseFin, plage.debut)
          return { debut, fin }
        })()
      : null
  const pauseInvalide =
    pause !== null && (pause.fin <= pause.debut || pause.debut < plage!.debut || pause.fin > plage!.fin)
  const minutesPause = pause && !pauseInvalide ? (pause.fin.getTime() - pause.debut.getTime()) / 60_000 : 0

  /** Propose une pause de 30 min au milieu du service. */
  function ajouterPause() {
    if (!plage) return setV({ ...v, pauseDebut: '12:00', pauseFin: '12:30' })
    const milieu = new Date((plage.debut.getTime() + plage.fin.getTime()) / 2)
    milieu.setMinutes(milieu.getMinutes() < 30 ? 0 : 30, 0, 0)
    const fin = new Date(milieu.getTime() + 30 * 60_000)
    setV({ ...v, pauseDebut: heureLocale(milieu), pauseFin: heureLocale(fin) })
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!plage || !v.employe_id || pauseInvalide || (avecPause && !pause)) return
    setEnvoi(true)
    setErreur(null)
    const ligne = {
      employe_id: v.employe_id,
      debut: plage.debut.toISOString(),
      fin: plage.fin.toISOString(),
      pause_debut: pause ? pause.debut.toISOString() : null,
      pause_fin: pause ? pause.fin.toISOString() : null,
      note: v.note.trim() || null,
    }
    const { error } = modification
      ? await supabase.from('shifts').update(ligne).eq('id', v.id!)
      : await supabase.from('shifts').insert(ligne)
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible. Vérifiez les heures et réessayez.')
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

        <fieldset className="rounded-xl border border-ligne bg-fond/60 p-3">
          <legend className="px-1 text-sm font-semibold">Pause</legend>
          {avecPause ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className={etiquette}>
                  Début de pause
                  <input
                    type="time"
                    required
                    value={v.pauseDebut}
                    onChange={(e) => setV({ ...v, pauseDebut: e.target.value })}
                    className={champ}
                  />
                </label>
                <label className={etiquette}>
                  Fin de pause
                  <input
                    type="time"
                    required
                    value={v.pauseFin}
                    onChange={(e) => setV({ ...v, pauseFin: e.target.value })}
                    className={champ}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setV({ ...v, pauseDebut: '', pauseFin: '' })}
                className="self-start text-sm font-semibold text-[#9B1C1C] underline-offset-2 hover:underline"
              >
                Retirer la pause
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={ajouterPause}
              className="h-11 w-full rounded-lg border border-dashed border-[#9AA0AC] bg-white text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
            >
              + Ajouter une pause
            </button>
          )}
        </fieldset>

        {plage && (
          <p className={`-mt-2 text-[13px] ${pauseInvalide ? 'font-semibold text-red-800' : 'text-gris'}`}>
            {pauseInvalide
              ? "La pause doit être comprise dans l'horaire, et sa fin après son début."
              : `Temps de travail : ${formatHeures(dureeHeures(plage.debut, plage.fin, minutesPause))}` +
                (minutesPause ? ` (sur ${formatHeures(dureeHeures(plage.debut, plage.fin))})` : '') +
                (lendemain ? ' · se termine le lendemain' : '')}
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
          <button type="submit" disabled={envoi || pauseInvalide} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
