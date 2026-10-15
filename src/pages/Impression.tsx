import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageAccueil } from '../auth/pageAccueil'
import { dateDuJour, debutSemaine, dureeHeures, formatHeures, heureLocale, jourLocal } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, CHAMPS_HORAIRE, CHAMPS_PROFIL, type Conge, type Equipe, type Horaire, type Profil } from '../lib/types'

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtTitre = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Planning de la semaine en tableau, prêt à imprimer ou à enregistrer en PDF. */
export default function Impression() {
  const { profil } = useAuth()
  const [params, setParams] = useSearchParams()
  const [aujourdhui] = useState(() => new Date())
  const semaine = params.get('semaine')
  const lundi = useMemo(() => debutSemaine(semaine ? dateDuJour(semaine) : aujourdhui), [semaine, aujourdhui])
  const equipeId = params.get('equipe') ?? ''
  const [donnees, setDonnees] = useState<{ profils: Profil[]; horaires: Horaire[]; conges: Conge[]; equipes: Equipe[] } | null>(null)

  const jours = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lundi)
        d.setDate(d.getDate() + i)
        return jourLocal(d)
      }),
    [lundi],
  )

  useEffect(() => {
    const fin = new Date(lundi)
    fin.setDate(fin.getDate() + 7)
    let annule = false
    void Promise.all([
      supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
      supabase.from('shifts').select(CHAMPS_HORAIRE).gte('debut', lundi.toISOString()).lt('debut', fin.toISOString()).order('debut'),
      supabase.from('conges').select(CHAMPS_CONGE).eq('statut', 'accepte').lte('debut', jours[6]).gte('fin', jours[0]),
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
  }, [lundi, jours])

  function changerSemaine(n: number) {
    const d = new Date(lundi)
    d.setDate(d.getDate() + 7 * n)
    const p = new URLSearchParams(params)
    p.set('semaine', jourLocal(d))
    setParams(p, { replace: true })
  }

  const dimanche = new Date(lundi)
  dimanche.setDate(dimanche.getDate() + 6)
  const equipe = donnees?.equipes.find((e) => e.id === equipeId)

  // Lignes : employés qui ont un horaire ou un congé cette semaine (ou tous les actifs de l'équipe filtrée).
  const lignes = (donnees?.profils ?? []).filter((p) => {
    if (equipeId && p.equipe_id !== equipeId) return false
    const occupe =
      donnees!.horaires.some((h) => h.employe_id === p.id) || donnees!.conges.some((c) => c.employe_id === p.id)
    return occupe || (p.actif && p.role === 'employe')
  })

  return (
    <div className="min-h-dvh bg-fond print:bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-5 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <Link
            to={profil ? pageAccueil(profil.role) : '/'}
            className="mr-auto flex h-11 items-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
          >
            ← Retour
          </Link>
          <button type="button" onClick={() => changerSemaine(-1)} aria-label="Semaine précédente" className="flex size-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white">
            ‹
          </button>
          <button type="button" onClick={() => changerSemaine(1)} aria-label="Semaine suivante" className="flex size-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white">
            ›
          </button>
          <button type="button" onClick={() => window.print()} className="h-11 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce">
            Enregistrer en PDF / Imprimer
          </button>
        </div>

        <div className="rounded-2xl border border-ligne bg-white p-4 sm:p-6 print:rounded-none print:border-0 print:p-0">
          <div className="mb-4 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
            <div className="mr-auto">
              <h1 className="text-xl font-extrabold">
                Planning du {fmtTitre.format(lundi)} au {fmtTitre.format(dimanche)}
              </h1>
              <p className="text-sm text-gris">
                O'pokebar{equipe ? ` · Équipe ${equipe.nom}` : ''}
                {profil?.role !== 'admin' && profil ? ` · ${profil.prenom} ${profil.nom}` : ''}
              </p>
            </div>
          </div>

          {donnees === null ? (
            <p className="text-gris">Chargement…</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[760px] border-collapse text-[13px] print:min-w-0 print:text-[10.5px]">
                <thead>
                  <tr>
                    <th className="border border-ligne bg-fond px-2 py-2 text-left">Employé</th>
                    {jours.map((j) => (
                      <th key={j} className="border border-ligne bg-fond px-2 py-2 text-center first-letter:uppercase">
                        {fmtJour.format(dateDuJour(j))}
                      </th>
                    ))}
                    <th className="border border-ligne bg-fond px-2 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((p) => {
                    const siens = donnees.horaires.filter((h) => h.employe_id === p.id)
                    const total = siens.reduce(
                      (t, h) => t + dureeHeures(new Date(h.debut), new Date(h.fin), h.pause_minutes),
                      0,
                    )
                    return (
                      <tr key={p.id} className="break-inside-avoid">
                        <td className="border border-ligne px-2 py-2 font-semibold whitespace-nowrap">
                          {p.prenom} {p.nom}
                        </td>
                        {jours.map((j) => {
                          const duJour = siens.filter((h) => jourLocal(new Date(h.debut)) === j)
                          const conge = donnees.conges.some((c) => c.employe_id === p.id && c.debut <= j && c.fin >= j)
                          return (
                            <td key={j} className="border border-ligne px-1.5 py-1.5 text-center align-top">
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
                        <td className="border border-ligne px-2 py-2 text-center font-bold whitespace-nowrap">
                          {total ? formatHeures(total) : '–'}
                        </td>
                      </tr>
                    )
                  })}
                  {lignes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="border border-ligne p-4 text-center text-gris">
                        Aucun horaire cette semaine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

