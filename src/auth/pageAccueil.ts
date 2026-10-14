import type { Role } from '../lib/types'

export function pageAccueil(role: Role) {
  return role === 'admin' ? '/admin/planning' : '/mon-planning'
}
