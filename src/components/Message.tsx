export type TypeMessage = { type: 'ok' | 'erreur'; texte: string }

/** Message de réussite (vert) ou d'erreur (rouge) en haut d'une page ou d'un onglet. */
export default function Message({ message }: { message: TypeMessage | null }) {
  if (!message) return null
  return (
    <p
      role={message.type === 'erreur' ? 'alert' : 'status'}
      className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
    >
      {message.texte}
    </p>
  )
}
