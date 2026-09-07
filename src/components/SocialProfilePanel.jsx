import { useEffect, useState } from 'react'
import { UserPlus, UserRound } from 'lucide-react'

export function SocialProfilePanel({ supabase, session, profiles }) {
  const [selectedId, setSelectedId] = useState(session.user.id)
  const [profile, setProfile] = useState(null)
  const [threads, setThreads] = useState([])
  const [plans, setPlans] = useState([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', selectedId).single()
      const [{ data: threadData }, { data: planData }, { count: followerCount }, { count: followingCount }, { data: relation }] = await Promise.all([
        supabase.from('threads').select('*').eq('user_id', selectedId).order('created_at', { ascending: false }),
        supabase.from('casual_plans').select('*').eq('creator_id', selectedId).order('meet_time'),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', selectedId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', selectedId),
        supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', selectedId).maybeSingle(),
      ])
      setProfile(profileData)
      setThreads(threadData || [])
      setPlans(planData || [])
      setFollowers(followerCount || 0)
      setFollowing(followingCount || 0)
      setIsFollowing(Boolean(relation))
    }
    load()
  }, [supabase, selectedId, session])

  const toggleFollow = async () => {
    if (selectedId === session.user.id) return
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', selectedId)
    else await supabase.from('follows').insert({ follower_id: session.user.id, following_id: selectedId })
    setIsFollowing(!isFollowing)
    setFollowers((value) => value + (isFollowing ? -1 : 1))
  }

  return <div className="space-y-5"><div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="grid h-16 w-16 place-items-center rounded-full bg-violet-500/20 text-violet-300"><UserRound /></div><div className="flex-1"><h3 className="text-2xl font-bold">{profile?.full_name || 'Perfil'}</h3><p className="text-sm text-slate-400">{profile?.career} · semestre {profile?.semester}</p><div className="mt-2 flex gap-4 text-sm"><span><strong>{followers}</strong> seguidores</span><span><strong>{following}</strong> seguidos</span></div></div>{selectedId !== session.user.id && <button onClick={toggleFollow} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2"><UserPlus className="h-4 w-4" />{isFollowing ? 'Dejar de seguir' : 'Seguir'}</button>}</div><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white"><option value={session.user.id}>Mi perfil</option>{profiles.filter((item) => item.id !== session.user.id).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><h4 className="mb-3 font-semibold">Hilos</h4>{threads.map((thread) => <p key={thread.id} className="border-b border-white/10 py-2 text-sm text-slate-300">{thread.content}</p>)}</div><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><h4 className="mb-3 font-semibold">Planes casuales</h4>{plans.map((plan) => <div key={plan.id} className="border-b border-white/10 py-2 text-sm"><p>{plan.title}</p><p className="text-slate-400">{plan.description}</p></div>)}</div></div></div>
}
