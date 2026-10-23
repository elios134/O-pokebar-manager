import { useState, type FormEvent } from 'react'
import { lireMontant } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'

/** L'admin saisit lui-même un acompte (déjà accepté) pour un employé. */
export default function FenetreAjoutAcompte({
  employes,
  onFermer,
  onAjoute,
}: {
  employes: Profil[]
  onFermer: () => void
  onAjoute: (texte: string) => void
}) {
  const [employe, setEmploye] = useState('')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const valeur = lireMontant(montant)
  const valide = !!employe && valeur > 0 && valeur <= 10000

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    const { error } = await supabase
      .from('acomptes')
      .insert({ employe_id: employe, montant: Math.round(valeur * 100) / 100, motif: motif.trim() || null, statut: 'accepte' })
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible. Réessayez.')
    const p = employes.find((x) => x.id === employe)
    onAjoute(`Acompte de ${p?.prenom ?? "l'employé"} enregistré.`)
  }

  return (
    <Fenetre titre="Ajouter un acompte" onFermer={onFermer}>
      <form onSubmit={ajouter} className="flex flex-col gap-4">
        <p className="text-sm text-gris">Pour un acompte déjà décidé (donné de la main à la main, demandé à l'oral…) : il est enregistré comme accepté.</p>
        <label className={etiquette}>
          Employé
          <select required value={employe} onChange={(e) => setEmploye(e.target.value)} className={champ}>
            <option value="">Choisir un employé…</option>
            {employes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label className={etiquette}>
          Montant (€)
          <input
            type="text"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex. : 200"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Motif (facultatif)
          <input
            type="text"
            maxLength={300}
            placeholder="Ex. : avance en liquide"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={champ}
          />
        </label>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !valide} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : "Enregistrer l'acompte"}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
