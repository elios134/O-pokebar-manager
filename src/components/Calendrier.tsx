import { forwardRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { CalendarOptions, EventContentArg } from '@fullcalendar/core'
import type { VerboseFormattingArg } from '@fullcalendar/core/internal'
import frLocale from '@fullcalendar/core/locales/fr'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import { heureLocale } from '../lib/dates'
import { useEstMobile } from '../lib/useEstMobile'

const enUTC = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' })
const fmtMois = enUTC({ month: 'long', year: 'numeric' })
const fmtJourMois = enUTC({ day: 'numeric', month: 'long' })
const fmtComplet = enUTC({ day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Titre de la période. Les journées vont jusqu'à 6 h le lendemain (services de nuit) :
 * on ne compte pas ces quelques heures comme un jour de plus dans le titre.
 */
function titre(arg: VerboseFormattingArg) {
  const debut = arg.start.marker
  let fin = arg.end?.marker ?? debut
  if (fin.getUTCDate() !== debut.getUTCDate() && fin.getUTCHours() > 0 && fin.getUTCHours() <= 6) {
    fin = new Date(fin.getTime() - 86_400_000)
  }
  const lendemainDeFin = new Date(fin.getTime() + 86_400_000)
  if (debut.getUTCDate() === 1 && lendemainDeFin.getUTCDate() === 1 && fin.getTime() - debut.getTime() > 20 * 86_400_000) {
    return fmtMois.format(debut)
  }
  if (fin.toISOString().slice(0, 10) === debut.toISOString().slice(0, 10)) return fmtComplet.format(debut)
  if (debut.getUTCMonth() === fin.getUTCMonth()) return `${debut.getUTCDate()} – ${fmtComplet.format(fin)}`
  return `${fmtJourMois.format(debut)} – ${fmtComplet.format(fin)}`
}

/** Vue liste : un service de nuit y serait coupé à minuit, on affiche donc ses vraies heures. */
function contenuListe(arg: EventContentArg) {
  const { start, end } = arg.event
  return (
    <span className="flex flex-wrap gap-x-3">
      <span className="font-semibold tabular-nums">
        {start && heureLocale(start)} – {end && heureLocale(end)}
      </span>
      <span>{arg.event.title}</span>
    </span>
  )
}

/** Calendrier commun : semaine / mois sur grand écran, liste / jour / mois sur téléphone. */
const Calendrier = forwardRef<FullCalendar, CalendarOptions>(function Calendrier(options, ref) {
  const mobile = useEstMobile()

  return (
    <div className="overflow-hidden rounded-2xl border border-ligne bg-white p-2 sm:p-4">
      <FullCalendar
        key={mobile ? 'mobile' : 'bureau'}
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={frLocale}
        initialView={mobile ? 'listWeek' : 'timeGridWeek'}
        headerToolbar={
          mobile
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth,listWeek' }
        }
        footerToolbar={mobile ? { center: 'listWeek,timeGridDay,dayGridMonth' } : undefined}
        buttonText={{ listWeek: 'Liste', timeGridDay: 'Jour', timeGridWeek: 'Semaine', dayGridMonth: 'Mois' }}
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="30:00:00"
        scrollTime="08:00:00"
        nowIndicator
        height={mobile ? 'auto' : 720}
        nextDayThreshold="06:00:00"
        titleFormat={titre}
        views={{ list: { displayEventTime: false, eventContent: contenuListe } }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
        noEventsText="Aucun horaire sur cette période"
        dayMaxEvents={3}
        {...options}
      />
    </div>
  )
})

export default Calendrier
