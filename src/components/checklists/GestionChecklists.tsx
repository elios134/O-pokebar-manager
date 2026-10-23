import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CHAMPS_CHECKLIST, CHAMPS_TACHE, NOMS_JOURS, type Checklist, type Tache } from '../../lib/checklists'
import { supabase } from '../../lib/supabase'
import { champ } from '../Fenetre'
import Message, { type TypeMessage } from '../Message'

const puce = (actif: boolean) =>
  `h-10 rounded-full px-4 text-sm ${actif ? 'bg-encre font-bold text-white' : 'border border-[#C9CCD4] bg-white font-semibold'}`

/** Admin : créer les listes, choisir les jours, réserver une liste à la cuisine, ajouter / retirer des tâches. */
export default function GestionChecklists() {
  const [listes, setListes] = useState<Checklist[] | null>(null)
  const [taches, setTaches] = useState<Tache[]>([])
  const [choisie, setChoisie] = useState<string | null>(null)
  const [nouvelle, setNouvelle] = useState('')
  const [tache, setTache] = useState('')
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('checklists').select(CHAMPS_CHECKLIST).order('ordre').order('nom'),
        supabase.from('checklist_taches').select(CHAMPS_TACHE).eq('active', true).order('ordre'),
      ]).then(([l, t]) => {
        if (l.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les listes.' })
        setListes(l.data as Checklist[])
        setTaches((t.data ?? []) as Tache[])
      }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const actuelle = listes?.find((x) => x.id === choisie) ?? listes?.[0]
  const sesTaches = taches.filter((t) => t.checklist_id === actuelle?.id)

  async function creerListe(e: FormEvent) {
    e.preventDefault()
    const nom = nouvelle.trim()
    if (!nom) return
    const ordre = Math.max(0, ...(listes ?? []).map((x) => x.ordre)) + 1
    const { data, error } = await supabase.from('checklists').insert({ nom, ordre }).select('id').single()
    if (error)
      return setMessage({
        type: 'erreur',
        texte: error.code === '23505' ? 'Une liste porte déjà ce nom.' : 'Création impossible.',
      })
    setNouvelle('')
    setChoisie((data as { id: string }).id)
    setMessage({ type: 'ok', texte: `Liste « ${nom} » créée. Ajoutez ses tâches.` })
    void charger()
  }

  async function modifier(maj: Partial<Pick<Checklist, 'cuisine_seulement' | 'jours'>>) {
    if (!actuelle) return
    const { error } = await supabase.from('checklists').update(maj).eq('id', actuelle.id)
    if (error) setMessage({ type: 'erreur', texte: 'Modification impossible.' })
    void charger()
  }

  const basculerJour = (j: number) => {
    if (!actuelle) return
    const jours = actuelle.jours.includes(j) ? actuelle.jours.filter((x) => x !== j) : [...actuelle.jours, j].sort()
    void modifier({ jours })
  }

  async function supprimerListe() {
    if (!actuelle || !window.confirm(`Supprimer la liste « ${actuelle.nom} » et son historique ?`)) return
    const { error } = await supabase.from('checklists').delete().eq('id', actuelle.id)
    setMessage(error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: 'Liste supprimée.' })
    setChoisie(null)
    void charger()
  }

  async function ajouterTache(e: FormEvent) {
    e.preventDefault()
    if (!actuelle || !tache.trim()) return
    const ordre = Math.max(0, ...sesTaches.map((t) => t.ordre)) + 1
    const { error } = await supabase
      .from('checklist_taches')
      .insert({ checklist_id: actuelle.id, texte: tache.trim(), ordre })
    if (error) return setMessage({ type: 'erreur', texte: 'Ajout impossible.' })
    setTache('')
    void charger()
  }

  // Une tâche retirée garde son historique (elle n'apparaît simplement plus).
  async function retirerTache(t: Tache) {
    const { error } = await supabase.from('checklist_taches').update({ active: false }).eq('id', t.id)
    if (error) setMessage({ type: 'erreur', texte: 'Impossible de retirer la tâche.' })
    void charger()
  }

  return (
    <div className="flex flex-col gap-4 sm:max-w-2xl">
      <Message message={message} />
      <div className="flex flex-wrap gap-2">
        {(listes ?? []).map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={actuelle?.id === l.id}
            onClick={() => setChoisie(l.id)}
            className={puce(actuelle?.id === l.id)}
          >
            {l.nom}
            {l.cuisine_seulement && ' · cuisine'}
          </button>
        ))}
      </div>
      <form onSubmit={creerListe} className="flex gap-2">
        <input
          aria-label="Nom de la nouvelle liste"
          maxLength={40}
          placeholder="Nouvelle liste (ex. : Ouverture)"
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          className={`${champ} flex-1`}
        />
        <button
          type="submit"
          disabled={!nouvelle.trim()}
          className="h-12 rounded-xl bg-marque px-4 font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
        >
          Créer
        </button>
      </form>

      {actuelle && (
        <section
          aria-label={`Liste ${actuelle.nom}`}
          className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4"
        >
          <div className="flex items-center gap-2">
            <h2 className="mr-auto text-lg font-extrabold">{actuelle.nom}</h2>
            <button
              type="button"
              onClick={() => void supprimerListe()}
              className="h-9 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
            >
              Supprimer la liste
            </button>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={actuelle.cuisine_seulement}
              onChange={(e) => void modifier({ cuisine_seulement: e.target.checked })}
              className="size-5 accent-marque"
            />
            Réservée à la cuisine
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Jours où la liste est à faire</legend>
            <div className="flex flex-wrap gap-1.5">
              {NOMS_JOURS.map((nom, i) => (
                <button
                  key={nom}
                  type="button"
                  aria-pressed={actuelle.jours.includes(i + 1)}
                  onClick={() => basculerJour(i + 1)}
                  className={`h-10 w-12 rounded-lg text-sm ${actuelle.jours.includes(i + 1) ? 'bg-marque font-bold text-white' : 'border border-[#C9CCD4] bg-white font-semibold text-gris'}`}
                >
                  {nom}
                </button>
              ))}
            </div>
          </fieldset>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-[15px]">
            {sesTaches.map((t) => (
              <li key={t.id}>
                <div className="flex items-center gap-2">
                  <span className="mr-auto">{t.texte}</span>
                  <button
                    type="button"
                    onClick={() => void retirerTache(t)}
                    aria-label={`Retirer la tâche ${t.texte}`}
                    className="h-9 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {sesTaches.length === 0 && <p className="text-sm text-gris">Aucune tâche pour l'instant.</p>}
          <form onSubmit={ajouterTache} className="flex gap-2">
            <input
              aria-label="Nouvelle tâche"
              maxLength={120}
              placeholder="Nouvelle tâche… (ex. : couper le gaz)"
              value={tache}
              onChange={(e) => setTache(e.target.value)}
              className={`${champ} flex-1`}
            />
            <button
              type="submit"
              disabled={!tache.trim()}
              className="h-12 rounded-xl bg-marque px-4 font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
            >
              Ajouter
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
