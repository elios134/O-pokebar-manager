import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Conge, Profil } from '../lib/types'
import { construirePlage, dateDuJour, dureeHeures, formatHeures, heureDansService, jourSuivant } from '../lib/dates'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from './Fenetre'
import SelecteurJours from './SelecteurJours'

interface Ligne {
  debut: string
  fin: string
  pauseDebut: string // "" = pas de pause
  pauseFin: string
}

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const petit = 'h-11 w-full min-w-0 rounded-lg border border-[#C9CCD4] bg-white px-2 text-[15px] outline-none focus:border-marque'

/** Pause facultative : un bouton pour l'ajouter, deux heures et un bouton pour la retirer. */
function BlocPause({ ligne, onChange }: { ligne: Ligne; onChange: (champs: Partial<Ligne>) => void }) {
  if (!ligne.pauseDebut && !ligne.pauseFin) {
    return (
      <button
        type="button"
        onClick={() => onChange(pauseParDefaut(ligne))}
        className="col-span-2 h-11 rounded-lg border border-dashed border-[#9AA0AC] bg-white text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
      >
        + Ajouter une pause
      </button>
    )
  }
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Début de pause
        <input type="time" required value={ligne.pauseDebut} onChange={(e) => onChange({ pauseDebut: e.target.value })} className={petit} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Fin de pause
        <input type="time" required value={ligne.pauseFin} onChange={(e) => onChange({ pauseFin: e.target.value })} className={petit} />
      </label>
      <button
        type="button"
        onClick={() => onChange({ pauseDebut: '', pauseFin: '' })}
        className="col-span-2 justify-self-start text-sm font-semibold text-[#9B1C1C] hover:underline"
      >
        Retirer la pause
      </button>
    </>
  )
}

/** Pause de 30 min proposée au milieu de l'horaire. */
function pauseParDefaut(l: Ligne): Partial<Ligne> {
  const [hd, md] = l.debut.split(':').map(Number)
  const [hf, mf] = l.fin.split(':').map(Number)
  let debut = hd * 60 + md
  let fin = hf * 60 + mf
  if (fin <= debut) fin += 24 * 60
  const milieu = Math.floor((debut + fin) / 2 / 30) * 30
  debut = milieu % (24 * 60)
  const h = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return { pauseDebut: h(debut), pauseFin: h(debut + 30) }
}

/** Calcule un horaire ; renvoie une erreur lisible si les heures ne vont pas. */
function calculer(jour: string, l: Ligne) {
  if (!l.debut || !l.fin) return { erreur: 'Heures manquantes.' }
  const plage = construirePlage(jour, l.debut, l.fin)
  let pause: { debut: Date; fin: Date } | null = null
  if (l.pauseDebut || l.pauseFin) {
    if (!l.pauseDebut || !l.pauseFin) return { erreur: 'Indiquez le début et la fin de la pause, ou retirez-la.' }
    pause = {
      debut: heureDansService(jour, l.pauseDebut, plage.debut),
      fin: heureDansService(jour, l.pauseFin, plage.debut),
    }
    if (pause.fin <= pause.debut || pause.debut < plage.debut || pause.fin > plage.fin) {
      return { erreur: "La pause doit être dans l'horaire." }
    }
  }
  const minutesPause = pause ? (pause.fin.getTime() - pause.debut.getTime()) / 60_000 : 0
  return { plage, pause, travail: dureeHeures(plage.debut, plage.fin, minutesPause) }
}

export default function FenetrePlanification({
  employes,
  onFermer,
  onEnregistre,
}: {
  employes: Profil[]
  onFermer: () => void
  onEnregistre: (nombre: number) => void
}) {
  const [employe, setEmploye] = useState('')
  const [modele, setModele] = useState<Ligne>({ debut: '09:00', fin: '17:00', pauseDebut: '', pauseFin: '' })
  const [jours, setJours] = useState<Record<string, Ligne>>({})
  const [note, setNote] = useState('')
  const [joursConge, setJoursConge] = useState<Set<string>>(new Set())
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  // Jours de congé accepté de l'employé choisi (pour les signaler).
  useEffect(() => {
    if (!employe) return
    let annule = false
    void supabase
      .from('conges')
      .select('debut, fin')
      .eq('employe_id', employe)
      .eq('statut', 'accepte')
      .then(({ data }) => {
        if (annule) return
        const s = new Set<string>()
        for (const c of (data ?? []) as Pick<Conge, 'debut' | 'fin'>[]) {
          for (let j = c.debut; j <= c.fin; j = jourSuivant(j)) s.add(j)
        }
        setJoursConge(s)
      })
    return () => {
      annule = true
    }
  }, [employe])

  const selection = new Set(Object.keys(jours))
  const liste = Object.keys(jours).sort()
  const calculs = Object.fromEntries(liste.map((j) => [j, calculer(j, jours[j])]))
  const total = liste.reduce((t, j) => t + (calculs[j].travail ?? 0), 0)
  const erreurs = liste.filter((j) => calculs[j].erreur)

  function basculer(jour: string) {
    setJours((avant) => {
      const copie = { ...avant }
      if (copie[jour]) delete copie[jour]
      else copie[jour] = { ...modele }
      return copie
    })
  }

  const modifier = (jour: string, champs: Partial<Ligne>) =>
    setJours((avant) => ({ ...avant, [jour]: { ...avant[jour], ...champs } }))

  const appliquerATous = () =>
    setJours((avant) => Object.fromEntries(Object.keys(avant).map((j) => [j, { ...modele }])))

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!employe || liste.length === 0 || erreurs.length) return
    setEnvoi(true)
    setErreur(null)
    const lignes = liste.map((j) => {
      const c = calculs[j]
      return {
        employe_id: employe,
        debut: c.plage!.debut.toISOString(),
        fin: c.plage!.fin.toISOString(),
        pause_debut: c.pause ? c.pause.debut.toISOString() : null,
        pause_fin: c.pause ? c.pause.fin.toISOString() : null,
        note: note.trim() || null,
      }
    })
    const { error } = await supabase.from('shifts').insert(lignes)
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible. Vérifiez les horaires et réessayez.')
    onEnregistre(lignes.length)
  }

  return (
    <Fenetre titre="Planifier plusieurs jours" onFermer={onFermer} large>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <label className={etiquette}>
          Employé
          <select required value={employe} onChange={(e) => setEmploye(e.target.value)} className={champ}>
            <option value="">Choisir un employé…</option>
            {employes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">1. Choisissez les jours</span>
            <SelecteurJours selection={selection} onBasculer={basculer} joursConge={employe ? joursConge : new Set()} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">2. Horaire proposé pour les nouveaux jours</span>
            <div className="flex flex-col gap-3 rounded-xl border border-ligne bg-fond/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Début
                  <input type="time" value={modele.debut} onChange={(e) => setModele({ ...modele, debut: e.target.value })} className={petit} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Fin
                  <input type="time" value={modele.fin} onChange={(e) => setModele({ ...modele, fin: e.target.value })} className={petit} />
                </label>
                <BlocPause ligne={modele} onChange={(c) => setModele({ ...modele, ...c })} />
              </div>
              <p className="text-xs text-gris">La pause est facultative.</p>
              <button
                type="button"
                onClick={appliquerATous}
                disabled={liste.length === 0}
                className="h-10 rounded-lg border border-[#C9CCD4] bg-white text-sm font-semibold hover:bg-white/60 disabled:opacity-50"
              >
                Appliquer à tous les jours choisis
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">
            3. Ajustez chaque jour {liste.length > 0 && <span className="text-gris">({liste.length} jour{liste.length > 1 ? 's' : ''})</span>}
          </span>
          {liste.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#C9CCD4] p-4 text-center text-sm text-gris">
              Touchez des jours dans le calendrier pour les ajouter.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {liste.map((j) => {
                const l = jours[j]
                const c = calculs[j]
                return (
                  <li key={j} className="rounded-xl border border-ligne p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-bold first-letter:uppercase">{fmtJour.format(dateDuJour(j))}</span>
                      {joursConge.has(j) && employe && (
                        <span className="rounded-full bg-[#FFE6CC] px-2 py-0.5 text-xs font-bold text-[#7A3B00]">En congé</span>
                      )}
                      <button
                        type="button"
                        onClick={() => basculer(j)}
                        aria-label={`Retirer le ${fmtJour.format(dateDuJour(j))}`}
                        className="ml-auto flex size-9 items-center justify-center rounded-lg text-gris hover:bg-fond"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="flex flex-col gap-1 text-xs font-semibold">
                        Début
                        <input type="time" required value={l.debut} onChange={(e) => modifier(j, { debut: e.target.value })} className={petit} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold">
                        Fin
                        <input type="time" required value={l.fin} onChange={(e) => modifier(j, { fin: e.target.value })} className={petit} />
                      </label>
                      <div className="col-span-2 grid grid-cols-2 gap-2">
                        <BlocPause ligne={l} onChange={(c) => modifier(j, c)} />
                      </div>
                    </div>
                    <p className={`mt-1.5 text-xs ${c.erreur ? 'font-semibold text-red-800' : 'text-gris'}`}>
                      {c.erreur ?? `Temps de travail : ${formatHeures(c.travail!)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <label className={etiquette}>
          Note pour tous ces horaires (facultatif)
          <input
            type="text"
            maxLength={200}
            placeholder="Ex. : semaine de rentrée"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={champ}
          />
        </label>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {liste.length > 0 && (
            <span className="text-sm text-gris sm:mr-auto">Total : {formatHeures(total)} de travail</span>
          )}
          <button type="button" onClick={onFermer} className={`${boutonSecondaire} ${liste.length ? '' : 'sm:ml-auto'}`}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={envoi || !employe || liste.length === 0 || erreurs.length > 0}
            className={boutonPrincipal}
          >
            {envoi ? 'Enregistrement…' : `Créer ${liste.length || ''} horaire${liste.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
