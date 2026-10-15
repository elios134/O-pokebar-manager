import type { EventInput } from '@fullcalendar/core'
import { couleurDe, type Couleur } from './couleurs'
import { jourSuivant, textePause } from './dates'
import type { Conge, Horaire, Profil } from './types'

export type FiltrePlanning = { equipe: string; employe: string }

/** Transforme horaires et congés en événements du calendrier admin, selon le filtre équipe / employé. */
export function evenementsPlanning(
  horaires: Horaire[],
  conges: Conge[],
  profils: Profil[],
  couleurs: Map<string, Couleur>,
  { equipe, employe }: FiltrePlanning,
): EventInput[] {
  const profil = (id: string) => profils.find((x) => x.id === id)
  // Filtre : équipe choisie (ou toutes), puis employé choisi (ou tous).
  const visible = (id: string) =>
    (!employe || id === employe) &&
    (!equipe || (equipe === 'aucune' ? !profil(id)?.equipe_id : profil(id)?.equipe_id === equipe))
  const nomCourt = (id: string) => {
    const p = profil(id)
    return p ? `${p.prenom} ${p.nom.charAt(0)}.` : 'Employé'
  }

  // Congés : sur la ligne « Congés » en haut du calendrier.
  const evenementsConges: EventInput[] = conges
    .filter((c) => visible(c.employe_id))
    .map((c) => {
      const couleur = couleurs.get(c.employe_id) ?? couleurDe(0)
      const accepte = c.statut === 'accepte'
      return {
        id: `conge-${c.id}`,
        title: `${accepte ? 'Congé' : 'Congé demandé'} · ${nomCourt(c.employe_id)}`,
        start: c.debut,
        end: jourSuivant(c.fin),
        allDay: true,
        editable: false,
        backgroundColor: accepte ? couleur.trait : '#FFFFFF',
        borderColor: couleur.trait,
        textColor: accepte ? '#FFFFFF' : couleur.texte,
        classNames: accepte ? ['conge'] : ['conge', 'conge-attente'],
        extendedProps: { conge: c },
      }
    })

  const evenementsHoraires: EventInput[] = horaires
    .filter((h) => visible(h.employe_id))
    .map((h) => {
      const c = couleurs.get(h.employe_id) ?? couleurDe(0)
      return {
        id: h.id,
        title: [nomCourt(h.employe_id), h.note, textePause(h)].filter(Boolean).join(' · '),
        start: h.debut,
        end: h.fin,
        backgroundColor: c.fond,
        borderColor: c.trait,
        textColor: c.texte,
        extendedProps: { horaire: h, pause: h.pause_debut ? { debut: h.pause_debut, fin: h.pause_fin } : null },
      }
    })

  return [...evenementsConges, ...evenementsHoraires]
}
