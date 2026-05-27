import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import './Auth.css' // On réutilise le style de la page de connexion

export default function UpdatePassword({ onComplete }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error
      
      // Succès : on signale à l'application que c'est terminé
      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <h2>Nouveau mot de passe</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
          Définis ton nouveau mot de passe sécurisé.
        </p>
        
        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleUpdate} className="auth-form">
          <div className="input-group">
            <label>Nouveau mot de passe</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              autoFocus
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}