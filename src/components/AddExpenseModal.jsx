import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Check } from 'lucide-react'
import './AddExpenseModal.css'

export default function AddExpenseModal({ isOpen, onClose, onSuccess }) {
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [compteId, setCompteId] = useState('')
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) fetchComptes()
  }, [isOpen])

  const fetchComptes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('comptes_bancaires')
      .select('id, nom, solde')
      .eq('user_id', user.id)
    
    setComptes(data || [])
    if (data && data.length > 0) {
      // On garde l'ID tel quel (c'est déjà une string/uuid)
      setCompteId(data[0].id)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!libelle || !montant || !compteId) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const montantNum = parseFloat(montant)
      
      // On ne fait PAS de parseInt() ici car compteId est un UUID (ex: "550e8400-e29b...")
      const compteSelectionne = comptes.find(c => c.id === compteId)

      // 1. Enregistrer la dépense
      const { error: insertError } = await supabase.from('depenses_variables').insert({
        user_id: user.id,
        libelle,
        montant: montantNum,
        compte_id: compteId // Envoi direct de l'UUID
      })
      if (insertError) throw insertError

      setLibelle(''); setMontant(''); onSuccess()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Nouvelle dépense</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-form">
          {error && <p className="error-message" style={{color: 'red', fontSize: '12px'}}>{error}</p>}
          
          <div className="input-group-vertical">
            <label>Quoi ?</label>
            <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} required />
          </div>

          <div className="input-group-vertical">
            <label>Quel compte ?</label>
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde}€)</option>)}
            </select>
          </div>

          <div className="input-group-vertical">
            <label>Combien ? (€)</label>
            <input type="number" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
          </div>

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : <><Check size={20} /> Ajouter</>}
          </button>
        </form>
      </div>
    </div>
  )
}