import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Check, TrendingDown, TrendingUp } from 'lucide-react'
import './AddExpenseModal.css'

export default function AddExpenseModal({ isOpen, onClose, onSuccess }) {
  const [type, setType] = useState('depense') // 'depense' | 'revenu'
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [compteId, setCompteId] = useState('')
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) fetchComptes()
  }, [isOpen])

  // Réinitialise le formulaire à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setType('depense')
      setLibelle('')
      setMontant('')
      setError(null)
    }
  }, [isOpen])

  const fetchComptes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('comptes_bancaires')
      .select('id, nom, solde')
      .eq('user_id', user.id)

    setComptes(data || [])
    if (data && data.length > 0) {
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
      // Date du jour au format YYYY-MM-DD (utilisé comme date_depense / date_revenu)
      const today = new Date().toISOString().slice(0, 10)
      // Code mois YYYY-MM pour filtrer le budget mensuel
      const moisCourant = today.slice(0, 7)

      if (type === 'depense') {
        // Insertion dans depenses_variables — colonne date_depense (YYYY-MM-DD)
        const { error: insertError } = await supabase.from('depenses_variables').insert({
          user_id: user.id,
          libelle,
          montant: montantNum,
          compte_id: compteId,
          date_depense: today
        })
        if (insertError) throw insertError

      } else {
        // Insertion dans revenus_variables — colonne date_revenu (YYYY-MM-DD)
        const { error: insertError } = await supabase.from('revenus_variables').insert({
          user_id: user.id,
          libelle,
          montant: montantNum,
          compte_id: compteId,
          date_revenu: today
        })
        if (insertError) throw insertError

        // Mise à jour du solde du compte bancaire (crédit)
        const compte = comptes.find(c => c.id === compteId)
        if (compte) {
          const { error: soldeError } = await supabase
            .from('comptes_bancaires')
            .update({ solde: Number(compte.solde) + montantNum })
            .eq('id', compteId)
          if (soldeError) throw soldeError
        }

        // Mise à jour du budget mensuel (total_revenus + reste_a_vivre)
        const { data: budget } = await supabase
          .from('budgets_mensuels')
          .select('id, total_revenus, reste_a_vivre')
          .eq('user_id', user.id)
          .eq('mois', moisCourant)
          .maybeSingle()

        if (budget) {
          const { error: budgetError } = await supabase
            .from('budgets_mensuels')
            .update({
              total_revenus: Number(budget.total_revenus) + montantNum,
              reste_a_vivre: Number(budget.reste_a_vivre) + montantNum
            })
            .eq('id', budget.id)
          if (budgetError) throw budgetError
        }
      }

      setLibelle('')
      setMontant('')
      onSuccess()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isRevenu = type === 'revenu'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>{isRevenu ? 'Nouveau revenu' : 'Nouvelle dépense'}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        {/* Toggle Dépense / Revenu */}
        <div className="radio-group" style={{ marginBottom: '6px' }}>
          <button
            type="button"
            className={`radio-btn ${type === 'depense' ? 'active' : ''}`}
            onClick={() => setType('depense')}
            style={type === 'depense' ? { background: 'var(--red)', color: '#fff' } : {}}
          >
            <TrendingDown size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
            Dépense
          </button>
          <button
            type="button"
            className={`radio-btn ${type === 'revenu' ? 'active' : ''}`}
            onClick={() => setType('revenu')}
            style={type === 'revenu' ? { background: 'var(--green)', color: '#fff' } : {}}
          >
            <TrendingUp size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
            Revenu
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-form">
          {error && <p className="error-message">{error}</p>}

          <div className="input-group-vertical">
            <label>Quoi ?</label>
            <input
              type="text"
              placeholder={isRevenu ? 'Ex : Prime, Freelance...' : 'Ex : Courses, Restaurant...'}
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
            />
          </div>

          <div className="input-group-vertical">
            <label>Quel compte ?</label>
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              {comptes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({Number(c.solde).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })})
                </option>
              ))}
            </select>
          </div>

          <div className="input-group-vertical">
            <label>Combien ? (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="submit-expense-btn"
            disabled={loading}
            style={isRevenu ? { background: 'var(-text-primary)', color: '#111' } : {}}
          >
            {loading
              ? <Loader2 className="spinner" size={20} />
              : <><Check size={20} /> {isRevenu ? 'Ajouter ce revenu' : 'Ajouter cette dépense'}</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}