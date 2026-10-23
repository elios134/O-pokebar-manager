import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CHAMPS_FOURNISSEUR,
  CHAMPS_LIVRAISON,
  lireTemperature,
  texteTemperature,
  type Fournisseur,
  type Livraison,
  type Nom,
} from '../../lib/cuisine'
import { heureLocale, jourLocal } from '../../lib/dates'
import { envoyerFichier, liensSignes } from '../../lib/fichiers'
import { supabase } from '../../lib/supabase'
import ChoixFichier from '../ChoixFichier'
import { champ, etiquette } from '../Fenetre'
import Message, { type TypeMessage } from '../Message'

const NB_JOURS = 14
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

/** Traçabilité des livraisons : fournisseur, photo du bon, température à réception, n° de lot. */
export default function OngletLivraisons({ admin, noms }: { admin: boolean; noms: Nom[] }) {
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [liens, setLiens] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<TypeMessage | null>(null)
  const [depuis] = useState(() => new Date(Date.now() - NB_JOURS * 86_400_000).toISOString())
  const [aujourdhui] = useState(() => jourLocal(new Date()))

  const charger = useCallback(
    () =>
      Promise.all([
        supabase
          .from('livraisons')
          .select(CHAMPS_LIVRAISON)
          .gte('recu_le', depuis)
          .order('recu_le', { ascending: false }),
        supabase.from('fournisseurs').select(CHAMPS_FOURNISSEUR).order('nom'),
      ]).then(async ([l, f]) => {
        if (l.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les livraisons.' })
        const liste = l.data as Livraison[]
        setLivraisons(liste)
        setFournisseurs((f.data ?? []) as Fournisseur[])
        setLiens(
          await liensSignes(
            'dlc',
            liste.map((x) => x.photo),
          ),
        )
      }),
    [depuis],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function supprimer(x: Livraison) {
    if (!window.confirm(`Supprimer la livraison ${x.fournisseur} du ${fmtJour.format(new Date(x.recu_le))} ?`)) return
    const { error } = await supabase.from('livraisons').delete().eq('id', x.id)
    if (!error && x.photo) await supabase.storage.from('dlc').remove([x.photo])
    setMessage(
      error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: 'Livraison supprimée.' },
    )
    void charger()
  }

  const nomDe = (id: string | null) => noms.find((n) => n.id === id)?.prenom ?? ''
  const jours = [...new Set((livraisons ?? []).map((x) => jourLocal(new Date(x.recu_le))))]

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <FormulaireLivraison
        fournisseurs={fournisseurs}
        onEnregistre={(texte, ok) => {
          setMessage({ type: ok ? 'ok' : 'erreur', texte })
          if (ok) void charger()
        }}
      />
      <section aria-label="Livraisons récentes" className="min-w-0 flex-1">
        <Message message={message} />
        {livraisons === null ? (
          <p className="text-gris">Chargement…</p>
        ) : livraisons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
            Aucune livraison enregistrée ces {NB_JOURS} derniers jours.
          </div>
        ) : (
          jours.map((j) => (
            <div key={j} className="mb-3">
              <h2 className="mb-2 text-sm font-extrabold first-letter:uppercase">
                {j === aujourdhui ? "Aujourd'hui" : fmtJour.format(new Date(`${j}T12:00`))}
              </h2>
              <ul className="flex flex-col gap-2">
                {livraisons
                  .filter((x) => jourLocal(new Date(x.recu_le)) === j)
                  .map((x) => (
                    <li
                      key={x.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-ligne bg-white p-3"
                    >
                      {x.photo && liens[x.photo] ? (
                        <a
                          href={liens[x.photo]}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Voir le bon de livraison ${x.fournisseur}`}
                          className="size-12 shrink-0 overflow-hidden rounded-lg bg-fond"
                        >
                          <img src={liens[x.photo]} alt="" className="size-full object-cover" />
                        </a>
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-fond text-[10px] text-gris">
                          Sans bon
                        </span>
                      )}
                      <div className="mr-auto min-w-0">
                        <div className="font-bold">
                          {x.fournisseur} · {heureLocale(new Date(x.recu_le))}
                        </div>
                        <div className="text-xs text-gris">
                          {[
                            x.temperature !== null && texteTemperature(Number(x.temperature)),
                            x.lot && `lot ${x.lot}`,
                            x.produits,
                            nomDe(x.recu_par),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${x.conforme ? 'bg-[#DDF5E6] text-[#145C32]' : 'bg-[#FDE2E2] text-[#9B1C1C]'}`}
                      >
                        {x.conforme ? 'Conforme' : 'Non conforme'}
                      </span>
                      {admin && (
                        <button
                          type="button"
                          onClick={() => void supprimer(x)}
                          aria-label={`Supprimer la livraison ${x.fournisseur}`}
                          className="h-9 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function FormulaireLivraison({
  fournisseurs,
  onEnregistre,
}: {
  fournisseurs: Fournisseur[]
  onEnregistre: (texte: string, ok: boolean) => void
}) {
  const [fournisseurId, setFournisseurId] = useState('')
  const [autre, setAutre] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [temperature, setTemperature] = useState('')
  const [lot, setLot] = useState('')
  const [produits, setProduits] = useState('')
  const [conforme, setConforme] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  // Champ libre si aucun fournisseur n'est enregistré ou si « Autre » est choisi.
  const libre = !fournisseurs.length || fournisseurId === 'autre'
  const nom = libre ? autre.trim() : (fournisseurs.find((f) => f.id === fournisseurId)?.nom ?? '')
  const temp = temperature.trim() ? lireTemperature(temperature) : null
  const tempInvalide = temperature.trim() !== '' && temp === null

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!nom || tempInvalide) return
    setEnvoi(true)
    let photo: string | null = null
    if (fichier) {
      const r = await envoyerFichier('dlc', `livraisons/${jourLocal(new Date())}`, fichier)
      if ('erreur' in r) {
        setEnvoi(false)
        return onEnregistre(r.erreur, false)
      }
      photo = r.chemin
    }
    const { error } = await supabase.from('livraisons').insert({
      fournisseur_id: libre ? null : fournisseurId,
      fournisseur: nom,
      temperature: temp,
      lot: lot.trim() || null,
      produits: produits.trim() || null,
      conforme,
      photo,
    })
    setEnvoi(false)
    if (error) return onEnregistre('Enregistrement impossible. Réessayez.', false)
    setFichier(null)
    setTemperature('')
    setLot('')
    setProduits('')
    setConforme(true)
    onEnregistre(
      `Livraison ${nom} enregistrée.${conforme ? '' : ' Votre responsable est prévenu (non conforme).'}`,
      true,
    )
  }

  return (
    <form
      onSubmit={enregistrer}
      aria-label="Nouvelle livraison"
      className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 lg:w-[380px] lg:shrink-0"
    >
      <h2 className="text-[17px] font-extrabold">Nouvelle livraison</h2>
      {fournisseurs.length > 0 && (
        <label className={etiquette}>
          Fournisseur
          <select required value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={champ}>
            <option value="">Choisir…</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
            <option value="autre">Autre…</option>
          </select>
        </label>
      )}
      {libre && (
        <label className={etiquette}>
          {fournisseurs.length ? 'Nom du fournisseur' : 'Fournisseur'}
          <input
            required
            maxLength={80}
            placeholder="Ex. : Metro"
            value={autre}
            onChange={(e) => setAutre(e.target.value)}
            className={champ}
          />
        </label>
      )}
      <ChoixFichier
        fichier={fichier}
        onChoisir={setFichier}
        texte="Photo du bon de livraison"
        aide="Facultatif"
        pdf={false}
        camera
      />
      <div className="grid grid-cols-2 gap-3">
        <label className={etiquette}>
          Température (°C)
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex. : 3,5"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          N° de lot
          <input maxLength={60} value={lot} onChange={(e) => setLot(e.target.value)} className={champ} />
        </label>
      </div>
      {tempInvalide && (
        <p className="-mt-1 text-sm font-semibold text-red-800">Température invalide (ex. : 3,5 ou -18).</p>
      )}
      <label className={etiquette}>
        Produits / remarque
        <input
          maxLength={300}
          placeholder="Ex. : saumon 3 kg, crème 2 L"
          value={produits}
          onChange={(e) => setProduits(e.target.value)}
          className={champ}
        />
      </label>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={conforme}
          onChange={(e) => setConforme(e.target.checked)}
          className="size-5 accent-[#1F7A45]"
        />
        Livraison conforme
      </label>
      <button
        type="submit"
        disabled={envoi || !nom || tempInvalide}
        className="h-12 rounded-xl bg-marque font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
      >
        {envoi ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}
