// Notifications sur le téléphone : affichage et clic (chargé par le service worker de l'application).
self.addEventListener('push', (evenement) => {
  let donnees = {}
  try {
    donnees = evenement.data ? evenement.data.json() : {}
  } catch {
    donnees = { titre: evenement.data ? evenement.data.text() : '' }
  }
  evenement.waitUntil(
    self.registration.showNotification(donnees.titre || "O'pokebar", {
      body: donnees.texte || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      lang: 'fr',
      tag: donnees.id,
      data: { lien: donnees.lien || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close()
  // Seulement des pages du site lui-même.
  let adresse = new URL('/', self.location.origin)
  try {
    const lien = new URL(evenement.notification.data?.lien || '/', self.location.origin)
    if (lien.origin === self.location.origin) adresse = lien
  } catch {
    /* lien invalide : page d'accueil */
  }
  evenement.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) return f.navigate(adresse.href).then((x) => (x ?? f).focus())
      }
      return self.clients.openWindow(adresse.href)
    }),
  )
})
