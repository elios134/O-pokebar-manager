/** Mot de passe provisoire facile à dicter : 3 syllabes, 2 chiffres et une lettre (ex. « bamoli47k »). */
export function motDePasseProvisoire() {
  const c = 'bcdfghjklmnprstvz'
  const v = 'aeiou'
  const t = new Uint32Array(8)
  crypto.getRandomValues(t)
  let r = ''
  for (let i = 0; i < 3; i++) r += c[t[i * 2] % c.length] + v[t[i * 2 + 1] % v.length]
  return r + String(t[6] % 90 + 10) + c[t[7] % c.length]
}
