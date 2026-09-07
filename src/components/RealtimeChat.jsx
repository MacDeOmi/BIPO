import { MessageSquareText } from 'lucide-react'
import { useEffect, useState } from 'react'

export function RealtimeChat({ supabase, session }) {
  const [messages, setMessages] = useState([
    { id: '1', sender: 'Diana', content: '¿Alguien va a la biblioteca?', incoming: true },
    { id: '2', sender: 'Tú', content: 'Sí, estoy en el segundo piso.', incoming: false },
  ])

  useEffect(() => {
    if (!supabase || !session?.user) return undefined

    const channel = supabase.channel('chat-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const incoming = payload.new.sender_id !== session.user.id
          setMessages((current) => [
            ...current,
            {
              id: payload.new.id,
              sender: incoming ? 'Nuevo mensaje' : 'Tú',
              content: payload.new.content,
              incoming,
            },
          ])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, session])

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm text-slate-400">Mensajes</p>
          <h3 className="text-xl font-semibold text-white">Chat en tiempo real</h3>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-2xl p-3 text-sm ${
              message.incoming
                ? 'bg-slate-800 text-slate-200'
                : 'ml-auto bg-violet-500/80 text-white'
            }`}
          >
            <p className="mb-1 text-[10px] uppercase tracking-wide text-white/70">{message.sender}</p>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
