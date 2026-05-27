import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Loader2 } from 'lucide-react'
import './Auth.css'

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Inscription réussie ! Vérifie tes emails.')
      }
    } catch (error) {
      setMessage(error.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('Entre ton email pour réinitialiser le mot de passe.')
      return
    }
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setMessage('Email de réinitialisation envoyé !')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <h1 className="auth-title">{isLogin ? 'Connexion' : 'Créer un compte'}</h1>
        
        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="password-wrapper">
            <div className="input-group">
              <Lock className="input-icon" size={20} />
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {isLogin && (
              <button 
                type="button" 
                className="forgot-password-link" 
                onClick={handleResetPassword}
              >
                Mot de passe oublié ?
              </button>
            )}
          </div>

          {message && <p className="auth-message">{message}</p>}

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? <Loader2 className="spinner" size={20} /> : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>

        <button 
          className="toggle-mode-button" 
          onClick={() => setIsLogin(!isLogin)}
          type="button"
        >
          {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  )
}