import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Check } from 'lucide-react'

export default function AddBankModal({ isOpen, onClose, onSuccess }) {
  const [nom, setNom] = useState('')
  const [solde, setSolde] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nom) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('comptes_bancaires')
        .insert({
          user_id: user.id,
          nom: nom,
          solde: parseFloat(solde) || 0
        })

      if (error) throw error

      setNom('')
      setSolde('')
      onSuccess()
    } catch (err) {
      alert("Erreur : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Ajouter un compte bancaire</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-form">
          <div className="input-group-vertical">
            <label>Nom de la banque / du compte</label>
            <input 
              type="text" 
              placeholder="Ex: Courant LCL, Livret A..." 
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="input-group-vertical">
            <label>Solde actuel (€)</label>
            <input 
              type="number" 
              step="0.01"
              placeholder="0.00" 
              value={solde}
              onChange={(e) => setSolde(e.target.value)}
            />
          </div>

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : <><Check size={20} /> Ajouter</>}
          </button>
        </form>
      </div>
    </div>
  )
}