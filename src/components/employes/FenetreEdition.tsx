import { useState, type FormEvent } from 'react'
import { gererEmploye } from '../../lib/fonctions'
import { motDePasseProvisoire } from '../../lib/motDePasse'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'
import FormulaireEmail from '../FormulaireEmail'

/** Modifier le nom et l'email d'un employé, lui donner un nouveau mot de passe, ou supprimer son compte. */
export default function FenetreEdition({
  profil,
  soiMeme,
  onFermer,
  onFait,
}: {
  profil: Profil
  soiMeme: boolean
  onFermer: () => void
  onFait: (message: string) => void
}) {
  const [prenom, setPrenom] = useState(profil.prenom)
  const [nom, setNom] = useState(profil.nom)
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  async function supprimer() {
    setEnvoi(true)
    setErreur(null)
    const err = await gererEmploye({ action: 'supprimer', id: profil.id })
    setEnvoi(false)
    if (err) return setErreur(err)
    onFait(`Compte de ${profil.prenom} ${profil.nom} supprimé.`)
  }

  async function enregistrerNom(e: FormEvent) {
    e.preventDefault()
    if (!prenom.trim() || !nom.trim()) return
    setEnvoi(true)
    setErreur(null)
    const { error } = await supabase
      .from('profiles')
      .update({ prenom: prenom.trim(), nom: nom.trim() })
      .eq('id', profil.id)
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible.')
    onFait(`Nom enregistré : ${prenom.trim()} ${nom.trim()}.`)
  }

  async function changerMdp(e: FormEvent) {
    e.preventDefault()
    if (mdp.length < 8) return
    setEnvoi(true)
    setErreur(null)
    const err = await gererEmploye({ action: 'motdepasse', id: profil.id, motDePasse: mdp })
    setEnvoi(false)
    if (err) return setErreur(err)
    onFait(`Nouveau mot de passe de ${profil.prenom} : ${mdp} — donnez-le-lui, il pourra le changer dans « Mon compte ».`)
  }

  return (
    <Fenetre titre={`Modifier ${profil.prenom} ${profil.nom}`} onFermer={onFermer}>
      <form onSubmit={enregistrerNom} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Prénom
            <input required value={prenom} maxLength={60} onChange={(e) => setPrenom(e.target.value)} className={champ} />
          </label>
          <label className={etiquette}>
            Nom
            <input required value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} className={champ} />
          </label>
        </div>
        <button
          type="submit"
          disabled={envoi || !prenom.trim() || !nom.trim() || (prenom === profil.prenom && nom === profil.nom)}
          className={boutonPrincipal}
        >
          Enregistrer le nom
        </button>
      </form>

      <div className="mt-6 border-t border-ligne pt-5">
        <FormulaireEmail
          id={profil.id}
          emailActuel={profil.email}
          onChange={(r) => (r.type === 'ok' ? onFait(r.texte) : setErreur(r.texte))}
        />
      </div>

      {!soiMeme && (
        <form onSubmit={changerMdp} className="mt-6 flex flex-col gap-3 border-t border-ligne pt-5">
          <h3 className="font-bold">Mot de passe oublié ?</h3>
          <p className="text-sm text-gris">Donnez-lui un nouveau mot de passe. Il pourra ensuite le changer dans « Mon compte ».</p>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="nouveau-mdp">
              Nouveau mot de passe
            </label>
            <input
              id="nouveau-mdp"
              type="text"
              minLength={8}
              required
              autoComplete="off"
              placeholder="8 caractères minimum"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              className={`${champ} flex-1`}
            />
            <button type="button" onClick={() => setMdp(motDePasseProvisoire())} className={`${boutonSecondaire} shrink-0`}>
              Générer
            </button>
          </div>
          <button type="submit" disabled={envoi || mdp.length < 8} className={boutonSecondaire}>
            Donner ce mot de passe
          </button>
        </form>
      )}

      {!soiMeme && (
        <div className="mt-6 flex flex-col gap-3 border-t border-ligne pt-5">
          <h3 className="font-bold text-[#9B1C1C]">Supprimer le compte</h3>
          {!confirmerSuppression ? (
            <>
              <p className="text-sm text-gris">
                Supprime définitivement le compte, ses horaires et ses congés. Pour garder l'historique, utilisez plutôt
                « Désactiver ».
              </p>
              <button
                type="button"
                onClick={() => setConfirmerSuppression(true)}
                className="h-11 rounded-xl border border-[#F1B4B4] font-bold text-[#9B1C1C] hover:bg-red-50"
              >
                Supprimer {profil.prenom} {profil.nom}
              </button>
            </>
          ) : (
            <>
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                Vraiment supprimer {profil.prenom} {profil.nom} ? Cette action ne peut pas être annulée.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmerSuppression(false)} className={boutonSecondaire}>
                  Non, garder
                </button>
                <button
                  type="button"
                  disabled={envoi}
                  onClick={() => void supprimer()}
                  className="h-12 rounded-xl bg-[#B42318] font-bold text-white hover:bg-[#912018] disabled:opacity-60 sm:h-11"
                >
                  {envoi ? 'Suppression…' : 'Oui, supprimer'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {erreur && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {erreur}
        </p>
      )}
    </Fenetre>
  )
}
