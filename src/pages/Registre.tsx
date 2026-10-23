import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  aFaireLe,
  CHAMPS_CHECKLIST,
  CHAMPS_COCHE,
  CHAMPS_TACHE,
  type Checklist,
  type Coche,
  type Tache,
} from '../lib/checklists'
import {
  CHAMPS_FRIGO,
  CHAMPS_LIVRAISON,
  CHAMPS_RELEVE,
  horsLimites,
  texteTemperature,
  type Frigo,
  type Livraison,
  type Nom,
  type Releve,
} from '../lib/cuisine'
import { dateDuJour, heureLocale, jourLocal, jourSuivant } from '../lib/dates'
import { supabase } from '../lib/supabase'

const fmtJour = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })
const fmtLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const court = (jour: string) => fmtJour.format(new Date(`${jour}T12:00`))

const PARTIES = [
  { id: 'temperatures', texte: 'Températures des frigos' },
  { id: 'dlc', texte: 'DLC (produits ouverts, retirés)' },
  { id: 'livraisons', texte: 'Livraisons' },
  { id: 'checklists', texte: 'Checklists' },
] as const
type Partie = (typeof PARTIES)[number]['id']

interface ProduitRegistre {
  id: string
  nom: string
  ouvert_le: string | null
  dlc: string
  ajoute_par: string | null
  cree_le: string
  retire_le: string | null
}

interface Donnees {
  frigos: Frigo[]
  releves: Releve[]
  produits: ProduitRegistre[]
  livraisons: Livraison[]
  listes: Checklist[]
  taches: Tache[]
  coches: Coche[]
  noms: Nom[]
}

/** Liste des jours entre deux dates incluses. */
function joursEntre(du: string, au: string) {
  const r: string[] = []
  for (let j = du; j <= au && r.length < 400; j = jourSuivant(j)) r.push(j)
  return r
}

/** Registre sanitaire (températures, DLC, livraisons, checklists) sur une période, à imprimer ou enregistrer en PDF. */
export default function Registre() {
  const [du, setDu] = useState(() => {
    const d = new Date()
    return jourLocal(new Date(d.getFullYear(), d.getMonth(), 1))
  })
  const [aujourdhui] = useState(() => jourLocal(new Date()))
  const [au, setAu] = useState(aujourdhui)
  const [parties, setParties] = useState<Set<Partie>>(() => new Set(PARTIES.map((p) => p.id)))
  const [donnees, setDonnees] = useState<Donnees | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const valide = Boolean(du && au && au >= du)

  useEffect(() => {
    if (!valide) return
    let annule = false
    const de = dateDuJour(du).toISOString()
    const a = dateDuJour(jourSuivant(au)).toISOString()
    void Promise.all([
      supabase.from('frigos').select(CHAMPS_FRIGO).order('ordre').order('nom'),
      supabase.from('releves_temperature').select(CHAMPS_RELEVE).gte('jour', du).lte('jour', au).order('jour'),
      supabase
        .from('dlc_produits')
        .select('id, nom, ouvert_le, dlc, ajoute_par, cree_le, retire_le')
        .lt('cree_le', a)
        .or(`retire_le.is.null,retire_le.gte.${de}`)
        .order('dlc'),
      supabase.from('livraisons').select(CHAMPS_LIVRAISON).gte('recu_le', de).lt('recu_le', a).order('recu_le'),
      supabase.from('checklists').select(CHAMPS_CHECKLIST).order('ordre').order('nom'),
      supabase.from('checklist_taches').select(CHAMPS_TACHE).order('ordre'),
      supabase.from('checklist_coches').select(CHAMPS_COCHE).gte('jour', du).lte('jour', au),
      supabase.rpc('noms_equipe'),
    ]).then(([f, r, p, l, cl, t, co, n]) => {
      if (annule) return
      if ([f, r, p, l, cl, t, co].some((x) => x.error))
        return setErreur('Impossible de charger le registre. Réessayez.')
      setErreur(null)
      setDonnees({
        frigos: (f.data as Frigo[]).map((x) => ({ ...x, temp_min: Number(x.temp_min), temp_max: Number(x.temp_max) })),
        releves: (r.data as Releve[]).map((x) => ({ ...x, temperature: Number(x.temperature) })),
        produits: p.data as ProduitRegistre[],
        livraisons: l.data as Livraison[],
        listes: cl.data as Checklist[],
        taches: t.data as Tache[],
        coches: co.data as Coche[],
        noms: (n.data ?? []) as Nom[],
      })
    })
    return () => {
      annule = true
    }
  }, [du, au, valide])

  const basculer = (id: Partie) =>
    setParties((s) => {
      const r = new Set(s)
      if (r.has(id)) r.delete(id)
      else r.add(id)
      return r
    })

  const prenom = (id: string | null) => donnees?.noms.find((x) => x.id === id)?.prenom ?? ''
  const jours = valide ? joursEntre(du, au) : []
  let numero = 0
  const titre = (texte: string) => (
    <h2 className="mb-1.5 text-[15px] font-extrabold print:text-[12px]">
      {++numero}. {texte}
    </h2>
  )
  const tableau =
    'w-full border-collapse text-[13px] print:text-[9.5px] [&_td]:border-b [&_td]:border-ligne [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-ligne [&_th]:px-2 [&_th]:py-1 [&_th]:text-left'

  return (
    <div className="min-h-dvh bg-fond print:bg-white">
      <div className="mx-auto max-w-[1000px] px-4 py-5 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/cuisine"
              className="mr-auto flex h-11 items-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold text-encre hover:bg-fond"
            >
              ← Retour
            </Link>
            <button
              type="button"
              disabled={!donnees}
              onClick={() => window.print()}
              className="h-11 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
            >
              Télécharger en PDF / Imprimer
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ligne bg-white p-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-gris">
              Du
              <input
                type="date"
                value={du}
                onChange={(e) => setDu(e.target.value)}
                className="h-11 rounded-xl border border-[#C9CCD4] px-3 text-sm text-encre"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gris">
              Au
              <input
                type="date"
                min={du}
                value={au}
                onChange={(e) => setAu(e.target.value)}
                className="h-11 rounded-xl border border-[#C9CCD4] px-3 text-sm text-encre"
              />
            </label>
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="sr-only">Contenu</legend>
              {PARTIES.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={parties.has(p.id)}
                    onChange={() => basculer(p.id)}
                    className="size-5 accent-marque"
                  />
                  {p.texte}
                </label>
              ))}
            </fieldset>
          </div>
          {!valide && (
            <p className="text-sm font-semibold text-red-800">La date de fin doit être après la date de début.</p>
          )}
          {erreur && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
        </div>

        <article className="rounded-2xl border border-ligne bg-white p-4 sm:p-6 print:rounded-none print:border-0 print:p-0">
          <header className="mb-4 flex items-center gap-3 border-b-2 border-encre pb-2">
            <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
            <div>
              <h1 className="text-xl font-extrabold">O'pokebar · Registre sanitaire</h1>
              {valide && (
                <p className="text-sm text-gris">
                  Du {fmtLong.format(dateDuJour(du))} au {fmtLong.format(dateDuJour(au))}
                </p>
              )}
            </div>
          </header>

          {!donnees ? (
            <p className="text-gris">Chargement…</p>
          ) : (
            <div className="flex flex-col gap-5">
              {parties.has('temperatures') && (
                <section className="overflow-x-auto print:overflow-visible">
                  {titre('Températures des frigos')}
                  {donnees.frigos.length === 0 ? (
                    <p className="text-sm text-gris">Aucun frigo enregistré.</p>
                  ) : (
                    <table className={tableau}>
                      <thead>
                        <tr>
                          <th>Jour</th>
                          {donnees.frigos.map((f) => (
                            <th key={f.id}>
                              {f.nom}{' '}
                              <span className="font-normal text-gris">
                                ({texteTemperature(f.temp_min)} à {texteTemperature(f.temp_max)})
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jours.map((j) => (
                          <tr key={j}>
                            <td>{court(j)}</td>
                            {donnees.frigos.map((f) => {
                              const r = donnees.releves.find((x) => x.frigo_id === f.id && x.jour === j)
                              if (!r)
                                return (
                                  <td key={f.id} className="text-gris">
                                    non relevé
                                  </td>
                                )
                              const hors = horsLimites(r.temperature, f)
                              return (
                                <td key={f.id} className={hors ? 'font-bold text-[#9B1C1C]' : ''}>
                                  {texteTemperature(r.temperature)}
                                  {hors && ' hors limites'}
                                  <span className="text-gris">
                                    {' '}
                                    · {prenom(r.releve_par)} {heureLocale(new Date(r.releve_le))}
                                  </span>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {parties.has('dlc') && (
                <section className="overflow-x-auto print:overflow-visible">
                  {titre('DLC')}
                  {donnees.produits.length === 0 ? (
                    <p className="text-sm text-gris">Aucun produit sur la période.</p>
                  ) : (
                    <table className={tableau}>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Ouvert le</th>
                          <th>DLC</th>
                          <th>Retiré le</th>
                          <th>Par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donnees.produits.map((p) => (
                          <tr key={p.id}>
                            <td>{p.nom}</td>
                            <td>{p.ouvert_le ? court(p.ouvert_le) : '—'}</td>
                            <td>{court(p.dlc)}</td>
                            <td>{p.retire_le ? court(jourLocal(new Date(p.retire_le))) : '—'}</td>
                            <td>{prenom(p.ajoute_par)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {parties.has('livraisons') && (
                <section className="overflow-x-auto print:overflow-visible">
                  {titre('Livraisons')}
                  {donnees.livraisons.length === 0 ? (
                    <p className="text-sm text-gris">Aucune livraison sur la période.</p>
                  ) : (
                    <table className={tableau}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Fournisseur</th>
                          <th>Temp.</th>
                          <th>Lot</th>
                          <th>Produits</th>
                          <th>Conforme</th>
                          <th>Bon</th>
                          <th>Reçu par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donnees.livraisons.map((l) => (
                          <tr key={l.id}>
                            <td>
                              {court(jourLocal(new Date(l.recu_le)))} {heureLocale(new Date(l.recu_le))}
                            </td>
                            <td>{l.fournisseur}</td>
                            <td>{l.temperature !== null ? texteTemperature(Number(l.temperature)) : '—'}</td>
                            <td>{l.lot ?? '—'}</td>
                            <td>{l.produits ?? ''}</td>
                            <td className={l.conforme ? '' : 'font-bold text-[#9B1C1C]'}>
                              {l.conforme ? 'Oui' : 'Non'}
                            </td>
                            <td>{l.photo ? 'photo' : '—'}</td>
                            <td>{prenom(l.recu_par)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {parties.has('checklists') && (
                <section className="overflow-x-auto print:overflow-visible">
                  {titre('Checklists')}
                  {donnees.listes.length === 0 ? (
                    <p className="text-sm text-gris">Aucune checklist.</p>
                  ) : (
                    <table className={tableau}>
                      <thead>
                        <tr>
                          <th>Jour</th>
                          {donnees.listes.map((l) => (
                            <th key={l.id}>{l.nom}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jours.map((j) => (
                          <tr key={j}>
                            <td>{court(j)}</td>
                            {donnees.listes.map((l) => {
                              if (!aFaireLe(l, j))
                                return (
                                  <td key={l.id} className="text-gris">
                                    —
                                  </td>
                                )
                              const cochees = new Set(donnees.coches.filter((c) => c.jour === j).map((c) => c.tache_id))
                              const prevues = donnees.taches.filter(
                                (t) =>
                                  t.checklist_id === l.id &&
                                  jourLocal(new Date(t.cree_le)) <= j &&
                                  (t.active || cochees.has(t.id)),
                              )
                              if (!prevues.length)
                                return (
                                  <td key={l.id} className="text-gris">
                                    —
                                  </td>
                                )
                              const oubliees = prevues.filter((t) => !cochees.has(t.id))
                              // Aujourd'hui la journée n'est pas finie : rien n'est encore « oublié ».
                              const enCours = j === aujourdhui && oubliees.length > 0
                              return (
                                <td key={l.id} className={oubliees.length && !enCours ? 'font-bold text-[#9B1C1C]' : ''}>
                                  {prevues.length - oubliees.length}/{prevues.length}
                                  {enCours
                                    ? ' (en cours)'
                                    : oubliees.length > 0 && ` (oublié : ${oubliees.map((t) => t.texte).join(', ')})`}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
