import type { StatutConge } from '../lib/types'

const STYLES: Record<StatutConge, { texte: string; classe: string }> = {
  en_attente: { texte: 'En attente', classe: 'bg-[#FFF1C2] text-[#6B4E00]' },
  accepte: { texte: 'Accepté', classe: 'bg-[#DDF5E6] text-[#145C32]' },
  refuse: { texte: 'Refusé', classe: 'bg-[#FDE2E2] text-[#9B1C1C]' },
}

export default function BadgeStatut({ statut }: { statut: StatutConge }) {
  const s = STYLES[statut]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${s.classe}`}>{s.texte}</span>
}
