import { useEffect, useState, type FormEvent } from 'react'
import { dateDuJour, jourLocal, jourSuivant, nbJours } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'

/** L'admin saisit lui-même un congé (déjà accepté) pour un employé, et peut retirer ses horaires prévus. */
export default function FenetreAjoutConge({
  employes,
  onFermer,
  onAjoute,
}: {
  employes: Profil[]
  onFermer: () => void
  onAjoute: (texte: string) => void
}) {
  const [employe, setEmploye] = useState('')
  const [debut, setDebut] = useState(() => jourLocal(new Date()))
  const [fin, setFin] = useState(debut)
  const [motif, setMotif] = useState('')
  const [horaires, setHoraires] = useState(0)
  const [retirer, setRetirer] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const datesValides = Boolean(debut && fin && fin >= debut)

  const plage = () => ({ de: dateDuJour(debut).toISOString(), a: dateDuJour(jourSuivant(fin)).toISOString() })

  // Horaires déjà prévus pendant ce congé.
  useEffect(() => {
    if (!employe || !datesValides) return
    let annule = false
    const de = dateDuJour(debut).toISOString()
    const a = dateDuJour(jourSuivant(fin)).toISOString()
    void supabase
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('employe_id', employe)
      .lt('debut', a)
      .gt('fin', de)
      .then(({ count }) => !annule && setHoraires(count ?? 0))
    return () => {
      annule = true
    }
  }, [employe, debut, fin, datesValides])

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!employe || !datesValides) return
    setEnvoi(true)
    setErreur(null)
    const { error } = await supabase
      .from('conges')
      .insert({ employe_id: employe, debut, fin, motif: motif.trim() || null, statut: 'accepte' })
    if (error) {
      setEnvoi(false)
      return setErreur('Enregistrement impossible. Vérifiez les dates et réessayez.')
    }
    let retires = 0
    if (retirer && horaires > 0) {
      const { de, a } = plage()
      const { error: errSuppr } = await supabase.from('shifts').delete().eq('employe_id', employe).lt('debut', a).gt('fin', de)
      if (!errSuppr) retires = horaires
    }
    setEnvoi(false)
    const p = employes.find((x) => x.id === employe)
    onAjoute(
      `Congé de ${p?.prenom ?? "l'employé"} enregistré${retires ? ` ; ${retires} horaire${retires > 1 ? 's' : ''} retiré${retires > 1 ? 's' : ''} du planning` : ''}.`,
    )
  }

  const jours = datesValides ? nbJours(debut, fin) : 0
  return (
    <Fenetre titre="Ajouter un congé" onFermer={onFermer}>
      <form onSubmit={ajouter} className="flex flex-col gap-4">
        <p className="text-sm text-gris">Pour un congé déjà décidé (arrêt maladie, congé posé à l'oral…) : il est enregistré comme accepté.</p>
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
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Du
            <input
              type="date"
              required
              value={debut}
              onChange={(e) => {
                setDebut(e.target.value)
                if (fin < e.target.value) setFin(e.target.value)
              }}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Au (inclus)
            <input type="date" required min={debut} value={fin} onChange={(e) => setFin(e.target.value)} className={champ} />
          </label>
        </div>
        {datesValides ? (
          <p className="-mt-2 text-[13px] text-gris">
            {jours} jour{jours > 1 ? 's' : ''}
          </p>
        ) : (
          <p className="-mt-2 text-[13px] font-semibold text-red-800">La date de fin doit être après la date de début.</p>
        )}
        <label className={etiquette}>
          Motif (facultatif)
          <input
            type="text"
            maxLength={300}
            placeholder="Ex. : arrêt maladie, congés payés…"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={champ}
          />
        </label>
        {employe && datesValides && horaires > 0 && (
          <label className="flex items-start gap-3 rounded-lg bg-[#FFF1C2] px-3 py-2.5 text-sm text-[#6B4E00]">
            <input type="checkbox" checked={retirer} onChange={(e) => setRetirer(e.target.checked)} className="mt-0.5 size-5 accent-marque" />
            <span>
              {horaires} horaire{horaires > 1 ? 's' : ''} déjà prévu{horaires > 1 ? 's' : ''} pendant ce congé.{' '}
              <b>Les retirer du planning</b>
            </span>
          </label>
        )}
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !employe || !datesValides} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : 'Enregistrer le congé'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
