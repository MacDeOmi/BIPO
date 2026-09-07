import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CalendarDays,
  Heart,
  Lock,
  LogIn,
  MessageSquare,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './App.css'

const EMAIL_REGEX = /^[^\s@]+@anahuac\.mx$/i

function App() {
  const [view, setView] = useState('auth')
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [remember, setRemember] = useState(true)
  const [name, setName] = useState('')
  const [career, setCareer] = useState('')
  const [semester, setSemester] = useState('1')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [session, setSession] = useState(null)
  const pendingPasswordSetup = useRef(false)

  useEffect(() => {
    if (!supabase) return

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setView(data.session ? 'dashboard' : 'auth')
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession)
      setView(currentSession
        ? (pendingPasswordSetup.current ? 'set-password' : 'dashboard')
        : 'auth')
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const canUsePlatform = useMemo(() => {
    if (!session) return false
    return !!session.user && !!session.user.email && EMAIL_REGEX.test(session.user.email)
  }, [session])

  const handlePasswordLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (!EMAIL_REGEX.test(email)) {
      setMessage('Solo se aceptan correos institucionales @anahuac.mx')
      setLoading(false)
      return
    }

    if (!supabase) {
      setMessage('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      setLoading(false)
      return
    }

    localStorage.setItem('bipo_remember', String(remember))
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage('Correo o contraseña incorrectos.')
    } else {
      setMessage('Sesión iniciada correctamente.')
      setView('dashboard')
    }

    setLoading(false)
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (!EMAIL_REGEX.test(email)) {
      setMessage('Solo se aceptan correos institucionales @anahuac.mx')
      setLoading(false)
      return
    }

    if (!supabase) {
      setMessage('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      setLoading(false)
      return
    }

    localStorage.setItem('bipo_remember', 'true')
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage(error.message)
    } else if (data.session) {
      setSession(data.session)
      setView('dashboard')
      setMessage('Cuenta creada correctamente.')
    } else {
      setMessage('Cuenta creada. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.')
    }

    setLoading(false)
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (!supabase) {
      setMessage('Falta configurar Supabase en el entorno.')
      setLoading(false)
      return
    }

    pendingPasswordSetup.current = authMode === 'register'
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      setMessage(error.message)
    } else {
      setSession(data.session)
      setView(authMode === 'register' ? 'set-password' : 'dashboard')
      setMessage(authMode === 'register'
        ? 'Correo confirmado. Ahora crea una contraseña.'
        : 'Sesión confirmada correctamente.')
    }

    setLoading(false)
  }

  const handleSetPassword = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (password !== passwordConfirmation) {
      setMessage('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
    } else {
      pendingPasswordSetup.current = false
      setPassword('')
      setPasswordConfirmation('')
      setView('dashboard')
      setMessage('Cuenta creada correctamente.')
    }

    setLoading(false)
  }

  const handleCreateProfile = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (!supabase || !session?.user) {
      setMessage('No hay sesión activa para completar el perfil.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: name || session.user.email,
      career: career || 'Sin carrera',
      semester: Number(semester) || 1,
      bio: 'Nuevo miembro de la comunidad universitaria.',
      interests: ['General'],
      role: 'user',
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Perfil actualizado correctamente.')
    }

    setLoading(false)
  }

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setView('auth')
  }

  const appCards = [
    { icon: MessageSquare, title: 'Hilos', description: 'Publicaciones y comunidad universitaria.' },
    { icon: Users, title: 'Amistades', description: 'Conecta con personas de tu campus.' },
    { icon: Heart, title: 'Citas', description: 'Descubrimientos y compatibilidad.' },
    { icon: CalendarDays, title: 'Planes', description: 'Eventos y salidas casuales.' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">Anahuac Community</p>
              <p className="text-xs text-slate-400">Campus Connect</p>
            </div>
          </div>

          {session ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
              <Lock className="h-4 w-4" />
              Acceso @anahuac.mx
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {view === 'auth' && (
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-sm text-violet-200">
                <Shield className="h-4 w-4" />
                Plataforma universitaria segura
              </div>
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-white md:text-6xl">
                Conecta, descubre y crea comunidad dentro del campus.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-300">
                Comunidad estudiantil con perfiles, mensajería, amistades, citas y planes casuales, todo organizado para la vida universitaria.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {appCards.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="mb-3 inline-flex rounded-xl bg-violet-500/15 p-2 text-violet-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <p className="mt-1 text-sm text-slate-300">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-violet-950/30">
              <div className="mb-5 flex items-center gap-2 text-violet-300">
                <LogIn className="h-5 w-5" />
                <h2 className="text-2xl font-semibold">
                  {authMode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'}
                </h2>
              </div>

              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setMessage('')
                  }}
                  className={`rounded-lg px-3 py-2 transition ${authMode === 'login' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register')
                    setMessage('')
                  }}
                  className={`rounded-lg px-3 py-2 transition ${authMode === 'register' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Registrarse
                </button>
              </div>

              <form onSubmit={authMode === 'register' ? handleRegister : handlePasswordLogin} className="space-y-4">
                <label className="block text-sm text-slate-300">
                  Correo institucional
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@anahuac.mx"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition focus:border-violet-400"
                    required
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Contraseña
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    minLength={6}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
                    required
                  />
                </label>

                {authMode === 'login' && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 accent-violet-500"
                      />
                      Recordarme en este dispositivo
                    </label>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-violet-500 px-4 py-3 font-medium text-white transition hover:bg-violet-400 disabled:opacity-60"
                >
                  {loading ? 'Procesando...' : authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </form>

              {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
            </div>
          </section>
        )}

        {view === 'otp' && (
          <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-semibold text-white">Verifica tu código</h2>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <label className="block text-sm text-slate-300">
                Código de 6 dígitos
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? 'Verificando...' : 'Confirmar acceso'}
              </button>
            </form>
            {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
          </section>
        )}

        {view === 'set-password' && (
          <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
            <h2 className="mb-2 text-2xl font-semibold text-white">Crea tu contraseña</h2>
            <p className="mb-4 text-sm text-slate-300">Tu correo ya fue confirmado. Usa esta contraseña para iniciar sesión después.</p>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <label className="block text-sm text-slate-300">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
                  required
                />
              </label>
              <label className="block text-sm text-slate-300">
                Repite tu contraseña
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  minLength={6}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-500 px-4 py-3 font-medium text-white transition hover:bg-violet-400 disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
            {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
          </section>
        )}

        {view === 'dashboard' && (
          <section className="space-y-6">
            {!canUsePlatform && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                Tu dominio no está autorizado para ingresar a la plataforma.
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 lg:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Perfil</p>
                    <h2 className="text-2xl font-semibold text-white">Completa tu cuenta</h2>
                  </div>
                </div>

                <form onSubmit={handleCreateProfile} className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-slate-300 md:col-span-2">
                    Nombre completo
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
                    />
                  </label>

                  <label className="block text-sm text-slate-300">
                    Carrera
                    <input
                      type="text"
                      value={career}
                      onChange={(e) => setCareer(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400"
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
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                  <p className="text-sm text-slate-400">Estado</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="font-medium text-white">Sesión activa</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-300">{session?.user?.email || 'Sin correo'}</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                  <p className="text-sm text-slate-400">Acciones rápidas</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><Bell className="h-4 w-4 text-violet-300" /> Notificaciones</div>
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><MessageSquare className="h-4 w-4 text-violet-300" /> Mensajes</div>
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><Heart className="h-4 w-4 text-violet-300" /> Descubrir</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
