import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Heart,
  MessageCircle,
  MessageSquare,
  Plus,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { DatingPanel } from './DatingPanel'
import { SocialProfilePanel } from './SocialProfilePanel'

const tabs = [
  { id: 'threads', label: 'Hilos', icon: MessageSquare },
  { id: 'friends', label: 'Amistades', icon: Users },
  { id: 'dating', label: 'Citas', icon: Heart },
  { id: 'plans', label: 'Planes', icon: CalendarDays },
  { id: 'messages', label: 'Mensajes', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: UserPlus },
]

export function CommunityDashboard({ supabase, session, profile }) {
  const [activeTab, setActiveTab] = useState('threads')
  const [threads, setThreads] = useState([])
  const [friends, setFriends] = useState([])
  const [profiles, setProfiles] = useState([])
  const [datingProfiles, setDatingProfiles] = useState([])
  const [plans, setPlans] = useState([])
  const [messages, setMessages] = useState([])
  const [messageRequests, setMessageRequests] = useState([])
  const [follows, setFollows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [threadText, setThreadText] = useState('')
  const [planForm, setPlanForm] = useState({ title: '', description: '', category: 'Social', meet_time: '' })
  const [lookingFor, setLookingFor] = useState('')
  const [friendTarget, setFriendTarget] = useState('')
  const [selectedFriend, setSelectedFriend] = useState('')
  const [messageText, setMessageText] = useState('')
  const [editingThread, setEditingThread] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [selectedProfileId, setSelectedProfileId] = useState(session.user.id)

  useEffect(() => {
    if (!supabase || !session?.user) return undefined

    let mounted = true
    const loadData = async () => {
      setLoading(true)
      const [profilesResult, threadsResult, friendsResult, datingResult, plansResult, messagesResult, followsResult, requestsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, career, semester, bio, avatar_url, role, is_banned'),
        supabase.from('threads').select('id, user_id, content, likes_count, created_at').order('created_at', { ascending: false }),
        supabase.from('friendships').select('id, requester_id, addressee_id, status').order('created_at', { ascending: false }),
        supabase.from('dating_profiles').select('id, user_id, looking_for, prompt_answers, is_active').eq('is_active', true),
        supabase.from('casual_plans').select('id, creator_id, title, description, category, meet_time, max_participants').order('meet_time', { ascending: true }),
        supabase.from('messages').select('id, sender_id, receiver_id, content, created_at').or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`).order('created_at', { ascending: true }),
        supabase.from('follows').select('follower_id, following_id'),
        supabase.from('message_requests').select('id, sender_id, receiver_id, content, status, created_at').or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`).eq('status', 'pending').order('created_at', { ascending: false }),
      ])

      const result = [profilesResult, threadsResult, friendsResult, datingResult, plansResult, messagesResult, followsResult, requestsResult].find((item) => item.error)
      if (result?.error) {
        if (mounted) setError(result.error.message)
      } else if (mounted) {
        setProfiles(profilesResult.data || [])
        setThreads(threadsResult.data || [])
        setFriends(friendsResult.data || [])
        setDatingProfiles(datingResult.data || [])
        setPlans(plansResult.data || [])
        setMessages(messagesResult.data || [])
        setFollows(followsResult.data || [])
        setMessageRequests(requestsResult.data || [])
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
  const openProfile = (id) => {
    setSelectedProfileId(id)
    setActiveTab('profile')
  }
  const openMessageComposer = (id) => {
    setSelectedFriend(id)
    setActiveTab('messages')
  }
  const canModerate = profile?.role === 'admin' || profile?.role === 'moderator'
  const acceptedFriends = friends.filter((friend) => friend.status === 'accepted' && (friend.requester_id === session.user.id || friend.addressee_id === session.user.id))
  const friendIds = acceptedFriends.map((friend) => friend.requester_id === session.user.id ? friend.addressee_id : friend.requester_id)
  const followsMutually = (targetId) => follows.some((follow) => follow.follower_id === session.user.id && follow.following_id === targetId)
    && follows.some((follow) => follow.follower_id === targetId && follow.following_id === session.user.id)

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
    const table = followsMutually(selectedFriend) ? 'messages' : 'message_requests'
    const payload = table === 'messages'
      ? { sender_id: session.user.id, receiver_id: selectedFriend, content: messageText.trim(), type: 'direct' }
      : { sender_id: session.user.id, receiver_id: selectedFriend, content: messageText.trim(), status: 'pending' }
    const { error: insertError } = await supabase.from(table).insert(payload)
    if (insertError) setError(insertError.message)
    else {
      setMessageText('')
      setError(table === 'messages' ? '' : 'Mensaje enviado a solicitudes.')
    }
    setReload((value) => value + 1)
  }

  const respondToMessageRequest = async (requestId, status) => {
    const { error: updateError } = await supabase.from('message_requests').update({ status }).eq('id', requestId).eq('receiver_id', session.user.id)
    if (updateError) setError(updateError.message)
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

  const updateThread = async (event) => {
    event.preventDefault()
    if (!editingThread?.content.trim()) return
    const { error: updateError } = await supabase.from('threads').update({ content: editingThread.content.trim() }).eq('id', editingThread.id).eq('user_id', session.user.id)
    if (updateError) setError(updateError.message)
    else setEditingThread(null)
    setReload((value) => value + 1)
  }

  const updatePlan = async (event) => {
    event.preventDefault()
    const { error: updateError } = await supabase.from('casual_plans').update({
      title: editingPlan.title,
      description: editingPlan.description,
      category: editingPlan.category,
      meet_time: editingPlan.meet_time,
    }).eq('id', editingPlan.id).eq('creator_id', session.user.id)
    if (updateError) setError(updateError.message)
    else setEditingPlan(null)
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
          <div className="flex items-center justify-between text-sm"><button onClick={() => openProfile(thread.user_id)} className="font-semibold text-violet-300 hover:underline">{profileName(thread.user_id)}</button><span className="text-slate-500">{new Date(thread.created_at).toLocaleString()}</span></div>
          <p className="mt-3 text-slate-200">{thread.content}</p>
          <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{thread.likes_count || 0} reacciones</span><span className="flex gap-3">{thread.user_id === session.user.id && <button onClick={() => setEditingThread({ id: thread.id, content: thread.content })} className="inline-flex items-center gap-1 text-violet-300"><Pencil className="h-3 w-3" />Editar</button>}{(thread.user_id === session.user.id || canModerate) && <button onClick={() => deleteContent('threads', thread.id)} className="text-rose-300">Eliminar</button>}</span></div>
          {editingThread?.id === thread.id && <form onSubmit={updateThread} className="mt-3 flex gap-2"><input value={editingThread.content} onChange={(event) => setEditingThread({ ...editingThread, content: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" /><button className="rounded-lg bg-violet-500 px-3 py-2 text-xs">Guardar</button><button type="button" onClick={() => setEditingThread(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancelar</button></form>}
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
      {datingProfiles.map((dating) => <div key={dating.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><button onClick={() => openProfile(dating.user_id)} className="font-semibold text-violet-300 hover:underline">{profileName(dating.user_id)}</button><p className="mt-2 text-sm text-slate-300">{dating.looking_for || 'Disponible para conocer personas'}</p></div>)}
    </div>
  )

  const renderPlans = () => (
    <div className="space-y-4">
      <form onSubmit={createPlan} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:grid-cols-2"><input required value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} placeholder="Título del plan" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><input required value={planForm.category} onChange={(event) => setPlanForm({ ...planForm, category: event.target.value })} placeholder="Categoría" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><textarea required value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} placeholder="Descripción" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white md:col-span-2" /><input required type="datetime-local" value={planForm.meet_time} onChange={(event) => setPlanForm({ ...planForm, meet_time: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /><button className="rounded-xl bg-violet-500 px-4 py-3">Crear plan</button></form>
      {plans.map((plan) => <div key={plan.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex justify-between"><strong>{plan.title}</strong><span className="text-sm text-slate-400">{new Date(plan.meet_time).toLocaleString()}</span></div><p className="mt-2 text-sm text-slate-300">{plan.description}</p><p className="mt-2 text-xs text-slate-500">{plan.category} · creado por <button onClick={() => openProfile(plan.creator_id)} className="text-violet-300 hover:underline">{profileName(plan.creator_id)}</button></p><div className="mt-3 flex gap-3 text-xs">{plan.creator_id === session.user.id && <button onClick={() => setEditingPlan({ ...plan, meet_time: plan.meet_time.slice(0, 16) })} className="inline-flex items-center gap-1 text-violet-300"><Pencil className="h-3 w-3" />Editar</button>}{(plan.creator_id === session.user.id || canModerate) && <button onClick={() => deleteContent('casual_plans', plan.id)} className="text-rose-300">Eliminar</button>}</div>{editingPlan?.id === plan.id && <form onSubmit={updatePlan} className="mt-3 grid gap-2"><input required value={editingPlan.title} onChange={(event) => setEditingPlan({ ...editingPlan, title: event.target.value })} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" /><textarea required value={editingPlan.description} onChange={(event) => setEditingPlan({ ...editingPlan, description: event.target.value })} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" /><div className="flex gap-2"><input required value={editingPlan.category} onChange={(event) => setEditingPlan({ ...editingPlan, category: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" /><input required type="datetime-local" value={editingPlan.meet_time} onChange={(event) => setEditingPlan({ ...editingPlan, meet_time: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" /></div><div className="flex gap-2"><button className="rounded-lg bg-violet-500 px-3 py-2 text-xs">Guardar</button><button type="button" onClick={() => setEditingPlan(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancelar</button></div></form>}</div>)}
    </div>
  )

  const renderMessages = () => (
    <div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">Solicitudes de mensajes</h4><span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-200">{messageRequests.filter((request) => request.receiver_id === session.user.id).length}</span></div>{messageRequests.filter((request) => request.receiver_id === session.user.id).map((request) => <div key={request.id} className="border-t border-white/10 py-3"><button onClick={() => openProfile(request.sender_id)} className="font-medium text-violet-300 hover:underline">{profileName(request.sender_id)}</button><p className="my-2 text-sm text-slate-300">{request.content}</p><div className="flex gap-2"><button onClick={() => respondToMessageRequest(request.id, 'accepted')} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs">Aceptar</button><button onClick={() => respondToMessageRequest(request.id, 'rejected')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs">Rechazar</button></div></div>)}{!messageRequests.some((request) => request.receiver_id === session.user.id) && <p className="text-sm text-slate-400">No tienes solicitudes pendientes.</p>}</div><select value={selectedFriend} onChange={(event) => setSelectedFriend(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"><option value="">Selecciona una persona</option>{profiles.filter((user) => user.id !== session.user.id).map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>{selectedFriend && !followsMutually(selectedFriend) && <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">Esta persona no te sigue mutuamente. Tu primer mensaje se enviará como solicitud y deberá aceptarlo para abrir el chat libre.</div>}<div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4">{messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.sender_id === session.user.id ? 'ml-8 bg-violet-500/30' : 'mr-8 bg-slate-800'}`}>{message.content}</div>)}</div><form onSubmit={sendMessage} className="flex gap-3"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Escribe un mensaje" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white" /><button className="rounded-xl bg-emerald-500 px-4 py-3">Enviar</button></form></div>
  )

  const renderAdmin = () => (
    <div className="space-y-3">{profiles.map((user) => <div key={user.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4"><span>{user.full_name} · {user.role}</span><button onClick={() => moderateProfile(user.id, !user.is_banned)} className="text-sm text-amber-300">{user.is_banned ? 'Desbanear' : 'Banear'}</button></div>)}</div>
  )

  const renderContent = () => {
    if (loading) return <p className="text-sm text-slate-400">Cargando módulos...</p>
    if (activeTab === 'threads') return renderThreads()
    if (activeTab === 'friends') return renderFriends()
    if (activeTab === 'dating') return <DatingPanel supabase={supabase} session={session} profiles={profiles} />
    if (activeTab === 'plans') return renderPlans()
    if (activeTab === 'profile') return <SocialProfilePanel supabase={supabase} session={session} profiles={profiles} selectedProfileId={selectedProfileId} onSelectProfile={setSelectedProfileId} onMessage={openMessageComposer} />
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
