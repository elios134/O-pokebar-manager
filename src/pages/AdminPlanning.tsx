import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FenetreCreneaux from '../components/grille/FenetreCreneaux'
import FenetreModeles from '../components/grille/FenetreModeles'
import Palette, { GOMME } from '../components/grille/Palette'
import TableauGrille, { type CaseGrille, type LigneGrille } from '../components/grille/TableauGrille'
import Gabarit from '../components/Gabarit'
import { couleurDe, initiales } from '../lib/couleurs'
import {
  CHAMPS_MODELE,
  COULEURS_MODELES,
  depuisHoraire,
  dureeCreneaux,
  garderNotes,
  joursDeLaSemaine,
  memesCreneaux,
  memesHeures,
  normaliserCreneaux,
  texteCreneaux,
  versHoraire,
  type Creneau,
  type ModeleHoraire,
} from '../lib/creneaux'
import { dateDuJour, debutSemaine, jourLocal, jourSuivant, lienImpression } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_HORAIRE, CHAMPS_PROFIL, type Conge, type Equipe, type Horaire, type Profil } from '../lib/types'

const cle = (employe: string, jour: string) => `${employe}|${jour}`
const decouper = (c: string) => c.split('|') as [string, string]

const fmtMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

/** Horaires rangés par case « employé|jour » (le jour où l'horaire commence). */
function parCase(horaires: Horaire[], decalageJours = 0) {
  const m: Record<string, Creneau[]> = {}
  for (const h of horaires) {
    const d = new Date(h.debut)
    d.setDate(d.getDate() + decalageJours)
    ;(m[cle(h.employe_id, jourLocal(d))] ??= []).push(depuisHoraire(h))
  }
  return m
}

/** Planning de l'équipe pour l'admin : une grille façon tableur, remplie avec des horaires types. */
export default function AdminPlanning() {
  const naviguer = useNavigate()
  const [lundi, setLundi] = useState(() => debutSemaine(new Date()))
  const [profils, setProfils] = useState<Profil[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [modeles, setModeles] = useState<ModeleHoraire[]>([])
  const [existants, setExistants] = useState<Record<string, Creneau[]>>({})
  const [conges, setConges] = useState<Set<string>>(new Set())
  const [demandes, setDemandes] = useState<Set<string>>(new Set())
  const [charge, setCharge] = useState(false)
  const [equipe, setEquipe] = useState('')
  const [employe, setEmploye] = useState('')
  const [modifs, setModifs] = useState<Record<string, Creneau[]>>({})
  const [pinceau, setPinceau] = useState<string | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [fenetre, setFenetre] = useState<'creneaux' | 'modeles' | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const jours = useMemo(() => joursDeLaSemaine(lundi), [lundi])
  const nbModifs = Object.keys(modifs).length

  const chargerModeles = useCallback(
    () =>
      supabase
        .from('modeles_horaires')
        .select(CHAMPS_MODELE)
        .order('ordre')
        .then(({ data }) =>
          setModeles(((data ?? []) as ModeleHoraire[]).map((m) => ({ ...m, creneaux: normaliserCreneaux(m.creneaux) }))),
        ),
    [],
  )

  useEffect(() => {
    void Promise.all([
      supabase.from('profiles').select(CHAMPS_PROFIL).eq('actif', true).order('prenom'),
      supabase.from('equipes').select('id, nom').order('nom'),
      chargerModeles(),
    ]).then(([p, e]) => {
      if (p.error) setMessage({ type: 'erreur', texte: 'Impossible de charger les employés.' })
      else setProfils(p.data as Profil[])
      setEquipes((e.data ?? []) as Equipe[])
    })
  }, [chargerModeles])

  const chargerSemaine = useCallback(() => {
    const fin = new Date(lundi)
    fin.setDate(fin.getDate() + 7)
    return Promise.all([
      supabase.from('shifts').select(CHAMPS_HORAIRE).gte('debut', lundi.toISOString()).lt('debut', fin.toISOString()).order('debut'),
      supabase
        .from('conges')
        .select('employe_id, debut, fin, statut')
        .neq('statut', 'refuse')
        .lte('debut', jours[6])
        .gte('fin', jours[0]),
    ]).then(([h, c]) => {
      if (h.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger le planning. Réessayez.' })
      setExistants(parCase(h.data as Horaire[]))
      // Congés acceptés : cases verrouillées. Demandes en attente : simplement signalées.
      const acceptes = new Set<string>()
      const enAttente = new Set<string>()
      for (const x of (c.data ?? []) as Pick<Conge, 'employe_id' | 'debut' | 'fin' | 'statut'>[]) {
        for (let j = x.debut; j <= x.fin; j = jourSuivant(j)) (x.statut === 'accepte' ? acceptes : enAttente).add(cle(x.employe_id, j))
      }
      setConges(acceptes)
      setDemandes(enAttente)
      setCharge(true)
    })
  }, [lundi, jours])

  useEffect(() => {
    void chargerSemaine()
  }, [chargerSemaine])

  // Prévenir avant de quitter la page avec des changements non enregistrés.
  useEffect(() => {
    if (!nbModifs) return
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [nbModifs])

  // Filtres : équipe choisie (ou toutes), puis employé de cette équipe (ou tous).
  const membres = profils.filter((p) => (!equipe ? true : equipe === 'aucune' ? !p.equipe_id : p.equipe_id === equipe))
  const visibles = membres.filter((p) => !employe || p.id === employe)
  const contenu = (c: string) => modifs[c] ?? existants[c] ?? []
  const modeleDe = (creneaux: Creneau[]) =>
    creneaux.length ? modeles.find((m) => memesHeures(m.creneaux, creneaux)) : undefined

  /** Remplit des cases (en attente d'enregistrement). Les jours de congé ne bougent pas. */
  function remplir(cles: string[], creneaux: Creneau[]) {
    setModifs((avant) => {
      const apres = { ...avant }
      for (const c of cles) {
        if (conges.has(c)) continue
        const nouveaux = garderNotes(creneaux, avant[c] ?? existants[c] ?? [])
        if (memesCreneaux(nouveaux, existants[c] ?? [])) delete apres[c]
        else apres[c] = nouveaux
      }
      return apres
    })
  }

  const creneauxDuPinceau = (p: string) => (p === GOMME ? [] : modeles.find((m) => m.id === p)?.creneaux)

  function peindre(c: CaseGrille) {
    const creneaux = pinceau ? creneauxDuPinceau(pinceau) : undefined
    if (creneaux) remplir([c.cle], creneaux)
  }

  function cliquer(c: CaseGrille) {
    if (pinceau) return peindre(c)
    setSelection((s) => {
      const n = new Set(s)
      if (n.has(c.cle)) n.delete(c.cle)
      else n.add(c.cle)
      return n
    })
  }

  function choisirPalette(id: string) {
    if (selection.size) {
      remplir([...selection], creneauxDuPinceau(id) ?? [])
      setSelection(new Set())
      return
    }
    setPinceau((p) => (p === id ? null : id))
  }

  // Au clavier : la lettre d'un horaire type remplit la case (ou toute la sélection si la case en fait partie).
  function toucher(c: CaseGrille, touche: string) {
    const cibles = selection.has(c.cle) ? [...selection] : [c.cle]
    if (touche === 'Delete' || touche === 'Backspace') {
      remplir(cibles, [])
      return true
    }
    const m = modeles.find((x) => x.code === touche.toUpperCase())
    if (!m) return false
    remplir(cibles, m.creneaux)
    if (cibles.length > 1) setSelection(new Set())
    return true
  }

  function changerSemaine(decalage: number | null) {
    if (nbModifs && !window.confirm('Des changements ne sont pas enregistrés. Les abandonner ?')) return
    setModifs({})
    setSelection(new Set())
    setMessage(null)
    setCharge(false)
    if (decalage === null) return setLundi(debutSemaine(new Date()))
    const d = new Date(lundi)
    d.setDate(d.getDate() + decalage * 7)
    setLundi(d)
  }

  async function copierSemainePrecedente() {
    const debut = new Date(lundi)
    debut.setDate(debut.getDate() - 7)
    const { data, error } = await supabase
      .from('shifts')
      .select(CHAMPS_HORAIRE)
      .gte('debut', debut.toISOString())
      .lt('debut', lundi.toISOString())
    if (error) return setMessage({ type: 'erreur', texte: 'Impossible de lire la semaine précédente.' })
    const avant = parCase(data as Horaire[], 7)
    let n = 0
    const apres = { ...modifs }
    for (const p of visibles) {
      for (const j of jours) {
        const c = cle(p.id, j)
        if (conges.has(c)) continue
        const nouveau = avant[c] ?? []
        if (memesCreneaux(nouveau, contenu(c))) continue
        n++
        if (memesCreneaux(nouveau, existants[c] ?? [])) delete apres[c]
        else apres[c] = nouveau
      }
    }
    setModifs(apres)
    setMessage({
      type: 'ok',
      texte: n
        ? `Semaine précédente copiée : ${n} case${n > 1 ? 's' : ''} modifiée${n > 1 ? 's' : ''}. Vérifiez puis enregistrez.`
        : 'Rien à copier : la semaine est déjà identique à la précédente.',
    })
  }

  async function enregistrer() {
    if (!nbModifs) return
    let cases
    try {
      cases = Object.entries(modifs).map(([c, creneaux]) => {
        const [employe_id, jour] = decouper(c)
        return {
          employe_id,
          de: dateDuJour(jour).toISOString(),
          a: dateDuJour(jourSuivant(jour)).toISOString(),
          horaires: creneaux.map((x) => versHoraire(jour, x)),
        }
      })
    } catch {
      return setMessage({ type: 'erreur', texte: 'Un horaire a des heures invalides. Corrigez-le puis réessayez.' })
    }
    setEnvoi(true)
    const { error } = await supabase.rpc('remplir_grille', { p_cases: cases })
    setEnvoi(false)
    if (error) return setMessage({ type: 'erreur', texte: 'Enregistrement impossible. Rien n’a été modifié, réessayez.' })
    await chargerSemaine()
    setModifs({})
    setMessage({ type: 'ok', texte: `Planning enregistré (${nbModifs} case${nbModifs > 1 ? 's' : ''}). Les employés sont prévenus.` })
  }

  // ---------- Données du tableau ----------
  const groupesEquipes = [
    ...equipes.map((e) => ({ id: e.id, nom: e.nom })),
    { id: null as string | null, nom: 'Sans équipe' },
  ]
  const groupes = groupesEquipes
    .map((g) => ({
      nom: g.nom,
      lignes: visibles
        .filter((p) => p.equipe_id === g.id)
        .map((p): LigneGrille => {
          const cases = jours.map((j): CaseGrille => {
            const c = cle(p.id, j)
            const creneaux = contenu(c)
            return {
              cle: c,
              jour: j,
              creneaux,
              modele: modeleDe(creneaux),
              conge: conges.has(c),
              modifiee: c in modifs,
              congeDemande: demandes.has(c),
              choisie: selection.has(c),
            }
          })
          return {
            id: p.id,
            nom: `${p.prenom} ${p.nom}`,
            initiales: initiales(p.prenom, p.nom),
            couleur: couleurDe(profils.indexOf(p)),
            total: cases.reduce((t, c) => t + dureeCreneaux(c.jour, c.creneaux), 0),
            cases,
          }
        }),
    }))
    .filter((g) => g.lignes.length)
  const pied = jours.map((j) => {
    let presents = 0
    let heures = 0
    for (const p of visibles) {
      const cr = contenu(cle(p.id, j))
      if (cr.length) presents++
      heures += dureeCreneaux(j, cr)
    }
    return { presents, heures }
  })
  const totalSemaine = pied.reduce((t, p) => t + p.heures, 0)

  const fin = new Date(lundi)
  fin.setDate(fin.getDate() + 6)
  const premiereChoisie = [...selection][0]

  return (
    <Gabarit
      titre="Planning de l'équipe"
      actions={
        <button
          type="button"
          onClick={() => naviguer(lienImpression(lundi, { periode: 'semaine', equipe: equipe || undefined, employe: employe || undefined }))}
          className="flex h-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
        >
          Exporter en PDF
        </button>
      }
    >
      <div className="flex flex-col gap-3 pb-40 sm:pb-24">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-ligne bg-white p-1">
            <button
              type="button"
              onClick={() => changerSemaine(-1)}
              aria-label="Semaine précédente"
              className="flex size-10 items-center justify-center rounded-lg hover:bg-fond"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button type="button" onClick={() => changerSemaine(null)} className="h-10 rounded-lg px-2 font-bold whitespace-nowrap hover:bg-fond">
              {fmtMois.format(lundi)} – {fmtMois.format(fin)}
            </button>
            <button
              type="button"
              onClick={() => changerSemaine(1)}
              aria-label="Semaine suivante"
              className="flex size-10 items-center justify-center rounded-lg hover:bg-fond"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
          <label htmlFor="grille-equipe" className="sr-only">
            Équipe
          </label>
          <select
            id="grille-equipe"
            value={equipe}
            onChange={(e) => {
              setEquipe(e.target.value)
              setEmploye('')
              setSelection(new Set())
            }}
            className="h-12 rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-semibold"
          >
            <option value="">Toutes les équipes</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
            <option value="aucune">Sans équipe</option>
          </select>
          <label htmlFor="grille-employe" className="sr-only">
            Employé
          </label>
          <select
            id="grille-employe"
            value={employe}
            onChange={(e) => {
              setEmploye(e.target.value)
              setSelection(new Set())
            }}
            className="h-12 max-w-[11rem] rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-semibold"
          >
            <option value="">Tous les employés</option>
            {membres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void copierSemainePrecedente()}
            className="h-12 rounded-xl border border-[#C9CCD4] bg-white px-4 text-sm font-bold hover:bg-fond sm:ml-auto"
          >
            Copier la semaine précédente
          </button>
        </div>

        <Palette
          modeles={modeles}
          pinceau={pinceau}
          selection={selection.size}
          onChoisir={choisirPalette}
          onGerer={() => setFenetre('modeles')}
        />

        {selection.size > 0 && (
          <div className="hidden flex-wrap items-center gap-2 rounded-xl border border-marque bg-[#FFF4F2] px-4 py-2 sm:flex">
            <span className="mr-auto font-bold text-marque-fonce">
              {selection.size} case{selection.size > 1 ? 's' : ''} choisie{selection.size > 1 ? 's' : ''}
            </span>
            <button type="button" onClick={() => setFenetre('creneaux')} className="h-10 rounded-lg border border-[#C9CCD4] bg-white px-3 text-sm font-bold hover:bg-fond">
              Heures et note…
            </button>
            <button type="button" onClick={() => setSelection(new Set())} className="h-10 rounded-lg px-3 text-sm font-bold text-marque-fonce hover:bg-white">
              Annuler la sélection
            </button>
          </div>
        )}

        {message && (
          <p
            role={message.type === 'erreur' ? 'alert' : 'status'}
            className={`rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
          >
            {message.texte}
          </p>
        )}

        {!charge ? (
          <p className="text-gris">Chargement…</p>
        ) : groupes.length === 0 ? (
          <p className="rounded-2xl border border-ligne bg-white p-5 text-gris">Aucun employé dans cette équipe.</p>
        ) : (
          <TableauGrille
            jours={jours}
            groupes={groupes}
            pied={pied}
            totalSemaine={totalSemaine}
            onClic={cliquer}
            onAppui={peindre}
            onGlisser={peindre}
            onTouche={toucher}
          />
        )}

        <p className="hidden text-[13px] text-gris sm:block">
          <b className="text-encre">Au clavier :</b> flèches pour se déplacer, la lettre d'un horaire type pour remplir la case,
          Suppr pour la vider. Les congés acceptés sont grisés et ne peuvent pas être remplis. Point rouge : pas encore
          enregistré · point orange : demande de congé en attente.
        </p>
      </div>

      {/* Téléphone : choix de l'horaire pour les cases touchées */}
      {selection.size > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 rounded-t-2xl border-t border-ligne bg-white px-4 pt-3 pb-4 shadow-[0_-8px_24px_rgba(22,24,29,0.1)] sm:hidden">
          <div className="mb-2 flex items-center">
            <span className="mr-auto font-extrabold">
              {selection.size} case{selection.size > 1 ? 's' : ''} choisie{selection.size > 1 ? 's' : ''}
            </span>
            <button type="button" onClick={() => setSelection(new Set())} className="h-10 px-2 text-sm font-bold text-marque-fonce">
              Annuler
            </button>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {modeles.map((m) => {
              const c = COULEURS_MODELES[m.couleur] ?? COULEURS_MODELES[0]
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => choisirPalette(m.id)}
                  className="flex h-14 flex-col items-center justify-center rounded-xl border leading-tight"
                  style={{ background: c.fond, color: c.texte, borderColor: c.lisere }}
                >
                  <span className="text-sm font-extrabold">{m.nom}</span>
                  <span className="text-[11px] font-semibold">{texteCreneaux(m.creneaux)}</span>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFenetre('creneaux')} className="h-12 rounded-xl border border-[#C9CCD4] font-bold">
              Heures et note…
            </button>
            <button type="button" onClick={() => choisirPalette(GOMME)} className="h-12 rounded-xl border border-[#C9CCD4] font-bold">
              Vider
            </button>
          </div>
        </div>
      )}

      {/* Changements en attente */}
      {nbModifs > 0 && selection.size === 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 border-t border-ligne bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(22,24,29,0.1)] sm:bottom-0">
          <div className="mx-auto flex max-w-7xl items-center gap-2 sm:px-4">
            <span className="mr-auto text-sm font-bold">
              {nbModifs} case{nbModifs > 1 ? 's' : ''} modifiée{nbModifs > 1 ? 's' : ''}
              <span className="hidden font-medium text-gris sm:inline"> · pas encore enregistrée{nbModifs > 1 ? 's' : ''}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setModifs({})
                setMessage(null)
              }}
              className="h-11 rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-bold hover:bg-fond"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={envoi}
              onClick={() => void enregistrer()}
              className="h-11 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce disabled:opacity-60"
            >
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {fenetre === 'creneaux' && premiereChoisie && (
        <FenetreCreneaux
          nombre={selection.size}
          depart={contenu(premiereChoisie)}
          jourTest={decouper(premiereChoisie)[1]}
          onFermer={() => setFenetre(null)}
          onAppliquer={(creneaux) => {
            remplir([...selection], creneaux)
            setSelection(new Set())
            setFenetre(null)
          }}
        />
      )}

      {fenetre === 'modeles' && (
        <FenetreModeles modeles={modeles} onFermer={() => setFenetre(null)} onChange={() => void chargerModeles()} />
      )}
    </Gabarit>
  )
}
