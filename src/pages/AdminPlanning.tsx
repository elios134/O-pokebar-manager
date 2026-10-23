import { useCallback, useEffect, useState, type ButtonHTMLAttributes } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BasGrille from '../components/grille/BasGrille'
import type { ActionsCase, CaseGrille } from '../components/grille/Cellule'
import FenetreCreneaux from '../components/grille/FenetreCreneaux'
import FenetreModeles from '../components/grille/FenetreModeles'
import Palette, { GOMME } from '../components/grille/Palette'
import SemaineType from '../components/grille/SemaineType'
import TableauEmploye, { type SemaineEmploye } from '../components/grille/TableauEmploye'
import TableauGrille, { type LigneGrille } from '../components/grille/TableauGrille'
import Gabarit from '../components/Gabarit'
import { couleurDe, initiales } from '../lib/couleurs'
import {
  CHAMPS_MODELE,
  dureeCreneaux,
  memesHeures,
  normaliserCreneaux,
  normaliserSemaineType,
  texteHeures,
  type Creneau,
  type ModeleHoraire,
  type SemaineType as Semaine,
} from '../lib/creneaux'
import { dateDuJour, debutSemaine, jourLocal, lienImpression, nbJours, numeroSemaine } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_PROFIL, type Equipe, type Horaire, type Profil } from '../lib/types'
import { cle, decouper, lireHoraires, parCase, useGrille } from '../lib/useGrille'

type ProfilGrille = Profil & { semaine_type: Semaine | null }

const fmtJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

const premierDuMois = (d: Date) => jourLocal(new Date(d.getFullYear(), d.getMonth(), 1))
const decaler = (jour: string, nb: number) => {
  const d = dateDuJour(jour)
  d.setDate(d.getDate() + nb)
  return jourLocal(d)
}

/** Semaines entières (lundi → dimanche) qui couvrent le mois. */
function plageDuMois(mois: string) {
  const premier = dateDuJour(mois)
  const dernier = new Date(premier.getFullYear(), premier.getMonth() + 1, 0)
  const debut = jourLocal(debutSemaine(premier))
  const fin = decaler(jourLocal(debutSemaine(dernier)), 6)
  return { premier: debut, nb: nbJours(debut, fin) }
}

function Fleche({ sens, ...p }: { sens: 'gauche' | 'droite' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-fond" {...p}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={sens === 'gauche' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  )
}

/**
 * Planning de l'équipe pour l'admin, façon tableur, rempli avec des horaires types.
 * Deux vues : toute l'équipe sur une semaine, ou un employé sur une semaine ou un mois.
 */
export default function AdminPlanning() {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const vue = params.get('vue') === 'employe' ? 'employe' : 'equipe'
  const [lundi, setLundi] = useState(() => jourLocal(debutSemaine(new Date())))
  const [periode, setPeriode] = useState<'semaine' | 'mois'>('mois')
  const [mois, setMois] = useState(() => premierDuMois(new Date()))
  const [profils, setProfils] = useState<ProfilGrille[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [modeles, setModeles] = useState<ModeleHoraire[]>([])
  const [equipe, setEquipe] = useState('')
  const [filtreEmploye, setFiltreEmploye] = useState('')
  const [pinceau, setPinceau] = useState<string | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [fenetre, setFenetre] = useState<'creneaux' | 'modeles' | null>(null)

  const parMois = vue === 'employe' && periode === 'mois'
  const plage = parMois ? plageDuMois(mois) : { premier: lundi, nb: 7 }
  const grille = useGrille(plage.premier, plage.nb)
  const { jours, contenu, setMessage } = grille

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
      supabase.from('profiles').select(`${CHAMPS_PROFIL}, semaine_type`).eq('actif', true).order('prenom'),
      supabase.from('equipes').select('id, nom').order('nom'),
      chargerModeles(),
    ]).then(([p, e]) => {
      if (p.error) setMessage({ type: 'erreur', texte: 'Impossible de charger les employés.' })
      else {
        setProfils(
          (p.data as (Profil & { semaine_type: unknown })[]).map((x) => ({
            ...x,
            heures_contrat: x.heures_contrat == null ? null : Number(x.heures_contrat),
            semaine_type: normaliserSemaineType(x.semaine_type),
          })),
        )
      }
      setEquipes((e.data ?? []) as Equipe[])
    })
  }, [chargerModeles, setMessage])

  // ---------- Remplir les cases (commun aux deux vues) ----------
  const modeleDe = (creneaux: Creneau[]) => (creneaux.length ? modeles.find((m) => memesHeures(m.creneaux, creneaux)) : undefined)
  const creneauxDuPinceau = (p: string) => (p === GOMME ? [] : modeles.find((m) => m.id === p)?.creneaux)

  function caseDe(employe: string, jour: string): CaseGrille {
    const c = cle(employe, jour)
    const creneaux = contenu(c)
    return {
      cle: c,
      jour,
      creneaux,
      modele: modeleDe(creneaux),
      conge: grille.estConge(c),
      maladie: grille.estMaladie(c),
      modifiee: grille.estModifiee(c),
      congeDemande: grille.estDemande(c),
      choisie: selection.has(c),
    }
  }

  function peindre(c: CaseGrille) {
    const creneaux = pinceau ? creneauxDuPinceau(pinceau) : undefined
    if (creneaux) grille.remplir([c.cle], creneaux)
  }

  /** Plusieurs cases d'un coup (une semaine, une colonne) : pinceau s'il y en a un, sinon sélection. */
  function toucherPlusieurs(cases: CaseGrille[]) {
    const cles = cases.filter((c) => !c.conge).map((c) => c.cle)
    const creneaux = pinceau ? creneauxDuPinceau(pinceau) : undefined
    if (creneaux) grille.remplir(cles, creneaux)
    else setSelection((s) => new Set([...s, ...cles]))
  }

  const actions: ActionsCase = {
    onClic: (c) => {
      if (pinceau) return peindre(c)
      setSelection((s) => {
        const n = new Set(s)
        if (n.has(c.cle)) n.delete(c.cle)
        else n.add(c.cle)
        return n
      })
    },
    onAppui: peindre,
    onGlisser: peindre,
    // Au clavier : la lettre d'un horaire type remplit la case (ou toute la sélection si la case en fait partie).
    onTouche: (c, touche) => {
      const cibles = selection.has(c.cle) ? [...selection] : [c.cle]
      if (touche === 'Delete' || touche === 'Backspace') {
        grille.remplir(cibles, [])
        return true
      }
      const m = modeles.find((x) => x.code === touche.toUpperCase())
      if (!m) return false
      grille.remplir(cibles, m.creneaux)
      if (cibles.length > 1) setSelection(new Set())
      return true
    },
  }

  function choisirPalette(id: string) {
    if (selection.size) {
      grille.remplir([...selection], creneauxDuPinceau(id) ?? [])
      setSelection(new Set())
      return
    }
    setPinceau((p) => (p === id ? null : id))
  }

  /** Changer de période ou de vue : on demande avant de perdre des changements non enregistrés. */
  function changerPlage(changer: () => void) {
    if (grille.nbModifs && !window.confirm('Des changements ne sont pas enregistrés. Les abandonner ?')) return
    grille.annuler()
    setSelection(new Set())
    changer()
  }

  const voirEmploye = (id: string) => changerPlage(() => setParams({ vue: 'employe', employe: id }))

  // ---------- Vue équipe ----------
  const membres = profils.filter((p) => (!equipe ? true : equipe === 'aucune' ? !p.equipe_id : p.equipe_id === equipe))
  const visibles = membres.filter((p) => !filtreEmploye || p.id === filtreEmploye)

  async function copierSemainePrecedente() {
    const { data, error } = await lireHoraires(decaler(lundi, -7), lundi)
    if (error) return setMessage({ type: 'erreur', texte: 'Impossible de lire la semaine précédente.' })
    const avant = parCase(data as Horaire[], 7)
    const n = grille.remplirCases(visibles.flatMap((p) => jours.map((j): [string, Creneau[]] => [cle(p.id, j), avant[cle(p.id, j)] ?? []])))
    setMessage({
      type: 'ok',
      texte: n
        ? `Semaine précédente copiée : ${n} case${n > 1 ? 's' : ''} modifiée${n > 1 ? 's' : ''}. Vérifiez puis enregistrez.`
        : 'Rien à copier : la semaine est déjà identique à la précédente.',
    })
  }

  function vueEquipe() {
    const groupes = [...equipes.map((e) => ({ id: e.id as string | null, nom: e.nom })), { id: null, nom: 'Sans équipe' }]
      .map((g) => ({
        nom: g.nom,
        lignes: visibles
          .filter((p) => p.equipe_id === g.id)
          .map((p): LigneGrille => {
            const cases = jours.map((j) => caseDe(p.id, j))
            return {
              id: p.id,
              nom: `${p.prenom} ${p.nom}`,
              initiales: initiales(p.prenom, p.nom),
              couleur: couleurDe(profils.indexOf(p)),
              total: cases.reduce((t, c) => t + dureeCreneaux(c.jour, c.creneaux), 0),
              contrat: p.heures_contrat,
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
    if (!groupes.length) return <p className="rounded-2xl border border-ligne bg-white p-5 text-gris">Aucun employé dans cette équipe.</p>
    return (
      <TableauGrille
        jours={jours}
        groupes={groupes}
        pied={pied}
        totalSemaine={pied.reduce((t, p) => t + p.heures, 0)}
        actions={actions}
        onEmploye={voirEmploye}
      />
    )
  }

  // ---------- Vue employé ----------
  const emp = profils.find((p) => p.id === params.get('employe')) ?? profils[0]
  const moisCourant = dateDuJour(mois).getMonth()

  function changerEmploye(id: string) {
    setSelection(new Set())
    setParams({ vue: 'employe', employe: id })
  }

  async function enregistrerSemaineType(e: ProfilGrille, s: Semaine) {
    setProfils((liste) => liste.map((p) => (p.id === e.id ? { ...p, semaine_type: s } : p)))
    const { error } = await supabase.from('profiles').update({ semaine_type: s }).eq('id', e.id)
    if (error) setMessage({ type: 'erreur', texte: 'La semaine type n’a pas pu être enregistrée.' })
  }

  function appliquerSemaineType(e: ProfilGrille, seulementVides: boolean) {
    const type = e.semaine_type
    if (!type) return
    const n = grille.remplirCases(
      jours
        .filter((j) => !parMois || dateDuJour(j).getMonth() === moisCourant)
        .filter((j) => !seulementVides || !contenu(cle(e.id, j)).length)
        .map((j): [string, Creneau[]] => [cle(e.id, j), type[(dateDuJour(j).getDay() + 6) % 7]]),
    )
    setMessage({
      type: 'ok',
      texte: n
        ? `Semaine type appliquée : ${n} jour${n > 1 ? 's' : ''} modifié${n > 1 ? 's' : ''}. Vérifiez puis enregistrez.`
        : 'Rien à changer : les jours correspondent déjà à la semaine type.',
    })
  }

  function vueEmploye(e: ProfilGrille) {
    const semaines: SemaineEmploye[] = []
    let totalPeriode = 0
    let joursTravailles = 0
    for (let i = 0; i < jours.length; i += 7) {
      const sept = jours.slice(i, i + 7)
      let total = 0
      const cases = sept.map((j) => {
        const c = caseDe(e.id, j)
        const horsPeriode = parMois && dateDuJour(j).getMonth() !== moisCourant
        if (!horsPeriode && c.creneaux.length) {
          total += dureeCreneaux(j, c.creneaux)
          joursTravailles++
        }
        return { c, numero: dateDuJour(j).getDate(), horsPeriode }
      })
      totalPeriode += total
      semaines.push({
        lundi: sept[0],
        nom: `Sem. ${numeroSemaine(dateDuJour(sept[0]))}`,
        dates: `${fmtCourt.format(dateDuJour(sept[0]))} – ${fmtCourt.format(dateDuJour(sept[6]))}`,
        cases,
        total,
      })
    }
    const actives = (cases: SemaineEmploye['cases']) => cases.filter((x) => !x.horsPeriode).map((x) => x.c)

    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <TableauEmploye
            semaines={semaines}
            nom={`${e.prenom} ${e.nom}`}
            contrat={e.heures_contrat}
            mois={parMois}
            totalPeriode={totalPeriode}
            joursTravailles={joursTravailles}
            actions={actions}
            onSemaine={(s) => toucherPlusieurs(actives(s.cases))}
            onColonne={(i) => toucherPlusieurs(actives(semaines.map((s) => s.cases[i])))}
          />
        </div>
        <div className="lg:w-80 lg:shrink-0">
          <SemaineType
            prenom={e.prenom}
            valeur={e.semaine_type}
            modeles={modeles}
            pinceau={pinceau ? () => creneauxDuPinceau(pinceau) : null}
            mois={parMois}
            onChange={(s) => void enregistrerSemaineType(e, s)}
            onAppliquer={(vides) => appliquerSemaineType(e, vides)}
          />
        </div>
      </div>
    )
  }

  // ---------- Navigation ----------
  function deplacer(sens: -1 | 1 | 0) {
    changerPlage(() => {
      if (sens === 0) {
        setLundi(jourLocal(debutSemaine(new Date())))
        setMois(premierDuMois(new Date()))
      } else if (parMois) {
        const d = dateDuJour(mois)
        setMois(premierDuMois(new Date(d.getFullYear(), d.getMonth() + sens, 1)))
      } else setLundi(decaler(lundi, sens * 7))
    })
  }

  function changerPeriode(p: 'semaine' | 'mois') {
    if (p === periode) return
    changerPlage(() => {
      if (p === 'mois') setMois(premierDuMois(dateDuJour(lundi)))
      else {
        // Semaine en cours si elle est dans le mois affiché, sinon la première semaine du mois.
        const cetteSemaine = jourLocal(debutSemaine(new Date()))
        const dansLeMois = [cetteSemaine, decaler(cetteSemaine, 6)].some((j) => dateDuJour(j).getMonth() === moisCourant)
        setLundi(dansLeMois ? cetteSemaine : jourLocal(debutSemaine(dateDuJour(mois))))
      }
      setPeriode(p)
    })
  }

  const premiereChoisie = [...selection][0]
  const finSemaine = decaler(lundi, 6)
  const titrePeriode = parMois
    ? fmtMois.format(dateDuJour(mois)).replace(/^./, (c) => c.toUpperCase())
    : vue === 'employe'
      ? `Sem. ${numeroSemaine(dateDuJour(lundi))} · ${fmtCourt.format(dateDuJour(lundi))} – ${fmtCourt.format(dateDuJour(finSemaine))}`
      : `${fmtJourMois.format(dateDuJour(lundi))} – ${fmtJourMois.format(dateDuJour(finSemaine))}`

  const lienPdf =
    vue === 'equipe'
      ? lienImpression(dateDuJour(lundi), { periode: 'semaine', equipe: equipe || undefined, employe: filtreEmploye || undefined })
      : lienImpression(dateDuJour(parMois ? mois : lundi), { periode, employe: emp?.id })

  const onglet = (actif: boolean) =>
    `h-10 flex-1 rounded-[9px] px-4 text-sm sm:flex-none ${
      actif ? 'bg-white font-bold text-encre shadow-[0_1px_3px_rgba(22,24,29,0.12)]' : 'font-semibold text-[#4A5060]'
    }`

  return (
    <Gabarit
      titre="Planning de l'équipe"
      actions={
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div role="group" aria-label="Affichage" className="flex flex-1 rounded-xl bg-[#E8E9EE] p-1 sm:flex-none">
            <button type="button" aria-pressed={vue === 'equipe'} onClick={() => vue !== 'equipe' && changerPlage(() => setParams({}))} className={onglet(vue === 'equipe')}>
              <span className="sm:hidden">Équipe</span>
              <span className="hidden sm:inline">Toute l'équipe</span>
            </button>
            <button type="button" aria-pressed={vue === 'employe'} onClick={() => emp && vue !== 'employe' && voirEmploye(emp.id)} className={onglet(vue === 'employe')}>
              <span className="sm:hidden">Employé</span>
              <span className="hidden sm:inline">Par employé</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => naviguer(lienPdf)}
            className="flex h-12 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
          >
            Exporter en PDF
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-40 sm:pb-24">
        <div className="flex flex-wrap items-center gap-2">
          {vue === 'employe' && emp && (
            <div className="flex items-center gap-1 rounded-xl border border-ligne bg-white p-1">
              <Fleche
                sens="gauche"
                aria-label="Employé précédent"
                onClick={() => changerEmploye(profils[(profils.indexOf(emp) + profils.length - 1) % profils.length].id)}
              />
              <span
                className="hidden size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:flex"
                style={{ background: couleurDe(profils.indexOf(emp)).fond, color: couleurDe(profils.indexOf(emp)).texte }}
              >
                {initiales(emp.prenom, emp.nom)}
              </span>
              <span className="flex min-w-0 flex-col px-1">
                <label htmlFor="vue-employe" className="sr-only">
                  Employé
                </label>
                <select
                  id="vue-employe"
                  value={emp.id}
                  onChange={(ev) => changerEmploye(ev.target.value)}
                  className="max-w-[10rem] bg-transparent font-extrabold sm:max-w-none"
                >
                  {profils.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gris">
                  {emp.heures_contrat ? `Contrat ${texteHeures(emp.heures_contrat)} / sem.` : 'Contrat non renseigné'}
                </span>
              </span>
              <Fleche sens="droite" aria-label="Employé suivant" onClick={() => changerEmploye(profils[(profils.indexOf(emp) + 1) % profils.length].id)} />
            </div>
          )}

          {vue === 'employe' && (
            <div role="group" aria-label="Période" className="flex rounded-xl bg-[#E8E9EE] p-1">
              <button type="button" aria-pressed={periode === 'semaine'} onClick={() => changerPeriode('semaine')} className={onglet(periode === 'semaine')}>
                Semaine
              </button>
              <button type="button" aria-pressed={periode === 'mois'} onClick={() => changerPeriode('mois')} className={onglet(periode === 'mois')}>
                Mois
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-ligne bg-white p-1">
            <Fleche sens="gauche" aria-label={parMois ? 'Mois précédent' : 'Semaine précédente'} onClick={() => deplacer(-1)} />
            <button type="button" onClick={() => deplacer(0)} title="Revenir à aujourd'hui" className="h-10 rounded-lg px-2 font-bold whitespace-nowrap hover:bg-fond">
              {titrePeriode}
            </button>
            <Fleche sens="droite" aria-label={parMois ? 'Mois suivant' : 'Semaine suivante'} onClick={() => deplacer(1)} />
          </div>

          {vue === 'equipe' && (
            <>
              <label htmlFor="grille-equipe" className="sr-only">
                Équipe
              </label>
              <select
                id="grille-equipe"
                value={equipe}
                onChange={(ev) => {
                  setEquipe(ev.target.value)
                  setFiltreEmploye('')
                  setSelection(new Set())
                }}
                className="h-12 rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-semibold"
              >
                <option value="">Toutes les équipes</option>
                {equipes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
                <option value="aucune">Sans équipe</option>
              </select>
              <label htmlFor="grille-employe" className="sr-only">
                Employé
              </label>
              <select
                id="grille-employe"
                value={filtreEmploye}
                onChange={(ev) => {
                  setFiltreEmploye(ev.target.value)
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
            </>
          )}
        </div>

        <Palette modeles={modeles} pinceau={pinceau} selection={selection.size} onChoisir={choisirPalette} onGerer={() => setFenetre('modeles')} />

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

        {grille.message && (
          <p
            role={grille.message.type === 'erreur' ? 'alert' : 'status'}
            className={`rounded-lg px-3 py-2 text-sm ${grille.message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
          >
            {grille.message.texte}
          </p>
        )}

        {!grille.charge || !profils.length ? <p className="text-gris">Chargement…</p> : vue === 'equipe' ? vueEquipe() : emp && vueEmploye(emp)}

        <p className="hidden text-[13px] text-gris sm:block">
          <b className="text-encre">Au clavier :</b> flèches pour se déplacer, la lettre d'un horaire type pour remplir la case,
          Suppr pour la vider. Les congés acceptés sont grisés et ne peuvent pas être remplis. Point rouge : pas encore
          enregistré · point orange : demande de congé en attente.
        </p>
      </div>

      <BasGrille
        selection={selection.size}
        modeles={modeles}
        nbModifs={grille.nbModifs}
        envoi={grille.envoi}
        onChoisir={choisirPalette}
        onHeures={() => setFenetre('creneaux')}
        onAnnulerSelection={() => setSelection(new Set())}
        onAnnuler={grille.annuler}
        onEnregistrer={() => void grille.enregistrer()}
      />

      {fenetre === 'creneaux' && premiereChoisie && (
        <FenetreCreneaux
          nombre={selection.size}
          depart={contenu(premiereChoisie)}
          jourTest={decouper(premiereChoisie)[1]}
          onFermer={() => setFenetre(null)}
          onAppliquer={(creneaux) => {
            grille.remplir([...selection], creneaux)
            setSelection(new Set())
            setFenetre(null)
          }}
        />
      )}

      {fenetre === 'modeles' && <FenetreModeles modeles={modeles} onFermer={() => setFenetre(null)} onChange={() => void chargerModeles()} />}
    </Gabarit>
  )
}
