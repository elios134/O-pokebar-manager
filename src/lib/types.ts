export type Role = 'employe' | 'admin'

export interface Profil {
  id: string
  nom: string
  prenom: string
  role: Role
  actif: boolean
  email: string
}

export interface Horaire {
  id: string
  employe_id: string
  debut: string
  fin: string
  note: string | null
  pause_minutes: number
}
