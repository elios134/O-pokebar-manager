// Une couleur par employé (fond clair, texte foncé, trait), comme sur les maquettes.
const PALETTE = [
  { fond: '#DCEBFF', texte: '#1E4E8C', trait: '#3B76C4' },
  { fond: '#FFE6CC', texte: '#7A3B00', trait: '#D9822B' },
  { fond: '#D5F2EA', texte: '#0F5C49', trait: '#2A9D7E' },
  { fond: '#ECE3FF', texte: '#4C2A99', trait: '#7C5CD6' },
  { fond: '#FDE2EC', texte: '#8C1D4A', trait: '#D6457E' },
  { fond: '#E4F4D0', texte: '#3B5A12', trait: '#6E9F2E' },
  { fond: '#FFF1C2', texte: '#6B4E00', trait: '#C9A227' },
  { fond: '#D9F1FB', texte: '#0B5068', trait: '#2C93B8' },
]

export type Couleur = (typeof PALETTE)[number]

export function couleurDe(index: number): Couleur {
  return PALETTE[index % PALETTE.length]
}

export function initiales(prenom: string, nom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?'
}
