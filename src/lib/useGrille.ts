import { useCallback, useEffect, useMemo, useState } from 'react'
import { depuisHoraire, garderNotes, listeJours, memesCreneaux, versHoraire, type Creneau } from './creneaux'
import { dateDuJour, jourLocal, jourSuivant } from './dates'
import { supabase } from './supabase'
import { CHAMPS_HORAIRE, type Conge, type Horaire } from './types'

/** Une case de la grille = un employé, un jour : "id|2026-10-19". */
export const cle = (employe: string, jour: string) => `${employe}|${jour}`
export const decouper = (c: string) => c.split('|') as [string, string]

export type Message = { type: 'ok' | 'erreur'; texte: string }

/** Horaires rangés par case (le jour où l'horaire commence), décalés de `decalageJours` si besoin. */
export function parCase(horaires: Horaire[], decalageJours = 0) {
  const m: Record<string, Creneau[]> = {}
  for (const h of horaires) {
    const d = new Date(h.debut)
    d.setDate(d.getDate() + decalageJours)
    ;(m[cle(h.employe_id, jourLocal(d))] ??= []).push(depuisHoraire(h))
  }
  return m
}

/** Horaires dont le début est entre deux jours (fin exclue). */
export const lireHoraires = (de: string, a: string) =>
  supabase
    .from('shifts')
    .select(CHAMPS_HORAIRE)
    .gte('debut', dateDuJour(de).toISOString())
    .lt('debut', dateDuJour(a).toISOString())
    .order('debut')

/**
 * Données de la grille sur une période : horaires existants, congés, et changements en attente.
 * Rien n'est envoyé avant `enregistrer()`, qui envoie tout d'un coup.
 */
export function useGrille(premierJour: string, nbJours: number) {
  const jours = useMemo(() => listeJours(premierJour, nbJours), [premierJour, nbJours])
  const [existants, setExistants] = useState<Record<string, Creneau[]>>({})
  const [conges, setConges] = useState<Set<string>>(new Set())
  const [demandes, setDemandes] = useState<Set<string>>(new Set())
  const [maladies, setMaladies] = useState<Set<string>>(new Set())
  const plage = `${premierJour}|${nbJours}`
  const [plageChargee, setPlageChargee] = useState('')
  const [modifs, setModifs] = useState<Record<string, Creneau[]>>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const nbModifs = Object.keys(modifs).length

  const charger = useCallback(
    () =>
      Promise.all([
        lireHoraires(jours[0], jourSuivant(jours[jours.length - 1])),
        supabase
          .from('conges')
          .select('employe_id, debut, fin, statut')
          .neq('statut', 'refuse')
          .lte('debut', jours[jours.length - 1])
          .gte('fin', jours[0]),
        supabase
          .from('arrets_maladie')
          .select('employe_id, debut, fin')
          .lte('debut', jours[jours.length - 1])
          .gte('fin', jours[0]),
      ]).then(([h, c, m]) => {
        if (h.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger le planning. Réessayez.' })
        setExistants(parCase(h.data as Horaire[]))
        // Congés acceptés : cases verrouillées. Demandes en attente : simplement signalées.
        const acceptes = new Set<string>()
        const enAttente = new Set<string>()
        for (const x of (c.data ?? []) as Pick<Conge, 'employe_id' | 'debut' | 'fin' | 'statut'>[]) {
          for (let j = x.debut; j <= x.fin; j = jourSuivant(j)) (x.statut === 'accepte' ? acceptes : enAttente).add(cle(x.employe_id, j))
        }
        // Arrêts maladie : cases verrouillées aussi.
        const arrets = new Set<string>()
        for (const x of (m.data ?? []) as Pick<Conge, 'employe_id' | 'debut' | 'fin'>[]) {
          for (let j = x.debut; j <= x.fin; j = jourSuivant(j)) {
            arrets.add(cle(x.employe_id, j))
            acceptes.add(cle(x.employe_id, j))
          }
        }
        setConges(acceptes)
        setDemandes(enAttente)
        setMaladies(arrets)
        setPlageChargee(plage)
      }),
    [jours, plage],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  // Prévenir avant de quitter la page avec des changements non enregistrés.
  useEffect(() => {
    if (!nbModifs) return
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [nbModifs])

  const contenu = (c: string) => modifs[c] ?? existants[c] ?? []

  /**
   * Remplit des cases (chacune avec ses créneaux). Les jours de congé ne bougent pas, et une note
   * absente reprend celle déjà en place. Renvoie le nombre de cases qui changent vraiment.
   */
  function remplirCases(cases: [string, Creneau[]][]) {
    const utiles = cases.filter(([c, cr]) => !conges.has(c) && !memesCreneaux(garderNotes(cr, contenu(c)), contenu(c)))
    setModifs((avant) => {
      const apres = { ...avant }
      for (const [c, creneaux] of cases) {
        if (conges.has(c)) continue
        const nouveaux = garderNotes(creneaux, avant[c] ?? existants[c] ?? [])
        if (memesCreneaux(nouveaux, existants[c] ?? [])) delete apres[c]
        else apres[c] = nouveaux
      }
      return apres
    })
    return utiles.length
  }

  const remplir = (cles: string[], creneaux: Creneau[]) => remplirCases(cles.map((c) => [c, creneaux]))

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
    await charger()
    setModifs({})
    setMessage({ type: 'ok', texte: `Planning enregistré (${nbModifs} case${nbModifs > 1 ? 's' : ''}). Les employés sont prévenus.` })
  }

  return {
    jours,
    charge: plageChargee === plage,
    contenu,
    estConge: (c: string) => conges.has(c),
    estDemande: (c: string) => demandes.has(c),
    estMaladie: (c: string) => maladies.has(c),
    estModifiee: (c: string) => c in modifs,
    nbModifs,
    remplir,
    remplirCases,
    /** Oublie les changements en attente. */
    annuler: () => {
      setModifs({})
      setMessage(null)
    },
    enregistrer,
    envoi,
    message,
    setMessage,
  }
}

export type Grille = ReturnType<typeof useGrille>
