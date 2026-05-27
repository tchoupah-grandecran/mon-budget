import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Trash2, Loader2, Coins } from 'lucide-react'

export default function DirectIncomeSavingsManager({ isOpen, onClose }) {
  const [incomeRules, setIncomeRules] = useState([])
  const [savingEnvelopes, setSavingEnvelopes] = useState([])

  const [nom, setNom] = useState('')
  const [montant, setMontant] = useState('')
  const [targetEnvelopeId, setTargetEnvelopeId] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) fetchInitialData()
  }, [isOpen])

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [rulesRes, envRes] = await Promise.all([
        supabase.from('revenus_directs_epargne').select('*, sous_comptes_epargne(nom)').eq('user_id', user.id),
        supabase.from('sous_comptes_epargne').select('id, nom').eq('user_id', user.id)
      ])

      setIncomeRules(rulesRes.data || [])
      setSavingEnvelopes(envRes.data || [])
    } catch (err) {
      console.error("Erreur d'initialisation :", err)
    }
  }

  const handleAddRule = async (e) => {
    e.preventDefault()
    if (!nom || !montant || !targetEnvelopeId) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté.')

      const { error } = await supabase.from('revenus_directs_epargne').insert({
        user_id: user.id,
        nom,
        montant: parseFloat(montant),
        sous_compte_id: targetEnvelopeId
      })

      if (error) throw error

      setNom('')
      setMontant('')
      setTargetEnvelopeId('')
      await fetchInitialData()
    } catch (err) {
      console.error("Erreur d'enregistrement Supabase :", err)
      alert(`Erreur d'enregistrement : ${err.message || 'Vérifiez vos politiques RLS'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('revenus_directs_epargne').delete().eq('id', id)
      if (error) throw error
      fetchInitialData()
    } catch (err) {
      console.error('Erreur de suppression :', err)
      alert(`Impossible de supprimer : ${err.message}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-green"/>
            <h3>Revenus directs vers l'Épargne</h3>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleAddRule} className="sheet-form">
          <div className="input-group-vertical">
            <label>Nom du revenu</label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              required
              placeholder="Ex: Intérêts bloqués, Versement externe..."
            />
          </div>

          <div className="input-group-vertical">
            <label>Montant mensuel</label>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              required
              placeholder="0.00 €"
            />
          </div>

          <div className="input-group-vertical">
            <label>Vers quelle enveloppe (Cible)</label>
            <select value={targetEnvelopeId} onChange={e => setTargetEnvelopeId(e.target.value)} required>
              <option value="">-- Choisir l'enveloppe --</option>
              {savingEnvelopes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : 'Enregistrer ce revenu direct'}
          </button>
        </form>

        <div className="mt-4">
          <label className="card-label">Revenus directs actifs</label>
          <div className="list-wrapper" style={{ maxHeight: '200px' }}>
            {incomeRules.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Aucun revenu direct configuré
              </p>
            ) : incomeRules.map(r => (
              <div key={r.id} className="list-item">
                <div className="flex flex-col" style={{ gap: '3px' }}>
                  <span className="font-medium">{r.nom}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Cible : {r.sous_comptes_epargne?.nom || 'Enveloppe inconnue'}
                  </span>
                </div>
                <span className="ml-auto mr-3 font-semibold text-green">
                  +{Number(r.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
                <button
                  onClick={() => handleDelete(r.id)}
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