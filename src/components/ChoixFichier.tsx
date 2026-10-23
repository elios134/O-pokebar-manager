import { useEffect, useMemo } from 'react'

/** Zone pour prendre une photo ou choisir un fichier (PDF ou image), avec un aperçu. */
export default function ChoixFichier({
  fichier,
  onChoisir,
  texte,
  aide,
  pdf = true,
  camera = false,
}: {
  fichier: File | null
  onChoisir: (f: File | null) => void
  texte: string
  aide?: string
  /** Accepter aussi les PDF. */
  pdf?: boolean
  /** Ouvrir directement l'appareil photo sur téléphone. */
  camera?: boolean
}) {
  const apercu = useMemo(() => (fichier?.type.startsWith('image/') ? URL.createObjectURL(fichier) : null), [fichier])
  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu)
    },
    [apercu],
  )

  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#C9CCD4] bg-fond p-4 text-center text-sm font-semibold text-marque-fonce">
      {apercu && <img src={apercu} alt="Aperçu du fichier choisi" className="max-h-40 rounded-lg object-contain" />}
      {fichier && !apercu && <span className="font-bold text-encre">{fichier.name}</span>}
      {fichier ? 'Changer de fichier' : texte}
      {!fichier && aide && <span className="text-xs font-medium text-gris">{aide}</span>}
      <input
        type="file"
        accept={pdf ? 'image/*,application/pdf' : 'image/*'}
        {...(camera ? { capture: 'environment' as const } : {})}
        className="sr-only"
        onChange={(e) => onChoisir(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}
