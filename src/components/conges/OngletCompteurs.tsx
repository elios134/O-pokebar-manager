import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { jourLocal } from '../../lib/dates'
import { CHAMPS_CORRECTION, lireJours, texteJours, type Correction, type Solde } from '../../lib/rh'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import { boutonPrincipal, champ, etiquette } from '../Fenetre'
import Message, { type TypeMessage } from '../Message'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const date = (jour: string) => fmtDate.format(new Date(`${jour}T12:00`))

/** Admin : soldes de congés de chaque employé, date de départ du compteur et corrections. */
export default function OngletCompteurs({
  profils,
  onProfilsModifies,
}: {
  profils: Profil[]
  onProfilsModifies: () => void
}) {
  const [soldes, setSoldes] = useState<Solde[] | null>(null)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [choisi, setChoisi] = useState<string | null>(null)
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.rpc('soldes_conges'),
        supabase.from('conges_corrections').select(CHAMPS_CORRECTION).order('le'),
      ]).then(([s, c]) => {
        if (s.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les compteurs.' })
        setSoldes(s.data as Solde[])
        setCorrections((c.data ?? []) as Correction[])
      }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const actifs = profils.filter((p) => p.actif)
  const soldeDe = (id: string) => soldes?.find((s) => s.employe_id === id)
  const p = actifs.find((x) => x.id === choisi)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="min-w-0 flex-1">
        <Message message={message} />
        {soldes === null ? (
          <p className="text-gris">Chargement…</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-ligne bg-white">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-[#F8F9FB] text-left text-[13px] text-gris">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Employé</th>
                  <th className="px-3 py-2.5 font-semibold">Acquis</th>
                  <th className="px-3 py-2.5 font-semibold">Pris</th>
                  <th className="px-3 py-2.5 font-semibold">Corrections</th>
                  <th className="px-3 py-2.5 font-semibold">Restant</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {actifs.map((e) => {
                  const s = soldeDe(e.id)
                  if (!s) return null
                  return (
                    <tr key={e.id} className={`border-t border-ligne ${choisi === e.id ? 'bg-marque-doux' : ''}`}>
                      <th scope="row" className="px-3 py-2.5 text-left font-bold">
                        {e.prenom} {e.nom}
                        <span className="block text-xs font-medium text-gris">depuis le {date(s.depuis)}</span>
                      </th>
                      <td className="px-3 py-2.5">{texteJours(s.acquis)}</td>
                      <td className="px-3 py-2.5">{texteJours(-s.pris)}</td>
                      <td className="px-3 py-2.5">{Number(s.corrections) ? texteJours(s.corrections, true) : '—'}</td>
                      <td
                        className={`px-3 py-2.5 font-extrabold ${Number(s.restant) < 0 ? 'text-[#9B1C1C]' : 'text-[#145C32]'}`}
                      >
                        {texteJours(s.restant)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setChoisi(e.id)}
                          aria-label={`Corriger le solde de ${e.prenom} ${e.nom}`}
                          className="h-9 rounded-lg border border-[#C9CCD4] bg-white px-3 text-[13px] font-bold hover:bg-fond"
                        >
                          Corriger
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[13px] text-gris">
          Calcul : 2,5 j par mois depuis la date de départ − congés acceptés (jours ouvrables, lundi au samedi, jours
          fériés non déduits) ± corrections.
        </p>
      </section>

      {p && soldeDe(p.id) && (
        <PanneauCorrection
          key={p.id}
          profil={p}
          solde={soldeDe(p.id)!}
          corrections={corrections.filter((c) => c.employe_id === p.id)}
          onFermer={() => setChoisi(null)}
          onModifie={(texte, profilModifie) => {
            setMessage({ type: 'ok', texte })
            if (profilModifie) onProfilsModifies()
            void charger()
          }}
          onErreur={(texte) => setMessage({ type: 'erreur', texte })}
        />
      )}
    </div>
  )
}

function PanneauCorrection({
  profil: p,
  solde,
  corrections,
  onFermer,
  onModifie,
  onErreur,
}: {
  profil: Profil
  solde: Solde
  corrections: Correction[]
  onFermer: () => void
  onModifie: (texte: string, profilModifie?: boolean) => void
  onErreur: (texte: string) => void
}) {
  const [jours, setJours] = useState('')
  const [motif, setMotif] = useState('')
  const [le, setLe] = useState(() => jourLocal(new Date()))
  const [depuis, setDepuis] = useState(solde.depuis)
  const [envoi, setEnvoi] = useState(false)
  const valeur = lireJours(jours)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!valeur || !motif.trim()) return
    setEnvoi(true)
    const { error } = await supabase
      .from('conges_corrections')
      .insert({ employe_id: p.id, jours: valeur, motif: motif.trim(), le })
    setEnvoi(false)
    if (error) return onErreur('Correction impossible. Réessayez.')
    setJours('')
    setMotif('')
    onModifie(`Solde de ${p.prenom} corrigé (${texteJours(valeur, true)}). Une notification lui est envoyée.`)
  }

  async function changerDepuis() {
    if (!depuis || depuis === solde.depuis) return
    const { error } = await supabase.from('profiles').update({ conges_depuis: depuis }).eq('id', p.id)
    if (error) return onErreur('Date impossible à enregistrer.')
    onModifie(`Compteur de ${p.prenom} : départ le ${date(depuis)}.`, true)
  }

  async function supprimer(c: Correction) {
    if (!window.confirm(`Supprimer la correction « ${c.motif} » ?`)) return
    const { error } = await supabase.from('conges_corrections').delete().eq('id', c.id)
    if (error) return onErreur('Suppression impossible.')
    onModifie('Correction supprimée.')
  }

  return (
    <aside
      aria-label={`Solde de ${p.prenom} ${p.nom}`}
      className="flex w-full flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 shadow-[0_12px_32px_rgba(22,24,29,0.08)] lg:w-[380px] lg:shrink-0"
    >
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-lg font-extrabold">
          {p.prenom} {p.nom}
        </h2>
        <button
          type="button"
          onClick={onFermer}
          className="h-9 rounded-lg px-2 text-sm font-semibold text-gris hover:bg-fond"
        >
          Fermer
        </button>
      </div>

      <div className="flex items-end gap-2">
        <label className={`${etiquette} flex-1`}>
          Compteur depuis le
          <input type="date" value={depuis} onChange={(e) => setDepuis(e.target.value)} className={champ} />
        </label>
        <button
          type="button"
          disabled={!depuis || depuis === solde.depuis}
          onClick={() => void changerDepuis()}
          className="h-12 rounded-xl border border-[#C9CCD4] px-3 text-sm font-bold hover:bg-fond disabled:opacity-50"
        >
          Changer
        </button>
      </div>

      <form onSubmit={ajouter} className="flex flex-col gap-3 border-t border-ligne pt-3">
        <h3 className="font-bold">Ajouter une correction</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Jours (+ ou −)
            <input
              inputMode="decimal"
              placeholder="Ex. : -1,25"
              value={jours}
              onChange={(e) => setJours(e.target.value)}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Date
            <input type="date" value={le} onChange={(e) => setLe(e.target.value)} className={champ} />
          </label>
        </div>
        <label className={etiquette}>
          Motif
          <input
            maxLength={200}
            placeholder="Ex. : solde de départ, arrêt maladie 2 semaines…"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={champ}
          />
        </label>
        {jours && valeur === null && (
          <p className="text-sm font-semibold text-red-800">Nombre de jours invalide (ex. : 2,5 ou -1,25).</p>
        )}
        <button type="submit" disabled={envoi || !valeur || !motif.trim()} className={boutonPrincipal}>
          Ajouter la correction
        </button>
      </form>

      <div className="border-t border-ligne pt-3">
        <h3 className="mb-2 font-bold">Détail</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex gap-2">
            <span className="mr-auto">Acquis depuis le {date(solde.depuis)}</span>
            <b>{texteJours(solde.acquis, true)}</b>
          </li>
          <li className="flex gap-2">
            <span className="mr-auto">Congés acceptés</span>
            <b>{texteJours(-solde.pris)}</b>
          </li>
          {corrections.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="mr-auto">
                {c.motif} <span className="text-gris">· {date(c.le)}</span>
              </span>
              <b>{texteJours(c.jours, true)}</b>
              <button
                type="button"
                onClick={() => void supprimer(c)}
                aria-label={`Supprimer la correction ${c.motif}`}
                className="h-8 rounded px-1.5 text-xs font-semibold text-[#9B1C1C] hover:bg-red-50"
              >
                Suppr.
              </button>
            </li>
          ))}
          <li className="flex gap-2 border-t border-ligne pt-1.5 font-extrabold">
            <span className="mr-auto">Restant</span>
            {texteJours(solde.restant)}
          </li>
        </ul>
      </div>
    </aside>
  )
}
