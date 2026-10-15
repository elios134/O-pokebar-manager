import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageAccueil } from '../auth/pageAccueil'
import { dateDuJour, debutSemaine, dureeHeures, formatHeures, heureLocale, jourLocal, jourSuivant } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, CHAMPS_HORAIRE, CHAMPS_PROFIL, type Conge, type Equipe, type Horaire, type Profil } from '../lib/types'

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const choix = 'h-11 rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-semibold'

interface Donnees {
  profils: Profil[]
  horaires: Horaire[]
  conges: Conge[]
  equipes: Equipe[]
}

const ajouterJours = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Planning en tableau (semaine ou mois), prêt à imprimer ou à enregistrer en PDF. */
export default function Impression() {
  const { profil } = useAuth()
  const admin = profil?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const [aujourdhui] = useState(() => new Date())
  const date = params.get('date') ?? params.get('semaine')
  const periode = params.get('periode') === 'mois' ? 'mois' : 'semaine'
  const equipeId = params.get('equipe') ?? ''
  const employeId = params.get('employe') ?? ''
  const [donnees, setDonnees] = useState<Donnees | null>(null)

  const reference = useMemo(() => (date ? dateDuJour(date) : aujourdhui), [date, aujourdhui])

  // Période affichée : la semaine (lundi → dimanche) ou le mois, découpé en semaines.
  const { debut, fin, semaines } = useMemo(() => {
    if (periode === 'semaine') {
      const lundi = debutSemaine(reference)
      return { debut: lundi, fin: ajouterJours(lundi, 6), semaines: [lundi] }
    }
    const premier = new Date(reference.getFullYear(), reference.getMonth(), 1)
    const dernier = new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
    const liste: Date[] = []
    for (let l = debutSemaine(premier); l <= dernier; l = ajouterJours(l, 7)) liste.push(l)
    return { debut: premier, fin: dernier, semaines: liste }
  }, [periode, reference])

  useEffect(() => {
    const de = semaines[0]
    const a = ajouterJours(semaines[semaines.length - 1], 7)
    let annule = false
    void Promise.all([
      supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
      supabase.from('shifts').select(CHAMPS_HORAIRE).gte('debut', de.toISOString()).lt('debut', a.toISOString()).order('debut'),
      supabase.from('conges').select(CHAMPS_CONGE).eq('statut', 'accepte').lte('debut', jourLocal(a)).gte('fin', jourLocal(de)),
      supabase.from('equipes').select('id, nom').order('nom'),
    ]).then(([p, h, c, e]) => {
      if (annule) return
      setDonnees({
        profils: (p.data ?? []) as Profil[],
        horaires: (h.data ?? []) as Horaire[],
        conges: (c.data ?? []) as Conge[],
        equipes: (e.data ?? []) as Equipe[],
      })
    })
    return () => {
      annule = true
    }
  }, [semaines])

  function changer(valeurs: Record<string, string>) {
    const p = new URLSearchParams(params)
    p.delete('semaine')
    for (const [k, v] of Object.entries(valeurs)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  function decaler(n: number) {
    const d =
      periode === 'semaine'
        ? ajouterJours(reference, 7 * n)
        : new Date(reference.getFullYear(), reference.getMonth() + n, 1)
    changer({ date: jourLocal(d) })
  }

  const equipe = donnees?.equipes.find((e) => e.id === equipeId)
  const membres = (donnees?.profils ?? []).filter((p) =>
    !equipeId ? true : equipeId === 'aucune' ? !p.equipe_id : p.equipe_id === equipeId,
  )
  const choisi = membres.find((p) => p.id === employeId)

  // Lignes : employés filtrés qui ont un horaire ou un congé sur la période (ou actifs).
  const lignes = membres.filter((p) => {
    if (employeId && p.id !== employeId) return false
    if (employeId) return true
    const occupe =
      donnees!.horaires.some((h) => h.employe_id === p.id) || donnees!.conges.some((c) => c.employe_id === p.id)
    return occupe || (p.actif && p.role === 'employe')
  })

  const dansPeriode = (j: string) => j >= jourLocal(debut) && j <= jourLocal(fin)
  const travail = (h: Horaire) => dureeHeures(new Date(h.debut), new Date(h.fin), h.pause_minutes)

  const titre =
    periode === 'mois'
      ? `Planning ${/^[aeiouyàâéèêëîïôûü]/i.test(fmtMois.format(debut)) ? "d'" : 'de '}${fmtMois.format(debut)}`
      : `Planning du ${fmtLong.format(debut)} au ${fmtLong.format(fin)}`
  const sousTitre = [
    "O'pokebar",
    admin ? (equipe ? `Équipe ${equipe.nom}` : equipeId === 'aucune' ? 'Sans équipe' : 'Toutes les équipes') : null,
    choisi ? `${choisi.prenom} ${choisi.nom}` : null,
    !admin && profil ? `${profil.prenom} ${profil.nom}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-dvh bg-fond print:bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-5 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={profil ? pageAccueil(profil.role) : '/'}
              className="mr-auto flex h-11 items-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
            >
              ← Retour
            </Link>
            <button type="button" onClick={() => window.print()} className="h-11 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce">
              Enregistrer en PDF / Imprimer
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-ligne bg-white p-3">
            <div role="group" aria-label="Période" className="flex rounded-xl bg-[#E8E9EE] p-1">
              {(['semaine', 'mois'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={periode === p}
                  onClick={() => changer({ periode: p })}
                  className={`h-9 rounded-lg px-4 text-sm ${periode === p ? 'bg-white font-bold shadow-sm' : 'font-semibold text-[#4A5060]'}`}
                >
                  {p === 'semaine' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => decaler(-1)} aria-label={periode === 'mois' ? 'Mois précédent' : 'Semaine précédente'} className="flex size-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white">
                ‹
              </button>
              <button type="button" onClick={() => decaler(1)} aria-label={periode === 'mois' ? 'Mois suivant' : 'Semaine suivante'} className="flex size-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white">
                ›
              </button>
            </div>
            {admin && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="impr-equipe" className="text-xs font-bold text-gris">
                    Équipe
                  </label>
                  <select
                    id="impr-equipe"
                    value={equipeId}
                    onChange={(e) => changer({ equipe: e.target.value, employe: '' })}
                    className={choix}
                  >
                    <option value="">Toutes les équipes</option>
                    {(donnees?.equipes ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                    <option value="aucune">Sans équipe</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="impr-employe" className="text-xs font-bold text-gris">
                    Employé
                  </label>
                  <select id="impr-employe" value={employeId} onChange={(e) => changer({ employe: e.target.value })} className={choix}>
                    <option value="">Tous les employés</option>
                    {membres.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ligne bg-white p-4 sm:p-6 print:rounded-none print:border-0 print:p-0">
          <div className="mb-4 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
            <div className="mr-auto">
              <h1 className="text-xl font-extrabold first-letter:uppercase">{titre}</h1>
              <p className="text-sm text-gris">{sousTitre}</p>
            </div>
          </div>

          {donnees === null ? (
            <p className="text-gris">Chargement…</p>
          ) : lignes.length === 0 ? (
            <p className="rounded-lg border border-ligne p-4 text-center text-gris">Aucun employé pour ce choix.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {semaines.map((lundi) => {
                const jours = Array.from({ length: 7 }, (_, i) => jourLocal(ajouterJours(lundi, i)))
                return (
                  <section key={lundi.toISOString()} className="break-inside-avoid">
                    {periode === 'mois' && (
                      <h2 className="mb-1.5 text-sm font-bold text-gris">
                        Semaine du {fmtLong.format(lundi)}
                      </h2>
                    )}
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full min-w-[760px] border-collapse text-[13px] print:min-w-0 print:text-[10px]">
                        <thead>
                          <tr>
                            <th className="w-36 border border-ligne bg-fond px-2 py-1.5 text-left">Employé</th>
                            {jours.map((j) => (
                              <th
                                key={j}
                                className={`border border-ligne px-1 py-1.5 text-center first-letter:uppercase ${dansPeriode(j) ? 'bg-fond' : 'bg-[#E8E9EE] text-[#9AA0AC]'}`}
                              >
                                {fmtJour.format(dateDuJour(j))}
                              </th>
                            ))}
                            <th className="w-16 border border-ligne bg-fond px-1 py-1.5 text-center">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lignes.map((p) => {
                            const siens = donnees.horaires.filter(
                              (h) => h.employe_id === p.id && jours.includes(jourLocal(new Date(h.debut))) && dansPeriode(jourLocal(new Date(h.debut))),
                            )
                            const total = siens.reduce((t, h) => t + travail(h), 0)
                            return (
                              <tr key={p.id} className="break-inside-avoid">
                                <td className="border border-ligne px-2 py-1.5 font-semibold whitespace-nowrap">
                                  {p.prenom} {p.nom}
                                </td>
                                {jours.map((j) => {
                                  if (!dansPeriode(j)) return <td key={j} className="border border-ligne bg-[#F4F5F7]" />
                                  const duJour = siens.filter((h) => jourLocal(new Date(h.debut)) === j)
                                  const conge = donnees.conges.some((c) => c.employe_id === p.id && c.debut <= j && c.fin >= j)
                                  return (
                                    <td key={j} className="border border-ligne px-1 py-1 text-center align-top">
                                      {conge && <div className="font-semibold text-[#7A3B00]">Congé</div>}
                                      {duJour.map((h) => (
                                        <div key={h.id} className="leading-tight">
                                          <div className="font-semibold tabular-nums">
                                            {heureLocale(new Date(h.debut))}–{heureLocale(new Date(h.fin))}
                                          </div>
                                          {h.pause_debut && h.pause_fin && (
                                            <div className="text-gris tabular-nums">
                                              pause {heureLocale(new Date(h.pause_debut))}–{heureLocale(new Date(h.pause_fin))}
                                            </div>
                                          )}
                                          {h.note && <div className="text-gris">{h.note}</div>}
                                        </div>
                                      ))}
                                      {!conge && duJour.length === 0 && <span className="text-[#9AA0AC]">–</span>}
                                    </td>
                                  )
                                })}
                                <td className="border border-ligne px-1 py-1.5 text-center font-bold whitespace-nowrap">
                                  {total ? formatHeures(total) : '–'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })}

              {periode === 'mois' && (
                <section className="break-inside-avoid">
                  <h2 className="mb-1.5 text-sm font-bold">Total du mois</h2>
                  <table className="border-collapse text-[13px] print:text-[10px]">
                    <tbody>
                      {lignes.map((p) => {
                        const total = donnees.horaires
                          .filter((h) => h.employe_id === p.id && dansPeriode(jourLocal(new Date(h.debut))))
                          .reduce((t, h) => t + travail(h), 0)
                        const joursConge = donnees.conges
                          .filter((c) => c.employe_id === p.id)
                          .reduce((n, c) => {
                            let k = 0
                            for (let j = c.debut; j <= c.fin; j = jourSuivant(j)) if (dansPeriode(j)) k++
                            return n + k
                          }, 0)
                        return (
                          <tr key={p.id}>
                            <td className="border border-ligne px-2 py-1.5 font-semibold">
                              {p.prenom} {p.nom}
                            </td>
                            <td className="border border-ligne px-3 py-1.5 text-right font-bold">{total ? formatHeures(total) : '–'}</td>
                            <td className="border border-ligne px-3 py-1.5 text-gris">
                              {joursConge ? `${joursConge} jour${joursConge > 1 ? 's' : ''} de congé` : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
          )}
          <p className="mt-3 text-[11px] text-gris">
            Imprimé le {aujourdhui.toLocaleDateString('fr-FR')} · Temps de travail pauses déduites.
          </p>
        </div>
      </div>
    </div>
  )
}
