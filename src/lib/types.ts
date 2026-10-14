export type Role = 'employe' | 'admin'

export interface Profil {
  id: string
  nom: string
  prenom: string
  role: Role
  actif: boolean
}
