import { useEffect, useState } from 'react'
import { Heart, ImagePlus, RotateCcw, X } from 'lucide-react'

export function DatingPanel({ supabase, session, profiles }) {
  const [datingProfile, setDatingProfile] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [index, setIndex] = useState(0)
  const [setup, setSetup] = useState({ gender: '', preferredGenders: '', bio: '', interests: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: own } = await supabase.from('dating_profiles').select('*').eq('user_id', session.user.id).maybeSingle()
      setDatingProfile(own)
      if (!own?.avatar_url) return
      const { data: actions } = await supabase.from('dating_actions').select('target_id').eq('actor_id', session.user.id)
      const excluded = (actions || []).map((action) => action.target_id)
      const filtered = profiles.filter((profile) => profile.id !== session.user.id && !excluded.includes(profile.id))
      setCandidates(filtered)
    }
    load()
  }, [supabase, session, profiles])

  const saveSetup = async (event) => {
    event.preventDefault()
    if (!avatarFile) {
      setMessage('La foto principal es obligatoria para activar Citas.')
      return
    }
    const path = `${session.user.id}/${Date.now()}-${avatarFile.name}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
    if (uploadError) {
      setMessage(uploadError.message)
      return
    }
    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await supabase.from('dating_profiles').upsert({
      user_id: session.user.id,
      avatar_url: publicUrl.publicUrl,
      gender: setup.gender,
      preferred_genders: setup.preferredGenders.split(',').map((item) => item.trim()).filter(Boolean),
      bio: setup.bio,
      interests: setup.interests.split(',').map((item) => item.trim()).filter(Boolean),
      is_active: true,
    })
    if (error) setMessage(error.message)
    else {
      setDatingProfile({ avatar_url: publicUrl.publicUrl })
      setMessage('Perfil de citas activado.')
    }
  }

  const act = async (action) => {
    const target = candidates[index]
    if (!target) return
    const { error } = await supabase.from('dating_actions').upsert({ actor_id: session.user.id, target_id: target.id, action })
    if (error) setMessage(error.message)
    else {
      setMessage(action === 'like' ? 'Me gusta enviado.' : 'Perfil rechazado.')
      setIndex((value) => value + 1)
    }
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') act('reject')
      if (event.key === 'ArrowRight') act('like')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!datingProfile?.avatar_url) {
    return <div className="space-y-4"><div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100"><ImagePlus className="mr-2 inline h-5 w-5" />Configura tu perfil de citas antes de descubrir personas.</div><form onSubmit={saveSetup} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"><label className="text-sm text-slate-300">Foto principal<input required type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300" /></label><select required value={setup.gender} onChange={(event) => setSetup({ ...setup, gender: event.target.value })} className="rounded-xl bg-slate-900 p-3 text-white"><option value="">Tu género</option><option>Hombre</option><option>Mujer</option><option>No binario</option></select><input value={setup.preferredGenders} onChange={(event) => setSetup({ ...setup, preferredGenders: event.target.value })} placeholder="Preferencias: Hombre, Mujer" className="rounded-xl bg-slate-900 p-3 text-white" /><textarea value={setup.bio} onChange={(event) => setSetup({ ...setup, bio: event.target.value })} placeholder="Biografía corta" className="rounded-xl bg-slate-900 p-3 text-white" /><input value={setup.interests} onChange={(event) => setSetup({ ...setup, interests: event.target.value })} placeholder="Intereses separados por comas" className="rounded-xl bg-slate-900 p-3 text-white" /><button className="rounded-xl bg-violet-500 p-3">Guardar configuración</button></form>{message && <p className="text-sm text-amber-300">{message}</p>}</div>
  }

  const candidate = candidates[index]
  return <div className="space-y-4"><div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl">{candidate ? <><div className="grid aspect-[4/5] place-items-end bg-gradient-to-br from-violet-950 to-slate-800 p-6"><div><p className="text-2xl font-bold">{candidate.full_name}</p><p className="text-slate-300">{candidate.career} · semestre {candidate.semester}</p><p className="mt-2 text-sm text-slate-300">{candidate.bio}</p></div></div><div className="flex justify-center gap-5 p-5"><button onClick={() => act('reject')} className="grid h-14 w-14 place-items-center rounded-full bg-slate-800 text-rose-300"><X /></button><button onClick={() => setIndex(Math.max(0, index - 1))} className="grid h-14 w-14 place-items-center rounded-full bg-slate-800 text-amber-300"><RotateCcw /></button><button onClick={() => act('like')} className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white"><Heart /></button></div></> : <div className="p-8 text-center text-slate-300">No hay más perfiles por ahora.</div>}</div>{message && <p className="text-center text-sm text-amber-300">{message}</p>}</div>
}
