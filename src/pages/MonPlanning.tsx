import { useCallback, useEffect, useState } from 'react'
import type { EventSourceFuncArg, EventInput } from '@fullcalendar/core'
import Calendrier from '../components/Calendrier'
import Gabarit from '../components/Gabarit'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import type { Horaire } from '../lib/types'
import { couleurDe } from '../lib/couleurs'
import { debutSemaine, dureeHeures, formatHeures, formatJour, formatPause, heureLocale } from '../lib/dates'

const COULEUR = couleurDe(0)

interface Resume {
  heures: number
  services: number
  prochain: Horaire | null
}

export default function MonPlanning() {
  const { profil } = useAuth()
  const [resume, setResume] = useState<Resume | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const chargerEvenements = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, employe_id, debut, fin, note, pause_minutes')
        .eq('employe_id', profil!.id)
        .lt('debut', info.endStr)
        .gt('fin', info.startStr)
        .order('debut')
      if (error) {
        setErreur('Impossible de charger le planning. Réessayez.')
        return []
      }
      setErreur(null)
      return (data as Horaire[]).map((h) => ({
        id: h.id,
        title: [h.note || 'Service', h.pause_minutes ? `pause ${formatPause(h.pause_minutes)}` : '']
          .filter(Boolean)
          .join(' · '),
        start: h.debut,
        end: h.fin,
        backgroundColor: COULEUR.fond,
        borderColor: COULEUR.trait,
        textColor: COULEUR.texte,
      }))
    },
    [profil],
  )

  useEffect(() => {
    if (!profil) return
    const lundi = debutSemaine(new Date())
    const lundiSuivant = new Date(lundi)
    lundiSuivant.setDate(lundi.getDate() + 7)
    const maintenant = new Date().toISOString()

    void Promise.all([
      supabase
        .from('shifts')
        .select('debut, fin, pause_minutes')
        .eq('employe_id', profil.id)
        .gte('debut', lundi.toISOString())
        .lt('debut', lundiSuivant.toISOString()),
      supabase
        .from('shifts')
        .select('id, employe_id, debut, fin, note, pause_minutes')
        .eq('employe_id', profil.id)
        .gt('fin', maintenant)
        .order('debut')
        .limit(1)
        .maybeSingle(),
    ]).then(([semaine, prochain]) => {
      const lignes = (semaine.data ?? []) as Pick<Horaire, 'debut' | 'fin' | 'pause_minutes'>[]
      setResume({
        heures: lignes.reduce(
          (t, h) => t + dureeHeures(new Date(h.debut), new Date(h.fin), h.pause_minutes),
          0,
        ),
        services: lignes.length,
        prochain: (prochain.data as Horaire | null) ?? null,
      })
    })
  }, [profil])

  return (
    <Gabarit titre="Mon planning">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="order-2 min-w-0 flex-1 lg:order-1">
          {erreur && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <Calendrier events={chargerEvenements} />
        </div>

        <aside className="order-1 grid grid-cols-2 gap-3 lg:order-2 lg:w-64 lg:grid-cols-1">
          <div className="rounded-2xl border border-ligne bg-white p-4">
            <div className="text-[13px] font-semibold text-gris">Cette semaine (pauses déduites)</div>
            <div className="mt-1 text-2xl font-extrabold">{resume ? formatHeures(resume.heures) : '…'}</div>
            <div className="text-[13px] text-gris">
              {resume ? `${resume.services} service${resume.services > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <div className="rounded-2xl border border-ligne bg-white p-4">
            <div className="text-[13px] font-semibold text-gris">Prochain service</div>
            {resume?.prochain ? (
              <>
                <div className="mt-1 font-bold first-letter:uppercase">
                  {formatJour.format(new Date(resume.prochain.debut))}
                </div>
                <div className="text-sm">
                  {heureLocale(new Date(resume.prochain.debut))} – {heureLocale(new Date(resume.prochain.fin))}
                </div>
                {resume.prochain.pause_minutes > 0 && (
                  <div className="text-[13px] text-gris">Pause : {formatPause(resume.prochain.pause_minutes)}</div>
                )}
                {resume.prochain.note && (
                  <div className="mt-2 rounded-lg bg-fond px-2.5 py-1.5 text-[13px] text-gris">
                    {resume.prochain.note}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-sm text-gris">{resume ? 'Aucun service prévu' : '…'}</div>
            )}
          </div>
        </aside>
      </div>
    </Gabarit>
  )
}
