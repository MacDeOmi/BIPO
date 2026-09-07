export function ProfileForm({ session, name, career, semester, setName, setCareer, setSemester, onSubmit, loading, message }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 lg:col-span-2">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
          <span className="text-lg font-bold">U</span>
        </div>
        <div>
          <p className="text-sm text-slate-400">Perfil</p>
          <h2 className="text-2xl font-semibold text-white">Completa tu cuenta</h2>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-slate-300 md:col-span-2">
          Nombre completo
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
            placeholder="Ana López"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Carrera
          <input
            type="text"
            value={career}
            onChange={(e) => setCareer(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
            placeholder="Diseño Digital"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Semestre
          <input
            type="number"
            min="1"
            max="12"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="md:col-span-2 rounded-xl bg-violet-500 px-4 py-3 font-medium text-white transition hover:bg-violet-400 disabled:opacity-60"
        >
          {loading ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

      <p className="mt-5 text-xs text-slate-400">
        Cuenta autenticada: {session?.user?.email || 'Sin correo'}
      </p>
    </div>
  )
}
