import { useEffect, useState } from 'react'

const requete = '(max-width: 639px)'

export function useEstMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(requete).matches)
  useEffect(() => {
    const m = window.matchMedia(requete)
    const suivre = () => setMobile(m.matches)
    m.addEventListener('change', suivre)
    return () => m.removeEventListener('change', suivre)
  }, [])
  return mobile
}
