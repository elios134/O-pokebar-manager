import type { ReactNode } from 'react'

/** Page simple centrée (mot de passe oublié, nouveau mot de passe). */
export default function PageAccueilSimple({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-fond px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-ligne bg-white p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-lg" />
          <span className="text-lg font-bold">O'pokebar · Planning</span>
        </div>
        <h1 className="mb-4 text-2xl font-extrabold">{titre}</h1>
        {children}
      </div>
    </main>
  )
}
