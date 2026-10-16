import { useState, type FormEvent } from 'react'
import { COULEURS_MODELES, erreurCreneaux, texteDetaille, type Creneau, type ModeleHoraire } from '../../lib/creneaux'
import { jourLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'
import EditeurCreneaux from './EditeurCreneaux'

interface Brouillon {
  id?: string
  nom: string
  code: string
  couleur: number
  creneaux: Creneau[]
}

// Jour pris pour vérifier les heures d'un horaire type (n'importe quel jour convient).
const JOUR_TEST = jourLocal(new Date())

const NEUF: Brouillon = {
  nom: '',
  code: '',
  couleur: 0,
  creneaux: [{ debut: '10:00', fin: '15:00', pauseDebut: '', pauseFin: '' }],
}

/** Horaires types de la grille : liste, ajout, modification, suppression. */
export default function FenetreModeles({
  modeles,
  onFermer,
  onChange,
}: {
  modeles: ModeleHoraire[]
  onFermer: () => void
  onChange: () => void
}) {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(modeles.length ? null : NEUF)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const erreurHeures = brouillon ? erreurCreneaux(JOUR_TEST, brouillon.creneaux) : null

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!brouillon || erreurHeures) return
    const code = brouillon.code.trim().toUpperCase()
    if (!/^[A-Z0-9]{1,2}$/.test(code)) return setErreur('La lettre doit faire 1 ou 2 caractères (lettres ou chiffres).')
    setEnvoi(true)
    setErreur(null)
    const ligne = { nom: brouillon.nom.trim(), code, couleur: brouillon.couleur, creneaux: brouillon.creneaux }
    const { error } = brouillon.id
      ? await supabase.from('modeles_horaires').update(ligne).eq('id', brouillon.id)
      : await supabase
          .from('modeles_horaires')
          .insert({ ...ligne, ordre: Math.max(0, ...modeles.map((m) => m.ordre)) + 1 })
    setEnvoi(false)
    if (error) {
      return setErreur(error.code === '23505' ? `La lettre ${code} est déjà prise.` : 'Enregistrement impossible.')
    }
    setBrouillon(null)
    onChange()
  }

  async function supprimer(m: ModeleHoraire) {
    if (!window.confirm(`Supprimer l'horaire type « ${m.nom} » ? Les horaires déjà planifiés ne changent pas.`)) return
    const { error } = await supabase.from('modeles_horaires').delete().eq('id', m.id)
    if (error) return setErreur('Suppression impossible.')
    onChange()
  }

  return (
    <Fenetre titre="Horaires types" onFermer={onFermer} large>
      {!brouillon && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gris">
            Ce sont les « pinceaux » de la grille. Dans une case, la lettre suffit pour le remplir au clavier.
          </p>
          <ul className="flex flex-col gap-2">
            {modeles.map((m) => {
              const c = COULEURS_MODELES[m.couleur] ?? COULEURS_MODELES[0]
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-ligne p-2.5">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border text-[15px] font-extrabold"
                    style={{ background: c.fond, color: c.texte, borderColor: c.lisere }}
                  >
                    {m.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{m.nom}</span>
                    <span className="block text-sm text-gris">{texteDetaille(m.creneaux)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setBrouillon({ ...m })}
                    className="h-10 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void supprimer(m)}
                    aria-label={`Supprimer ${m.nom}`}
                    className="flex size-10 items-center justify-center rounded-lg text-gris hover:bg-red-50 hover:text-[#9B1C1C]"
                  >
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={() => setBrouillon(NEUF)} className={boutonPrincipal}>
            + Nouvel horaire type
          </button>
        </div>
      )}

      {brouillon && (
        <form onSubmit={enregistrer} className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className={etiquette}>
              Nom
              <input
                required
                maxLength={30}
                placeholder="Ex. : Ouverture"
                value={brouillon.nom}
                onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
                className={champ}
              />
            </label>
            <label className={etiquette}>
              Lettre
              <input
                required
                maxLength={2}
                placeholder="O"
                value={brouillon.code}
                onChange={(e) => setBrouillon({ ...brouillon, code: e.target.value.toUpperCase() })}
                className={`${champ} text-center font-bold uppercase`}
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Couleur</legend>
            <div className="flex flex-wrap gap-2">
              {COULEURS_MODELES.map((c, i) => (
                <label key={i} className="cursor-pointer">
                  <input
                    type="radio"
                    name="couleur"
                    className="peer sr-only"
                    checked={brouillon.couleur === i}
                    onChange={() => setBrouillon({ ...brouillon, couleur: i })}
                  />
                  <span className="sr-only">Couleur {i + 1}</span>
                  <span
                    className="block size-10 rounded-lg border-2 peer-checked:ring-2 peer-checked:ring-encre peer-checked:ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-marque"
                    style={{ background: c.fond, borderColor: c.lisere }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <EditeurCreneaux valeur={brouillon.creneaux} onChange={(creneaux) => setBrouillon({ ...brouillon, creneaux })} />

          {(erreur || erreurHeures) && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur ?? erreurHeures}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => (modeles.length ? setBrouillon(null) : onFermer())}
              className={boutonSecondaire}
            >
              Annuler
            </button>
            <button type="submit" disabled={envoi || !!erreurHeures} className={boutonPrincipal}>
              {envoi ? 'Enregistrement…' : brouillon.id ? 'Enregistrer' : "Créer l'horaire type"}
            </button>
          </div>
        </form>
      )}

      {!brouillon && erreur && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {erreur}
        </p>
      )}
    </Fenetre>
  )
}
