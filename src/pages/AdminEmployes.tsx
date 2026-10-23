import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import FenetreCreation from '../components/employes/FenetreCreation'
import FenetreEdition from '../components/employes/FenetreEdition'
import GestionEquipes from '../components/employes/GestionEquipes'
import { champ } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus, IconeRecherche } from '../components/Icones'
import { couleurDe, initiales } from '../lib/couleurs'
import { gererEmploye } from '../lib/fonctions'
import { supabase } from '../lib/supabase'
import { CHAMPS_PROFIL, NOMS_ROLES, type Equipe, type Profil, type Role } from '../lib/types'

export default function AdminEmployes() {
  const { profil: moi } = useAuth()
  const [profils, setProfils] = useState<Profil[] | null>(null)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)
  const [edition, setEdition] = useState<Profil | null>(null)
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [filtreEquipe, setFiltreEquipe] = useState('')

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
        supabase.from('equipes').select('id, nom').order('nom'),
      ]).then(([p, e]) => {
        if (p.error) setMessage({ type: 'erreur', texte: 'Impossible de charger les employés.' })
        else setProfils(p.data as Profil[])
        setEquipes((e.data ?? []) as Equipe[])
      }),
    [],
  )

  async function changerEquipe(p: Profil, equipeId: string) {
    setEnCours(p.id)
    const { error } = await supabase
      .from('profiles')
      .update({ equipe_id: equipeId || null })
      .eq('id', p.id)
    setEnCours(null)
    const nomEquipe = equipes.find((e) => e.id === equipeId)?.nom
    if (error) setMessage({ type: 'erreur', texte: "Changement d'équipe impossible." })
    else setMessage({ type: 'ok', texte: nomEquipe ? `${p.prenom} est dans l'équipe ${nomEquipe}.` : `${p.prenom} n'a plus d'équipe.` })
    void charger()
  }

  useEffect(() => {
    void charger()
  }, [charger])

  async function changerRole(p: Profil, role: Role) {
    setEnCours(p.id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    setEnCours(null)
    if (error) setMessage({ type: 'erreur', texte: 'Changement de rôle impossible.' })
    else setMessage({ type: 'ok', texte: `${p.prenom} a maintenant le rôle ${NOMS_ROLES[role]}.` })
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
  const visibles = (profils ?? []).filter(
    (p) =>
      `${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(filtre) &&
      (!filtreEquipe || (filtreEquipe === 'aucune' ? !p.equipe_id : p.equipe_id === filtreEquipe)),
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
      <GestionEquipes
        equipes={equipes}
        profils={profils ?? []}
        onChange={(m) => {
          setMessage(m)
          void charger()
        }}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex items-center sm:w-80">
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
        <select
          aria-label="Filtrer par équipe"
          value={filtreEquipe}
          onChange={(e) => setFiltreEquipe(e.target.value)}
          className={`${champ} sm:w-56`}
        >
          <option value="">Toutes les équipes</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              Équipe {e.nom}
            </option>
          ))}
          <option value="aucune">Sans équipe</option>
        </select>
      </div>

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

                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                  <select
                    aria-label={`Équipe de ${p.prenom} ${p.nom}`}
                    value={p.equipe_id ?? ''}
                    disabled={enCours === p.id}
                    onChange={(e) => void changerEquipe(p, e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#C9CCD4] bg-white px-2 text-sm disabled:opacity-60 sm:h-10 sm:w-40"
                  >
                    <option value="">Sans équipe</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Rôle de ${p.prenom} ${p.nom}`}
                    value={p.role}
                    disabled={soiMeme || enCours === p.id}
                    onChange={(e) => void changerRole(p, e.target.value as Role)}
                    className="h-11 flex-1 rounded-lg border border-[#C9CCD4] bg-white px-2 text-sm disabled:opacity-60 sm:h-10 sm:flex-none"
                  >
                    <option value="employe">Employé</option>
                    <option value="cuisine">Cuisine</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setEdition(p)}
                    className="h-11 flex-1 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond sm:h-10 sm:flex-none"
                  >
                    Modifier
                  </button>
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

      {edition && (
        <FenetreEdition
          profil={edition}
          soiMeme={edition.id === moi?.id}
          onFermer={() => setEdition(null)}
          onFait={(texte) => {
            setEdition(null)
            setMessage({ type: 'ok', texte })
            void charger()
          }}
        />
      )}

      {creation && (
        <FenetreCreation
          equipes={equipes}
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
