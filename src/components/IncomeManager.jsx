import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Trash2, Plus } from 'lucide-react'

export default function IncomeManager({ isOpen, onClose }) {
  const [incomes, setIncomes] = useState([])
  const [nom, setNom] = useState('')
  const [montant, setMontant] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (isOpen) fetchIncomes() }, [isOpen])

  const fetchIncomes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('revenus_fixes_modeles').select('*').eq('user_id', user.id).order('nom')
    setIncomes(data || [])
  }

  const add = async () => {
    if (!nom || !montant) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('revenus_fixes_modeles').insert({ user_id: user.id, nom, montant })
    setNom(''); setMontant(''); await fetchIncomes()
    setLoading(false)
  }

  const deleteIncome = async (id) => {
    await supabase.from('revenus_fixes_modeles').delete().eq('id', id)
    await fetchIncomes()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Revenus fixes</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>
        <div className="sheet-form">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input placeholder="Nom (ex: Salaire)" value={nom} onChange={e => setNom(e.target.value)} />
            <input type="number" placeholder="€" style={{ width: '80px' }} value={montant} onChange={e => setMontant(e.target.value)} />
            <button onClick={add} className="icon-button" disabled={loading}><Plus size={20}/></button>
          </div>
          <div className="list-wrapper">
            {incomes.map(i => (
              <div key={i.id} className="list-item">
                <span>{i.nom}</span>
                <span>{i.montant}€</span>
                <Trash2 size={16} color="#ff6b6b" onClick={() => deleteIncome(i.id)} style={{ cursor: 'pointer' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}