import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Trash2, Plus, Loader2 } from 'lucide-react'

export default function IncomeManager({ isOpen, onClose }) {
  const [incomes, setIncomes] = useState([])
  const [nom, setNom] = useState('')
  const [montant, setMontant] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (isOpen) fetchIncomes() }, [isOpen])

  const fetchIncomes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('revenus_fixes_modeles')
      .select('*')
      .eq('user_id', user.id)
      .order('nom')
    setIncomes(data || [])
  }

  const add = async () => {
    if (!nom || !montant) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('revenus_fixes_modeles').insert({
      user_id: user.id,
      nom,
      montant: parseFloat(montant)
    })
    setNom('')
    setMontant('')
    await fetchIncomes()
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
          <div className="inline-add-row">
            <input
              placeholder="Nom (ex: Salaire)"
              value={nom}
              onChange={e => setNom(e.target.value)}
            />
            <input
              type="number"
              placeholder="€"
              className="w-small"
              value={montant}
              onChange={e => setMontant(e.target.value)}
            />
            <button onClick={add} className="icon-button" disabled={loading}>
              {loading ? <Loader2 className="spinner" size={18}/> : <Plus size={18}/>}
            </button>
          </div>

          <div className="list-wrapper">
            {incomes.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Aucun revenu fixe configuré
              </p>
            ) : incomes.map(i => (
              <div key={i.id} className="list-item">
                <span className="font-medium">{i.nom}</span>
                <span style={{ marginLeft: 'auto', marginRight: '12px', fontWeight: 600, fontSize: '14px', color: 'var(--green)' }}>
                  +{Number(i.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
                <button
                  onClick={() => deleteIncome(i.id)}
                  className="text-red"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}