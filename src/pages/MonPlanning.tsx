import { useCallback, useEffect, useRef, useState } from 'react'
import type FullCalendar from '@fullcalendar/react'
import { useNavigate } from 'react-router-dom'
import type { EventSourceFuncArg, EventInput } from '@fullcalendar/core'
import Calendrier from '../components/Calendrier'
import FenetreJour from '../components/FenetreJour'
import Gabarit from '../components/Gabarit'
import { BandeauNotifications } from '../components/pwa/Notifications'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, CHAMPS_HORAIRE, type Conge, type Horaire } from '../lib/types'
import { couleurDe } from '../lib/couleurs'
import { debutSemaine, dureeHeures, formatHeures, formatJour, heureLocale, jourLocal, jourSuivant, textePause, lienImpression } from '../lib/dates'
import { garder, relire, texteQuand } from '../lib/horsLigne'

const COULEUR = couleurDe(0)

interface Resume {
  heures: number
  services: number
  prochain: Horaire | null
}

/** Planning gardé sur l'appareil pour l'afficher sans réseau. */
interface PlanningGarde {
  horaires: Horaire[]
  conges: Conge[]
}

const cleGarde = (id: string) => `planning:${id}`
const chevauche = (h: Horaire, de: Date, a: Date) => new Date(h.debut) < a && new Date(h.fin) > de
const congeDans = (c: Conge, jourDe: string, jourA: string) => c.debut <= jourA && c.fin >= jourDe

/** Remplace dans la copie locale tout ce qui concerne la période lue par ce qui vient d'arriver. */
function mettreDeCote(id: string, horaires: Horaire[], conges: Conge[], de: Date, a: Date) {
  const avant = relire<PlanningGarde>(cleGarde(id))?.valeur ?? { horaires: [], conges: [] }
  const [jourDe, jourA] = [jourLocal(de), jourLocal(a)]
  garder(cleGarde(id), {
    horaires: [...avant.horaires.filter((h) => !chevauche(h, de, a)), ...horaires],
    conges: [...avant.conges.filter((c) => !congeDans(c, jourDe, jourA)), ...conges],
  })
}

function evenements(horaires: Horaire[], conges: Conge[]): EventInput[] {
  const evenementsConges: EventInput[] = conges.map((c) => ({
    id: `conge-${c.id}`,
    title: c.statut === 'accepte' ? 'Congé' : 'Congé demandé (en attente)',
    start: c.debut,
    end: jourSuivant(c.fin),
    allDay: true,
    backgroundColor: c.statut === 'accepte' ? COULEUR.trait : '#FFFFFF',
    borderColor: COULEUR.trait,
    textColor: c.statut === 'accepte' ? '#FFFFFF' : COULEUR.texte,
    classNames: c.statut === 'accepte' ? ['conge'] : ['conge', 'conge-attente'],
    extendedProps: { conge: c },
  }))
  return [
    ...evenementsConges,
    ...horaires.map((h) => ({
      id: h.id,
      title: [h.note || 'Service', textePause(h)].filter(Boolean).join(' · '),
      start: h.debut,
      end: h.fin,
      backgroundColor: COULEUR.fond,
      borderColor: COULEUR.trait,
      textColor: COULEUR.texte,
      extendedProps: { horaire: h, pause: h.pause_debut ? { debut: h.pause_debut, fin: h.pause_fin } : null },
    })),
  ]
}

function calculerResume(horaires: Horaire[]): Resume {
  const lundi = debutSemaine(new Date())
  const lundiSuivant = new Date(lundi)
  lundiSuivant.setDate(lundi.getDate() + 7)
  const semaine = horaires.filter((h) => new Date(h.debut) >= lundi && new Date(h.debut) < lundiSuivant)
  const maintenant = new Date()
  return {
    heures: semaine.reduce((t, h) => t + dureeHeures(new Date(h.debut), new Date(h.fin), h.pause_minutes), 0),
    services: semaine.length,
    prochain: [...horaires].sort((x, y) => x.debut.localeCompare(y.debut)).find((h) => new Date(h.fin) > maintenant) ?? null,
  }
}

export default function MonPlanning() {
  const { profil } = useAuth()
  const [resume, setResume] = useState<Resume | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  // Date des données gardées quand on les affiche faute de réseau.
  const [garde, setGarde] = useState<number | null>(null)
  // Jour ouvert dans la fenêtre de détail (clic sur un jour ou un horaire).
  const [detail, setDetail] = useState<{ jour: string; horaires: Horaire[]; conges: Conge[] } | null>(null)

  /** Ouvre le détail d'un jour avec les horaires et congés déjà affichés dans le calendrier. */
  function ouvrirJour(jour: string) {
    const evenements = calendrier.current?.getApi().getEvents() ?? []
    setDetail({
      jour,
      horaires: evenements
        .map((e) => e.extendedProps.horaire as Horaire | undefined)
        .filter((h): h is Horaire => !!h && jourLocal(new Date(h.debut)) === jour)
        .sort((a, b) => a.debut.localeCompare(b.debut)),
      conges: evenements
        .map((e) => e.extendedProps.conge as Conge | undefined)
        .filter((c): c is Conge => !!c && c.debut <= jour && c.fin >= jour),
    })
  }
  const calendrier = useRef<FullCalendar>(null)
  const naviguer = useNavigate()

  const chargerEvenements = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      // Pas de réseau : on montre ce qui a été gardé sur l'appareil.
      const depuisCopie = () => {
        const copie = relire<PlanningGarde>(cleGarde(profil!.id))
        if (!copie) {
          setErreur('Impossible de charger le planning. Réessayez.')
          return []
        }
        setErreur(null)
        setGarde(copie.quand)
        return evenements(
          copie.valeur.horaires.filter((h) => chevauche(h, info.start, info.end)),
          copie.valeur.conges.filter((c) => congeDans(c, jourLocal(info.start), jourLocal(info.end))),
        )
      }
      if (!navigator.onLine) return depuisCopie()
      const [horaires, conges] = await Promise.all([
        supabase
          .from('shifts')
          .select(CHAMPS_HORAIRE)
          .eq('employe_id', profil!.id)
          .lt('debut', info.endStr)
          .gt('fin', info.startStr)
          .order('debut'),
        supabase
          .from('conges')
          .select(CHAMPS_CONGE)
          .eq('employe_id', profil!.id)
          .neq('statut', 'refuse')
          .lte('debut', jourLocal(info.end))
          .gte('fin', jourLocal(info.start)),
      ])
      if (horaires.error || conges.error) return depuisCopie()
      setErreur(null)
      setGarde(null)
      mettreDeCote(profil!.id, horaires.data as Horaire[], (conges.data ?? []) as Conge[], info.start, info.end)
      return evenements(horaires.data as Horaire[], (conges.data ?? []) as Conge[])
    },
    [profil],
  )

  // Résumé de la semaine, et les semaines à venir mises de côté pour les consulter sans réseau.
  useEffect(() => {
    if (!profil) return
    const copie = () => {
      const c = relire<PlanningGarde>(cleGarde(profil.id))
      if (c) setResume(calculerResume(c.valeur.horaires))
    }
    if (!navigator.onLine) return copie()
    const de = debutSemaine(new Date())
    de.setDate(de.getDate() - 7)
    const a = new Date(de)
    a.setDate(a.getDate() + 7 * 8)

    void Promise.all([
      supabase
        .from('shifts')
        .select(CHAMPS_HORAIRE)
        .eq('employe_id', profil.id)
        .lt('debut', a.toISOString())
        .gt('fin', de.toISOString())
        .order('debut'),
      supabase
        .from('conges')
        .select(CHAMPS_CONGE)
        .eq('employe_id', profil.id)
        .neq('statut', 'refuse')
        .lte('debut', jourLocal(a))
        .gte('fin', jourLocal(de)),
    ]).then(([horaires, conges]) => {
      if (horaires.error || conges.error) return copie()
      mettreDeCote(profil.id, horaires.data as Horaire[], (conges.data ?? []) as Conge[], de, a)
      setResume(calculerResume(horaires.data as Horaire[]))
    })
  }, [profil])

  return (
    <Gabarit
      titre="Mon planning"
      actions={
        <button
          type="button"
          onClick={() => {
            const api = calendrier.current?.getApi()
            naviguer(
              lienImpression(api?.getDate() ?? new Date(), {
                periode: api?.view.type === 'dayGridMonth' ? 'mois' : 'semaine',
              }),
            )
          }}
          className="flex h-11 items-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
        >
          Exporter en PDF
        </button>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="order-2 min-w-0 flex-1 lg:order-1">
          {erreur && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <BandeauNotifications />
          {garde && (
            <p role="status" className="mb-3 rounded-lg bg-[#FFF1C2] px-3 py-2 text-sm text-[#6B4E00]">
              Hors connexion : planning enregistré sur ce téléphone le {texteQuand(garde)}.
            </p>
          )}
          <Calendrier
            ref={calendrier}
            events={chargerEvenements}
            dateClick={(info) => info.view.type === 'dayGridMonth' && ouvrirJour(jourLocal(info.date))}
            eventClick={(info) => {
              info.jsEvent.preventDefault()
              const c = info.event.extendedProps.conge as Conge | undefined
              const h = info.event.extendedProps.horaire as Horaire | undefined
              if (h) ouvrirJour(jourLocal(new Date(h.debut)))
              else if (c) ouvrirJour(info.view.type === 'dayGridMonth' ? jourLocal(info.event.start!) : c.debut)
            }}
          />
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
                {resume.prochain.pause_debut && (
                  <div className="text-[13px] text-gris first-letter:uppercase">{textePause(resume.prochain)}</div>
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
      {detail && <FenetreJour {...detail} onFermer={() => setDetail(null)} />}
    </Gabarit>
  )
}

