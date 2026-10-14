import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus, IconeRecherche } from '../components/Icones'
import { couleurDe, initiales } from '../lib/couleurs'
import { gererEmploye } from '../lib/fonctions'
import { supabase } from '../lib/supabase'
import type { Profil, Role } from '../lib/types'

const VIDE = { prenom: '', nom: '', email: '', motDePasse: '', role: 'employe' as Role }

export default function AdminEmployes() {
  const { profil: moi } = useAuth()
  const [profils, setProfils] = useState<Profil[] | null>(null)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)

  const charger = useCallback(
    () =>
      supabase
        .from('profiles')
        .select('id, nom, prenom, role, actif, email')
        .order('prenom')
        .then(({ data, error }) => {
          if (error) setMessage({ type: 'erreur', texte: 'Impossible de charger les employés.' })
          else setProfils(data as Profil[])
        }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function changerRole(p: Profil, role: Role) {
    setEnCours(p.id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    setEnCours(null)
    if (error) setMessage({ type: 'erreur', texte: 'Changement de rôle impossible.' })
    else setMessage({ type: 'ok', texte: `${p.prenom} est maintenant ${role === 'admin' ? 'admin' : 'employé'}.` })
    void charger()
  }

  async function changerStatut(p: Profil) {
    const actif = !p.actif
    if (!actif && !window.confirm(`Désactiver le compte de ${p.prenom} ${p.nom} ? Il ne pourra plus se connecter.`)) return
    setEnCours(p.id)
    const err = await gererEmploye({ action: 'statut', id: p.id, actif })
    setEnCours(null)
    setMessage(
      err
        ? { type: 'erreur', texte: err }
        : { type: 'ok', texte: `Compte de ${p.prenom} ${actif ? 'réactivé' : 'désactivé'}.` },
    )
    void charger()
  }

  const filtre = recherche.trim().toLowerCase()
  const visibles = (profils ?? []).filter((p) =>
    `${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(filtre),
  )

  return (
    <Gabarit
      titre="Employés"
      actions={
        <button
          type="button"
          onClick={() => setCreation(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
        >
          <IconePlus />
          Créer un compte
        </button>
      }
    >
      <label className="relative mb-4 flex items-center sm:w-80">
        <span className="sr-only">Rechercher</span>
        <IconeRecherche className="absolute left-3.5 text-gris" />
        <input
          type="search"
          placeholder="Rechercher un nom…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className={`${champ} pl-10`}
        />
      </label>

      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'
          }`}
        >
          {message.texte}
        </p>
      )}

      {profils === null ? (
        <p className="text-gris">Chargement…</p>
      ) : (
        <ul className="flex flex-col gap-2 sm:gap-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-ligne sm:bg-white">
          {visibles.map((p) => {
            const c = couleurDe(profils.indexOf(p))
            const soiMeme = p.id === moi?.id
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-ligne bg-white p-3.5 sm:rounded-none sm:border-0 sm:border-t sm:px-5 sm:first:border-t-0"
              >
                <div className={`flex min-w-0 flex-1 items-center gap-3 ${p.actif ? '' : 'opacity-60'}`}>
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ background: c.fond, color: c.texte }}
                  >
                    {initiales(p.prenom, p.nom)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold">
                      {p.prenom} {p.nom} {soiMeme && <span className="font-medium text-gris">(vous)</span>}
                    </div>
                    <div className="truncate text-sm text-gris">{p.email}</div>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    p.actif ? 'bg-[#DDF5E6] text-[#145C32]' : 'bg-[#E8E9EE] text-[#4A5060]'
                  }`}
                >
                  {p.actif ? 'Actif' : 'Désactivé'}
                </span>

                <div className="flex w-full gap-2 sm:w-auto">
                  <select
                    aria-label={`Rôle de ${p.prenom} ${p.nom}`}
                    value={p.role}
                    disabled={soiMeme || enCours === p.id}
                    onChange={(e) => void changerRole(p, e.target.value as Role)}
                    className="h-11 flex-1 rounded-lg border border-[#C9CCD4] bg-white px-2 text-sm disabled:opacity-60 sm:h-10 sm:flex-none"
                  >
                    <option value="employe">Employé</option>
                    <option value="admin">Admin</option>
                  </select>
                  {!soiMeme && (
                    <button
                      type="button"
                      disabled={enCours === p.id}
                      onClick={() => void changerStatut(p)}
                      className="h-11 flex-1 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond disabled:opacity-60 sm:h-10 sm:w-28 sm:flex-none"
                    >
                      {enCours === p.id ? '…' : p.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
          {visibles.length === 0 && <li className="p-5 text-gris">Aucun employé trouvé.</li>}
        </ul>
      )}

      {creation && (
        <FenetreCreation
          onFermer={() => setCreation(false)}
          onCree={(nom) => {
            setCreation(false)
            setMessage({ type: 'ok', texte: `Compte de ${nom} créé. Donnez-lui son email et son mot de passe.` })
            void charger()
          }}
        />
      )}
    </Gabarit>
  )
}

function FenetreCreation({ onFermer, onCree }: { onFermer: () => void; onCree: (nom: string) => void }) {
  const [v, setV] = useState(VIDE)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function creer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    const err = await gererEmploye({ action: 'creer', ...v })
    setEnvoi(false)
    if (err) setErreur(err)
    else onCree(`${v.prenom} ${v.nom}`)
  }

  return (
    <Fenetre titre="Créer un compte" onFermer={onFermer}>
      <form onSubmit={creer} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Prénom
            <input required value={v.prenom} onChange={(e) => setV({ ...v, prenom: e.target.value })} className={champ} />
          </label>
          <label className={etiquette}>
            Nom
            <input required value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} className={champ} />
          </label>
        </div>
        <label className={etiquette}>
          Email
          <input
            type="email"
            required
            autoComplete="off"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Mot de passe provisoire
          <input
            type="text"
            required
            minLength={8}
            autoComplete="new-password"
            value={v.motDePasse}
            onChange={(e) => setV({ ...v, motDePasse: e.target.value })}
            className={champ}
          />
          <span className="text-xs font-medium text-gris">8 caractères minimum.</span>
        </label>
        <label className={etiquette}>
          Rôle
          <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })} className={champ}>
            <option value="employe">Employé</option>
            <option value="admin">Admin</option>
          </select>
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
          <button type="submit" disabled={envoi} className={boutonPrincipal}>
            {envoi ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
