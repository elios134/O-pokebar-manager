import { useState, type FormEvent } from 'react'
import { erreurCreneaux, type Creneau } from '../../lib/creneaux'
import Fenetre, { boutonPrincipal, boutonSecondaire } from '../Fenetre'
import EditeurCreneaux from './EditeurCreneaux'

/** « Autre horaire… » : des heures libres pour les cases choisies. */
export default function FenetreCreneaux({
  nombre,
  depart,
  jourTest,
  onFermer,
  onAppliquer,
}: {
  nombre: number
  depart: Creneau[]
  jourTest: string
  onFermer: () => void
  onAppliquer: (c: Creneau[]) => void
}) {
  const [creneaux, setCreneaux] = useState<Creneau[]>(
    depart.length ? depart : [{ debut: '09:00', fin: '17:00', pauseDebut: '', pauseFin: '' }],
  )
  const erreur = erreurCreneaux(jourTest, creneaux)

  function valider(e: FormEvent) {
    e.preventDefault()
    if (!erreur) onAppliquer(creneaux)
  }

  return (
    <Fenetre titre="Autre horaire" onFermer={onFermer}>
      <form onSubmit={valider} className="flex flex-col gap-4">
        <p className="text-sm text-gris">
          Pour {nombre > 1 ? `les ${nombre} cases choisies` : 'la case choisie'}. Rien n'est enregistré tant que vous
          n'appuyez pas sur « Enregistrer ».
        </p>
        <EditeurCreneaux valeur={creneaux} onChange={setCreneaux} />
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={!!erreur} className={boutonPrincipal}>
            Remplir {nombre > 1 ? `les ${nombre} cases` : 'la case'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
