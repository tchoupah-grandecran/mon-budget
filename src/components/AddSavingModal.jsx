import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Check } from 'lucide-react'
import './AddExpenseModal.css'

export default function AddSavingModal({ isOpen, onClose, onSuccess, comptesBanque = [] }) {
  const [formData, setFormData] = useState({
    nom: '', 
    montant_actuel: '', 
    objectif_total: '', 
    date_objectif: '', 
    horizon: 'court_terme', 
    compte_bancaire_id: ''
  })
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // On prépare les données en s'assurant que l'ID est bien un UUID ou null
      const insertData = {
        user_id: user.id,
        nom: formData.nom,
        montant_actuel: parseFloat(formData.montant_actuel) || 0,
        objectif_total: parseFloat(formData.objectif_total) || 0,
        date_objectif: formData.date_objectif || null,
        horizon: formData.horizon,
        // On force null si la chaîne est vide pour que la contrainte FK soit contente
        compte_bancaire_id: formData.compte_bancaire_id === '' ? null : formData.compte_bancaire_id
      }

      const { error } = await supabase.from('sous_comptes_epargne').insert(insertData)

      if (error) throw error

      setFormData({ nom: '', montant_actuel: '', objectif_total: '', date_objectif: '', horizon: 'court_terme', compte_bancaire_id: '' })
      onSuccess()
    } catch (err) {
      console.error("Erreur lors de l'ajout :", err)
      alert("Erreur : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Nouvelle épargne</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-form">
          <div className="input-group-vertical">
            <label>Nom de l'objectif</label>
            <input type="text" placeholder="ex: Vacances" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group-vertical">
              <label>Actuel</label>
              <input type="number" step="0.01" placeholder="0" value={formData.montant_actuel} onChange={e => setFormData({...formData, montant_actuel: e.target.value})} />
            </div>
            <div className="input-group-vertical">
              <label>Objectif</label>
              <input type="number" step="0.01" placeholder="0" value={formData.objectif_total} onChange={e => setFormData({...formData, objectif_total: e.target.value})} />
            </div>
          </div>

          <div className="input-group-vertical">
            <label>Date limite</label>
            <input type="date" value={formData.date_objectif} onChange={e => setFormData({...formData, date_objectif: e.target.value})} />
          </div>

          <div className="input-group-vertical">
            <label>Rattachement</label>
            <select value={formData.compte_bancaire_id} onChange={e => setFormData({...formData, compte_bancaire_id: e.target.value})}>
              <option value="">Aucun compte lié</option>
              {comptesBanque.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>

          <div className="radio-group">
            {['court_terme', 'long_terme'].map((h) => (
              <button key={h} type="button" className={`radio-btn ${formData.horizon === h ? 'active' : ''}`} onClick={() => setFormData({...formData, horizon: h})}>
                {h === 'court_terme' ? 'Court terme' : 'Long terme'}
              </button>
            ))}
          </div>

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : <><Check size={20}/> Créer l'objectif</>}
          </button>
        </form>
      </div>
    </div>
  )
}