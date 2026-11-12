import { useState } from 'react'
import { supabase } from './supabase'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) return setError('Password: at least 8 characters.')
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Could not update the password. Try again.')
      setLoading(false)
    } else {
      onDone()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="glass w-full max-w-sm rounded-3xl p-8 space-y-4">
        <h1 className="text-xl font-bold text-center">New password</h1>
        <input
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="glass-input"
        />
        {error && <p className="text-sm text-center text-red-300">{error}</p>}
        <button disabled={loading} className="glass-btn w-full">
          {loading ? 'Please wait...' : 'Save'}
        </button>
      </form>
    </div>
  )
}
