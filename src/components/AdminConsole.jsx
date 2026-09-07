import { ShieldCheck } from 'lucide-react'

export function AdminConsole() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm text-slate-400">Administración</p>
          <h3 className="text-xl font-semibold text-white">Panel de moderación</h3>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-300">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-3">
          <span>Reporte de publicaciones</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Activo</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-3">
          <span>Uso de RLS</span>
          <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs text-violet-300">Seguro</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-3">
          <span>Usuarios baneados</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300">2</span>
        </div>
      </div>
    </div>
  )
}
