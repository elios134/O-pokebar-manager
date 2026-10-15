import { useId, useState } from 'react'
import { champ, etiquette } from './Fenetre'
import { IconeOeil, IconeOeilBarre } from './Icones'

/** Champ mot de passe avec bouton œil pour l'afficher ou le masquer. */
export default function ChampMotDePasse({
  libelle,
  valeur,
  onChange,
  autoComplete,
  minLength,
  aide,
}: {
  libelle: string
  valeur: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  aide?: string
}) {
  const id = useId()
  const [voir, setVoir] = useState(false)
  return (
    <div className={etiquette}>
      <label htmlFor={id}>{libelle}</label>
      <div className="relative">
        <input
          id={id}
          type={voir ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className={`${champ} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVoir((v) => !v)}
          aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={voir}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-gris hover:text-encre"
        >
          {voir ? <IconeOeilBarre width={20} height={20} /> : <IconeOeil width={20} height={20} />}
        </button>
      </div>
      {aide && <span className="text-xs font-medium text-gris">{aide}</span>}
    </div>
  )
}
