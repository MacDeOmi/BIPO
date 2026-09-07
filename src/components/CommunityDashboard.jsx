import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Heart,
  MessageCircle,
  MessageSquare,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'

const tabs = [
  { id: 'threads', label: 'Hilos', icon: MessageSquare },
  { id: 'friends', label: 'Amistades', icon: Users },
  { id: 'dating', label: 'Citas', icon: Heart },
  { id: 'plans', label: 'Planes', icon: CalendarDays },
  { id: 'messages', label: 'Mensajes', icon: MessageCircle },
]

export function CommunityDashboard({ supabase, session, profile }) {
  const [activeTab, setActiveTab] = useState('threads')
  const [threads, setThreads] = useState([])
  const [friends, setFriends] = useState([])
  const [profiles, setProfiles] = useState([])
  const [datingProfiles, setDatingProfiles] = useState([])
  const [plans, setPlans] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [threadText, setThreadText] = useState('')
  const [planForm, setPlanForm] = useState({ title: '', description: '', category: 'Social', meet_time: '' })
  const [lookingFor, setLookingFor] = useState('')
  const [friendTarget, setFriendTarget] = useState('')
  const [selectedFriend, setSelectedFriend] = useState('')
  const [messageText, setMessageText] = useState('')

  useEffect(() => {
    if (!supabase || !session?.user) return undefined

    let mounted = true
    const loadData = async () => {
      setLoading(true)
      const [profilesResult, threadsResult, friendsResult, datingResult, plansResult, messagesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, is_banned'),
        supabase.from('threads').select('id, user_id, content, likes_count, created_at').order('created_at', { ascending: false }),
        supabase.from('friendships').select('id, requester_id, addressee_id, status').order('created_at', { ascending: false }),
        supabase.from('dating_profiles').select('id, user_id, looking_for, prompt_answers, is_active').eq('is_active', true),
        supabase.from('casual_plans').select('id, creator_id, title, description, category, meet_time, max_participants').order('meet_time', { ascending: true }),
        supabase.from('messages').select('id, sender_id, receiver_id, content, created_at').or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`).order('created_at', { ascending: true }),
      ])

      const result = [profilesResult, threadsResult, friendsResult, datingResult, plansResult, messagesResult].find((item) => item.error)
      if (result?.error) {
        if (mounted) setError(result.error.message)
      } else if (mounted) {
        setProfiles(profilesResult.data || [])
        setThreads(threadsResult.data || [])
        setFriends(friendsResult.data || [])
        setDatingProfiles(datingResult.data || [])
        setPlans(plansResult.data || [])
        setMessages(messagesResult.data || [])
        setError('')
      }
      if (mounted) setLoading(false)
    }

    loadData()
    const channel = supabase.channel(`community-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => setReload((value) => value + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => setReload((value) => value + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dating_profiles' }, () => setReload((value) => value + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casual_plans' }, () => setReload((value) => value + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => setReload((value) => value + 1))
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase, session, reload])

  const profileName = (id) => profiles.find((item) => item.id === id)?.full_name || 'Usuario'
  const canModerate = profile?.role === 'admin' || profile?.role === 'moderator'
  const acceptedFriends = friends.filter((friend) => friend.status === 'accepted' && (friend.requester_id === session.user.id || friend.addressee_id === session.user.id))
  const friendIds = acceptedFriends.map((friend) => friend.requester_id === session.user.id ? friend.addressee_id : friend.requester_id)

  const createThread = async (event) => {
    event.preventDefault()
    if (!threadText.trim()) return
    const { error: insertError } = await supabase.from('threads').insert({ user_id: session.user.id, content: threadText.trim() })
    if (insertError) setError(insertError.message)
    else setThreadText('')
    setReload((value) => value + 1)
  }

  const createPlan = async (event) => {
    event.preventDefault()
    const { error: insertError } = await supabase.from('casual_plans').insert({ ...planForm, creator_id: session.user.id })
    if (insertError) setError(insertError.message)
    else setPlanForm({ title: '', description: '', category: 'Social', meet_time: '' })
    setReload((value) => value + 1)
  }

  const saveDatingProfile = async (event) => {
    event.preventDefault()
    const { error: insertError } = await supabase.from('dating_profiles').upsert({ user_id: session.user.id, looking_for: lookingFor, is_active: true })
    if (insertError) setError(insertError.message)
    else setError('Perfil de citas guardado.')
    setReload((value) => value + 1)
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!selectedFriend || !messageText.trim()) return
    const { error: insertError } = await supabase.from('messages').insert({ sender_id: session.user.id, receiver_id: selectedFriend, content: messageText.trim(), type: 'direct' })
    if (insertError) setError(insertError.message)
    else setMessageText('')
    setReload((value) => value + 1)
  }

  const sendFriendRequest = async (event) => {
    event.preventDefault()
    if (!friendTarget) return
    const { error: insertError } = await supabase.from('friendships').insert({ requester_id: session.user.id, addressee_id: friendTarget, status: 'pending' })
    if (insertError) setError(insertError.message)
    else setFriendTarget('')
    setReload((value) => value + 1)
  }

  const moderateProfile = async (userId, isBanned) => {
    if (!canModerate) return
    const { error: updateError } = await supabase.from('profiles').update({ is_banned: isBanned }).eq('id', userId)
    if (updateError) setError(updateError.message)
    setReload((value) => value + 1)
  }

  const deleteContent = async (table, id) => {
    if (table === 'casual_plans' && !canModerate) return
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    setReload((value) => value + 1)
  }

  const renderThreads = () => (
    <div className="space-y-4">
      <form onSubmit={createThread} className="flex gap-3">
        <input value={threadText} onChange={(event) => setThreadText(event.target.value)} placeholder="Comparte algo con la comunidad" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-400" />
        <button className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 font-medium text-white"><Plus className="h-4 w-4" /> Publicar</button>
      </form>
      {threads.map((thread) => (
        <article key={thread.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between text-sm"><strong>{profileName(thread.user_id)}</strong><span className="text-slate-500">{new Date(thread.created_at).toLocaleString()}</span></div>
          <p className="mt-3 text-slate-200">{thread.content}</p>
          <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{thread.likes_count || 0} reacciones</span>{(thread.user_id === session.user.id || canModerate) && <button onClick={() => deleteContent('threads', thread.id)} className="text-rose-300">Eliminar</button>}</div>
        </article>
      ))}
      {!threads.length && <p className="text-sm text-slate-400">Todavía no hay hilos.</p>}
    </div>
  )

  const renderFriends = () => (
    <div className="space-y-3">
      <form onSubmit={sendFriendRequest} className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <select value={friendTarget} onChange={(event) => setFriendTarget(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"><option value="">Selecciona una persona</option>{profiles.filter((user) => user.id !== session.user.id && !friends.some((friend) => friend.requester_id === user.id || friend.addressee_id === user.id)).map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>
        <button className="rounded-xl bg-violet-500 px-4 py-3 text-sm">Enviar solicitud</button>
      </form>
      {friends.map((friend) => {
        const otherId = friend.requester_id === session.user.id ? friend.addressee_id : friend.requester_id
        const canAccept = friend.addressee_id === session.user.id && friend.status === 'pending'
        return <div key={friend.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4"><span>{profileName(otherId)}</span><span className="flex items-center gap-3 text-sm text-slate-400">{canAccept && <button onClick={async () => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friend.id); setReload((value) => value + 1) }} className="text-emerald-300">Aceptar</button>}{friend.status}</span></div>
      })}
      {!friends.length && <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300"><UserPlus className="mr-2 inline h-4 w-4" /> Aún no tienes solicitudes o amistades.</div>}
    </div>
  )

  const renderDating = () => (
    <div className="space-y-4">
      <form onSubmit={saveDatingProfile} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><label className="block text-sm text-slate-300">¿Qué estás buscando?<input value={lookingFor} onChange={(event) => setLookingFor(event.target.value)} placeholder="Amistad, conocer personas..." className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label><button className="mt-3 rounded-xl bg-violet-500 px-4 py-2 text-sm">Guardar perfil de citas</button></form>
      {datingProfiles.map((dating) => <div key={dating.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><strong>{profileName(dating.user_id)}</strong><p className="mt-2 text-sm text-slate-300">{dating.looking_for || 'Disponible para conocer personas'}</p></div>)}
    </div>
  )

  const renderPlans = () => (
    <div className="space-y-4">
      <form onSubmit={createPlan} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:grid-cols-2"><input required value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} placeholder="Título del plan" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><input required value={planForm.category} onChange={(event) => setPlanForm({ ...planForm, category: event.target.value })} placeholder="Categoría" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><textarea required value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} placeholder="Descripción" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white md:col-span-2" /><input required type="datetime-local" value={planForm.meet_time} onChange={(event) => setPlanForm({ ...planForm, meet_time: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><button className="rounded-xl bg-violet-500 px-4 py-3">Crear plan</button></form>
      {plans.map((plan) => <div key={plan.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex justify-between"><strong>{plan.title}</strong><span className="text-sm text-slate-400">{new Date(plan.meet_time).toLocaleString()}</span></div><p className="mt-2 text-sm text-slate-300">{plan.description}</p><p className="mt-2 text-xs text-slate-500">{plan.category} · creado por {profileName(plan.creator_id)}</p>{canModerate && <button onClick={() => deleteContent('casual_plans', plan.id)} className="mt-3 text-xs text-rose-300">Eliminar</button>}</div>)}
    </div>
  )

  const renderMessages = () => (
    <div className="space-y-4"><select value={selectedFriend} onChange={(event) => setSelectedFriend(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"><option value="">Selecciona una amistad aceptada</option>{friendIds.map((id) => <option key={id} value={id}>{profileName(id)}</option>)}</select><div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4">{messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.sender_id === session.user.id ? 'ml-8 bg-violet-500/30' : 'mr-8 bg-slate-800'}`}>{message.content}</div>)}</div><form onSubmit={sendMessage} className="flex gap-3"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Escribe un mensaje" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white" /><button className="rounded-xl bg-emerald-500 px-4 py-3">Enviar</button></form></div>
  )

  const renderAdmin = () => (
    <div className="space-y-3">{profiles.map((user) => <div key={user.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4"><span>{user.full_name} · {user.role}</span><button onClick={() => moderateProfile(user.id, !user.is_banned)} className="text-sm text-amber-300">{user.is_banned ? 'Desbanear' : 'Banear'}</button></div>)}</div>
  )

  const renderContent = () => {
    if (loading) return <p className="text-sm text-slate-400">Cargando módulos...</p>
    if (activeTab === 'threads') return renderThreads()
    if (activeTab === 'friends') return renderFriends()
    if (activeTab === 'dating') return renderDating()
    if (activeTab === 'plans') return renderPlans()
    return renderMessages()
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${activeTab === id ? 'bg-violet-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}><Icon className="h-4 w-4" />{label}</button>)}
        {canModerate && <button onClick={() => setActiveTab('admin')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${activeTab === 'admin' ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}><ShieldCheck className="h-4 w-4" />Moderación</button>}
      </div>
      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6"><h2 className="mb-5 text-2xl font-semibold text-white">{tabs.find((tab) => tab.id === activeTab)?.label || 'Moderación'}</h2>{activeTab === 'admin' ? renderAdmin() : renderContent()}</div>
    </section>
  )
}
