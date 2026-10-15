import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const page = await ctx.newPage(); const db = creerBase(); await brancher(page, db)

await page.goto(B + '/connexion')
const manifeste = await page.evaluate(async () => {
  const lien = document.querySelector('link[rel="manifest"]'); if (!lien) return null
  return (await fetch(lien.href)).json()
})
verif('manifeste présent', !!manifeste)
verif('manifeste : nom O\'pokebar', manifeste?.name === "O'pokebar · Planning")
verif('manifeste : mode application (standalone)', manifeste?.display === 'standalone')
verif('manifeste : icônes 192, 512 et maskable', manifeste?.icons?.length === 3 && manifeste.icons.some((i) => i.purpose === 'maskable'))
for (const i of manifeste?.icons ?? []) {
  const r = await page.request.get(`${B}/${i.src}`); verif(`icône ${i.src} accessible`, r.ok())
}
const r = await page.request.get(`${B}/apple-touch-icon.png`); verif('icône iPhone accessible', r.ok())

const sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; const a = reg.active; if (a.state !== 'activated') await new Promise((ok) => a.addEventListener('statechange', () => a.state === 'activated' && ok())); return a.state })
verif('service worker actif', sw === 'activated')

// Hors connexion : l'interface doit quand même s'ouvrir
await page.reload(); await page.waitForTimeout(500)
await ctx.setOffline(true)
await page.goto(B + '/connexion')
verif('hors connexion : la page de connexion s’affiche', await page.getByRole('button', { name: 'Se connecter' }).isVisible())
await page.goto(B + '/mon-planning')
await page.waitForURL('**/connexion')
verif('hors connexion : une autre adresse s’ouvre aussi (redirigée vers connexion)', true)
await ctx.setOffline(false)

console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
