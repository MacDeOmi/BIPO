import { MessageSquare, Sparkles, ThumbsUp } from 'lucide-react'

const seedThreads = [
  { author: 'Maya C.', body: 'Buscando compañeros para estudiar para estadística.', likes: 18 },
  { author: 'Luis R.', body: 'Alguien quiere ir a la feria del campus este viernes?', likes: 24 },
  { author: 'Ari S.', body: 'Compartiendo apuntes de administración con quien los necesite.', likes: 12 },
]

export function ThreadsPanel() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Hilos</p>
            <h3 className="text-xl font-semibold text-white">Feed universitario</h3>
          </div>
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
          Nuevo hilo
        </button>
      </div>

      <div className="space-y-4">
        {seedThreads.map((thread, index) => (
          <article key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-white">{thread.author}</p>
              <span className="text-xs text-slate-400">Hace 1h</span>
            </div>
            <p className="text-sm text-slate-200">{thread.body}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {thread.likes}</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Comentar</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
