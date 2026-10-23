import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CHAMPS_FRIGO, CHAMPS_RELEVE, enNombre, horsLimites, lireTemperature, texteTemperature, type Frigo, type Releve } from '../../lib/cuisine'
import { dateDuJour, heureLocale, jourLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { signalerCuisineModifiee } from '../../lib/useAlertesCuisine'
import FenetreFrigos from './FenetreFrigos'

const NB_JOURS = 7
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' })

/** Températures : un relevé par frigo et par jour, et l'historique de la semaine. */
export default function OngletTemperatures({ admin }: { admin: boolean }) {
  const [frigos, setFrigos] = useState<Frigo[] | null>(null)
  const [releves, setReleves] = useState<Releve[]>([])
  const [gerer, setGerer] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [jours] = useState(() =>
    Array.from({ length: NB_JOURS }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return jourLocal(d)
    }),
  )
  const aujourdhui = jours[0]

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('frigos').select(CHAMPS_FRIGO).order('ordre').order('nom'),
        supabase.from('releves_temperature').select(CHAMPS_RELEVE).gte('jour', jours[NB_JOURS - 1]).order('jour'),
      ]).then(([f, r]) => {
        if (f.error || r.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les températures.' })
        setFrigos((f.data as Frigo[]).map((x) => enNombre(x, ['temp_min', 'temp_max'])))
        setReleves((r.data as Releve[]).map((x) => enNombre(x, ['temperature'])))
      }),
    [jours],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const releveDu = (frigo: string, jour: string) => releves.find((r) => r.frigo_id === frigo && r.jour === jour)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-gris">Un relevé par frigo et par jour. Il peut être corrigé dans la journée.</p>
        {admin && (
          <button
            type="button"
            onClick={() => setGerer(true)}
            className="h-11 rounded-xl border border-[#C9CCD4] bg-white px-4 text-sm font-bold hover:bg-fond"
          >
            Gérer les frigos
          </button>
        )}
      </div>

      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
        >
          {message.texte}
        </p>
      )}

      {frigos === null ? (
        <p className="text-gris">Chargement…</p>
      ) : frigos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Aucun frigo pour le moment.{admin ? ' Ajoutez-les avec « Gérer les frigos ».' : ' Demandez à votre responsable de les ajouter.'}
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {frigos.map((f) => (
              <CarteFrigo
                key={f.id}
                frigo={f}
                releve={releveDu(f.id, aujourdhui)}
                onEnregistre={(texte, erreur) => {
                  setMessage({ type: erreur ? 'erreur' : 'ok', texte })
                  signalerCuisineModifiee()
                  void charger()
                }}
              />
            ))}
          </ul>

          <section aria-label="Historique des 7 derniers jours" className="overflow-x-auto rounded-2xl border border-ligne bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="px-4 pt-3 text-left font-extrabold">7 derniers jours</caption>
              <thead>
                <tr className="text-xs text-gris">
                  <th className="px-4 py-2 text-left font-bold">Frigo</th>
                  {[...jours].reverse().map((j) => (
                    <th key={j} className="px-2 py-2 text-center font-bold capitalize">
                      {fmtJour.format(dateDuJour(j))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {frigos.map((f) => (
                  <tr key={f.id} className="border-t border-ligne">
                    <th scope="row" className="px-4 py-2 text-left font-semibold">
                      {f.nom}
                    </th>
                    {[...jours].reverse().map((j) => {
                      const r = releveDu(f.id, j)
                      return (
                        <td key={j} className="px-2 py-2 text-center tabular-nums">
                          {r ? (
                            <span className={horsLimites(r.temperature, f) ? 'rounded-md bg-[#FDE2E2] px-1.5 py-0.5 font-bold text-[#9B1C1C]' : ''}>
                              {texteTemperature(r.temperature)}
                            </span>
                          ) : (
                            <span className="text-gris">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {gerer && frigos && (
        <FenetreFrigos
          frigos={frigos}
          onFermer={() => setGerer(false)}
          onChange={() => {
            signalerCuisineModifiee()
            void charger()
          }}
        />
      )}
    </div>
  )
}

function CarteFrigo({
  frigo: f,
  releve,
  onEnregistre,
}: {
  frigo: Frigo
  releve?: Releve
  onEnregistre: (texte: string, erreur?: boolean) => void
}) {
  const [saisie, setSaisie] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const valeur = lireTemperature(saisie)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (valeur === null) return
    setEnvoi(true)
    const { error } = releve
      ? await supabase.from('releves_temperature').update({ temperature: valeur }).eq('id', releve.id)
      : await supabase.from('releves_temperature').insert({ frigo_id: f.id, jour: jourLocal(new Date()), temperature: valeur })
    setEnvoi(false)
    if (error) return onEnregistre('Enregistrement impossible. Réessayez.', true)
    setSaisie('')
    onEnregistre(
      horsLimites(valeur, f)
        ? `${f.nom} : ${texteTemperature(valeur)}, hors limites. Votre responsable est prévenu.`
        : `${f.nom} : ${texteTemperature(valeur)} enregistré.`,
      horsLimites(valeur, f),
    )
  }

  const hors = releve && horsLimites(releve.temperature, f)
  return (
    <li className={`flex flex-col gap-2 rounded-2xl border bg-white p-4 ${hors ? 'border-[#F1B4B4]' : 'border-ligne'}`}>
      <div className="flex items-baseline gap-2">
        <span className="mr-auto font-extrabold">{f.nom}</span>
        <span className="text-xs text-gris">
          {texteTemperature(f.temp_min)} à {texteTemperature(f.temp_max)}
        </span>
      </div>
      {releve ? (
        <div className={`rounded-lg px-3 py-2 text-sm ${hors ? 'bg-[#FDE2E2] text-[#9B1C1C]' : 'bg-[#DDF5E6] text-[#145C32]'}`}>
          <b className="text-lg">{texteTemperature(releve.temperature)}</b> {hors ? '· hors limites' : '· OK'}
          <span className="block text-xs">Relevé à {heureLocale(new Date(releve.releve_le))}</span>
        </div>
      ) : (
        <div className="rounded-lg bg-[#FFF1C2] px-3 py-2 text-sm font-semibold text-[#6B4E00]">Pas encore relevé aujourd'hui</div>
      )}
      <form onSubmit={enregistrer} className="flex gap-2">
        <label className="sr-only" htmlFor={`temp-${f.id}`}>
          Température de {f.nom} (°C)
        </label>
        <input
          id={`temp-${f.id}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={releve ? 'Corriger (°C)' : 'Température (°C)'}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-[#C9CCD4] px-3 text-[15px] outline-none focus:border-marque"
        />
        <button
          type="submit"
          disabled={envoi || valeur === null}
          className="h-11 shrink-0 rounded-lg bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
        >
          {releve ? 'Corriger' : 'Enregistrer'}
        </button>
      </form>
    </li>
  )
}
