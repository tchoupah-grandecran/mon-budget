import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Trash2, Plus } from 'lucide-react'

export default function AddFixExpenseTemplate({ isOpen, onClose }) {
  const [expenses, setExpenses] = useState([])
  const [nom, setNom] = useState('')
  const [montant, setMontant] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (isOpen) fetchExpenses() }, [isOpen])

  const fetchExpenses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('charges_fixes_modeles').select('*').eq('user_id', user.id).order('nom')
    setExpenses(data || [])
  }

  const add = async () => {
    if (!nom || !montant) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('charges_fixes_modeles').insert({ user_id: user.id, nom, montant })
    setNom(''); setMontant(''); await fetchExpenses()
    setLoading(false)
  }

  const deleteExpense = async (id) => {
    await supabase.from('charges_fixes_modeles').delete().eq('id', id)
    await fetchExpenses()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Dépenses fixes</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>
        <div className="sheet-form">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
            <input type="number" placeholder="€" style={{ width: '80px' }} value={montant} onChange={e => setMontant(e.target.value)} />
            <button onClick={add} className="icon-button" disabled={loading}><Plus size={20}/></button>
          </div>
          <div className="list-wrapper">
            {expenses.map(e => (
              <div key={e.id} className="list-item">
                <span>{e.nom}</span>
                <span>{e.montant}€</span>
                <Trash2 size={16} color="#ff6b6b" onClick={() => deleteExpense(e.id)} style={{ cursor: 'pointer' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}