export type Role = 'employe' | 'cuisine' | 'admin'

/** Rôles qui ont accès à l'espace Cuisine (DLC, températures, commandes). */
export const accesCuisine = (role?: Role) => role === 'cuisine' || role === 'admin'

export const NOMS_ROLES: Record<Role, string> = { employe: 'Employé', cuisine: 'Cuisine', admin: 'Admin' }

export interface Profil {
  id: string
  nom: string
  prenom: string
  role: Role
  actif: boolean
  email: string
  equipe_id: string | null
  heures_contrat: number | null // heures par semaine prévues au contrat
}

export interface Equipe {
  id: string
  nom: string
}

export interface Horaire {
  id: string
  employe_id: string
  debut: string
  fin: string
  note: string | null
  pause_minutes: number
  pause_debut: string | null
  pause_fin: string | null
}

export type StatutConge = 'en_attente' | 'accepte' | 'refuse'

export interface Conge {
  id: string
  employe_id: string
  debut: string // "2026-11-02"
  fin: string
  motif: string | null
  statut: StatutConge
  reponse: string | null
  cree_le: string
  traite_le: string | null
}

export const CHAMPS_PROFIL = 'id, nom, prenom, role, actif, email, equipe_id, heures_contrat'
export const CHAMPS_HORAIRE = 'id, employe_id, debut, fin, note, pause_minutes, pause_debut, pause_fin'
export interface Acompte {
  id: string
  employe_id: string
  montant: number
  motif: string | null
  statut: StatutConge
  reponse: string | null
  cree_le: string
  traite_le: string | null
}

export const CHAMPS_ACOMPTE = 'id, employe_id, montant, motif, statut, reponse, cree_le, traite_le'
export const CHAMPS_CONGE = 'id, employe_id, debut, fin, motif, statut, reponse, cree_le, traite_le'
