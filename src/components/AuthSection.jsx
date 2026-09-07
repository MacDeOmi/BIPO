import { Lock, LogIn } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@anahuac\.mx$/i

export function AuthSection({ email, setEmail, onSubmit, loading, message, mode = 'request' }) {
  const submitLabel = mode === 'request' ? 'Enviar código OTP' : 'Confirmar acceso'

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-violet-950/30">
      <div className="mb-5 flex items-center gap-2 text-violet-300">
        <LogIn className="h-5 w-5" />
        <h2 className="text-2xl font-semibold">{mode === 'request' ? 'Inicia sesión' : 'Verifica tu código'}</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'request' ? (
          <label className="block text-sm text-slate-300">
            Correo institucional
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@anahuac.mx"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
              required
            />
          </label>
        ) : (
          <label className="block text-sm text-slate-300">
            Código de 6 dígitos
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
              required
            />
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-violet-500 px-4 py-3 font-medium text-white transition hover:bg-violet-400 disabled:opacity-60"
        >
          {loading ? 'Procesando...' : submitLabel}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
        <Lock className="h-4 w-4" />
        Validación por dominio: {EMAIL_REGEX.toString()}
      </div>
    </div>
  )
}
