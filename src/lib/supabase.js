import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const sessionStorageAdapter = {
  getItem: (key) => {
    const storage = localStorage.getItem('bipo_remember') === 'false' ? sessionStorage : localStorage
    return storage.getItem(key)
  },
  setItem: (key, value) => {
    const storage = localStorage.getItem('bipo_remember') === 'false' ? sessionStorage : localStorage
    storage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: sessionStorageAdapter,
      },
    })
  : null
