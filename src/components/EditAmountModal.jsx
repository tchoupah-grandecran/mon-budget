import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Check } from 'lucide-react'

export default function EditAmountModal({ isOpen, onClose, onSuccess, item, type, comptesBanque = [] }) {
  const [montant, setMontant] = useState('')
  const [bankId, setBankId] = useState('')
  const [itemName, setItemName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item) {
      setMontant(type === 'banque' ? item.solde : item.montant_actuel)
      setItemName(item.nom || '')
      if (type === 'epargne') {
        setBankId(item.compte_bancaire_id || '')
      }
    }
  }, [item, type])

  if (!isOpen || !item) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const table = type === 'banque' ? 'comptes_bancaires' : 'sous_comptes_epargne'

      const updateData = type === 'banque'
        ? { solde: parseFloat(montant), nom: itemName }
        : {
            nom: itemName,
            montant_actuel: parseFloat(montant),
            compte_bancaire_id: bankId === '' ? null : bankId
          }

      const { error } = await supabase.from(table).update(updateData).eq('id', item.id)
      if (error) throw error
      onSuccess()
    } catch (err) {
      console.error('Erreur mise à jour :', err)
      alert('Erreur : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Modifier {item.nom}</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-form">
          <div className="input-group-vertical">
            <label>Nom</label>
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              required
            />
          </div>

          <div className="input-group-vertical">
            <label>Montant (€)</label>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              required
            />
          </div>

          {type === 'epargne' && (
            <div className="input-group-vertical">
              <label>Rattaché au compte bancaire</label>
              <select value={bankId} onChange={e => setBankId(e.target.value)}>
                <option value="">-- Non rattaché --</option>
                {comptesBanque.map(b => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : <><Check size={20}/> Enregistrer</>}
          </button>
        </form>
      </div>
    </div>
  )
}