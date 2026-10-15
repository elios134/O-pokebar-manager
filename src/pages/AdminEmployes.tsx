import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus, IconeRecherche } from '../components/Icones'
import { couleurDe, initiales } from '../lib/couleurs'
import { gererEmploye } from '../lib/fonctions'
import { supabase } from '../lib/supabase'
import { CHAMPS_PROFIL, type Equipe, type Profil, type Role } from '../lib/types'

const VIDE = { prenom: '', nom: '', email: '', motDePasse: '', role: 'employe' as Role, equipe: '' }

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

function FenetreCreation({
  equipes,
  onFermer,
  onCree,
}: {
  equipes: Equipe[]
  onFermer: () => void
  onCree: (nom: string) => void
}) {
  const [v, setV] = useState(VIDE)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function creer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    const { equipe, ...compte } = v
    const err = await gererEmploye({ action: 'creer', ...compte, equipe_id: equipe || null })
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
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Rôle
            <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })} className={champ}>
              <option value="employe">Employé</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className={etiquette}>
            Équipe
            <select value={v.equipe} onChange={(e) => setV({ ...v, equipe: e.target.value })} className={champ}>
              <option value="">Sans équipe</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

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

/** Bloc « Équipes » : liste, création et suppression. */
function GestionEquipes({
  equipes,
  profils,
  onChange,
}: {
  equipes: Equipe[]
  profils: Profil[]
  onChange: (m: { type: 'ok' | 'erreur'; texte: string }) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function creer(e: FormEvent) {
    e.preventDefault()
    const propre = nom.trim()
    if (!propre) return
    setEnvoi(true)
    const { error } = await supabase.from('equipes').insert({ nom: propre })
    setEnvoi(false)
    if (error) {
      onChange({
        type: 'erreur',
        texte: error.code === '23505' ? 'Une équipe porte déjà ce nom.' : "Création de l'équipe impossible.",
      })
    } else {
      setNom('')
      onChange({ type: 'ok', texte: `Équipe ${propre} créée.` })
    }
  }

  async function supprimer(eq: Equipe) {
    const n = profils.filter((p) => p.equipe_id === eq.id).length
    const texte = n
      ? `Supprimer l'équipe ${eq.nom} ? Ses ${n} membre${n > 1 ? 's' : ''} n'auront plus d'équipe.`
      : `Supprimer l'équipe ${eq.nom} ?`
    if (!window.confirm(texte)) return
    const { error } = await supabase.from('equipes').delete().eq('id', eq.id)
    onChange(error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: `Équipe ${eq.nom} supprimée.` })
  }

  return (
    <section className="mb-4 rounded-2xl border border-ligne bg-white">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-bold"
      >
        Équipes
        <span className="text-sm font-semibold text-gris">({equipes.length})</span>
        <span className="ml-auto text-sm font-semibold text-marque-fonce">{ouvert ? 'Fermer' : 'Gérer'}</span>
      </button>
      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-ligne p-4">
          {equipes.length === 0 && <p className="text-sm text-gris">Aucune équipe pour l'instant.</p>}
          <ul className="flex flex-wrap gap-2">
            {equipes.map((eq) => {
              const n = profils.filter((p) => p.equipe_id === eq.id).length
              return (
                <li key={eq.id} className="flex items-center gap-1 rounded-full border border-[#C9CCD4] py-1 pr-1 pl-3.5 text-sm font-semibold">
                  {eq.nom}
                  <span className="font-medium text-gris">· {n}</span>
                  <button
                    type="button"
                    onClick={() => void supprimer(eq)}
                    aria-label={`Supprimer l'équipe ${eq.nom}`}
                    className="ml-1 flex size-8 items-center justify-center rounded-full text-gris hover:bg-red-50 hover:text-[#9B1C1C]"
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
          <form onSubmit={creer} className="flex gap-2">
            <label className="sr-only" htmlFor="nouvelle-equipe">
              Nom de la nouvelle équipe
            </label>
            <input
              id="nouvelle-equipe"
              value={nom}
              maxLength={60}
              placeholder="Nouvelle équipe (ex. : Cuisine, Salle…)"
              onChange={(e) => setNom(e.target.value)}
              className={`${champ} flex-1`}
            />
            <button type="submit" disabled={envoi || !nom.trim()} className={`${boutonPrincipal} shrink-0`}>
              Créer
            </button>
          </form>
        </div>
      )}
    </section>
  )
}

/** Mot de passe provisoire facile à dicter : 3 syllabes + 2 chiffres (ex. « bamoli47 »). */
function motDePasseProvisoire() {
  const c = 'bcdfghjklmnprstvz'
  const v = 'aeiou'
  const t = new Uint32Array(8)
  crypto.getRandomValues(t)
  let r = ''
  for (let i = 0; i < 3; i++) r += c[t[i * 2] % c.length] + v[t[i * 2 + 1] % v.length]
  return r + String(t[6] % 90 + 10) + c[t[7] % c.length]
}

/** Modifier le nom d'un employé et, si besoin, lui donner un nouveau mot de passe. */
function FenetreEdition({
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

      {erreur && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {erreur}
        </p>
      )}
    </Fenetre>
  )
}
