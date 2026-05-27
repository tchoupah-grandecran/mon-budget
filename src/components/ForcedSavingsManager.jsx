import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Plus, Trash2, Loader2, PiggyBank } from 'lucide-react'

export default function ForcedSavingsManager({ isOpen, onClose }) {
  const [savingsRules, setSavingsRules] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [savingEnvelopes, setSavingEnvelopes] = useState([])
  
  const [montant, setMontant] = useState('')
  const [sourceBankId, setSourceBankId] = useState('')
  const [targetEnvelopeId, setTargetEnvelopeId] = useState('')
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) fetchInitialData()
  }, [isOpen])

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [rulesRes, bankRes, envRes] = await Promise.all([
        supabase.from('epargne_forcee').select('*, sous_comptes_epargne(nom), comptes_bancaires(nom)').eq('user_id', user.id),
        supabase.from('comptes_bancaires').select('id, nom').eq('user_id', user.id),
        supabase.from('sous_comptes_epargne').select('id, nom').eq('user_id', user.id)
      ])
      
      setSavingsRules(rulesRes.data || [])
      setBankAccounts(bankRes.data || [])
      setSavingEnvelopes(envRes.data || [])
    } catch (err) {
      console.error("Erreur d'initialisation :", err)
    }
  }

  const handleAddRule = async (e) => {
    e.preventDefault()
    if (!montant || !sourceBankId || !targetEnvelopeId) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utilisateur non connecté.")

      // Tentative d'insertion dans Supabase
      const { error } = await supabase.from('epargne_forcee').insert({
        user_id: user.id,
        montant_mensuel: parseFloat(montant),
        compte_id: sourceBankId,
        sous_compte_id: targetEnvelopeId
      })

      // Si Supabase renvoie une erreur, on la propulse dans le bloc catch
      if (error) throw error

      // En cas de succès : on nettoie les champs du formulaire
      setMontant('')
      setSourceBankId('')
      setTargetEnvelopeId('')
      
      // On rafraîchit la liste des règles actives
      await fetchInitialData()
      
    } catch (err) {
      // INTERCEPTION ET AFFICHAGE DE L'ERREUR
      console.error("Erreur d'enregistrement Supabase :", err)
      alert(`Erreur d'enregistrement : ${err.message || err.details || "Vérifiez vos politiques RLS"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('epargne_forcee').delete().eq('id', id)
      if (error) throw error
      fetchInitialData()
    } catch (err) {
      console.error("Erreur de suppression :", err)
      alert(`Impossible de supprimer : ${err.message}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-blue" />
            <h3>Épargne programmée</h3>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleAddRule} className="sheet-form">
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
            <label>Depuis quel compte (Source)</label>
            <select value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} required>
              <option value="">-- Choisir la banque --</option>
              {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div className="input-group-vertical">
            <label>Vers quelle enveloppe (Cible)</label>
            <select value={targetEnvelopeId} onChange={e => setTargetEnvelopeId(e.target.value)} required>
              <option value="">-- Choisir l'enveloppe --</option>
              {savingEnvelopes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : "Enregistrer cette règle"}
          </button>
        </form>

        <div className="mt-4">
          <label className="card-label">Règles actives</label>
          <div className="list-wrapper" style={{maxHeight: '200px'}}>
            {savingsRules.length === 0 ? (
              <p className="text-[12px] opacity-50 text-center py-4">Aucune règle configurée</p>
            ) : (
              savingsRules.map(r => (
                <div key={r.id} className="list-item">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.sous_comptes_epargne?.nom || 'Enveloppe inconnue'}</span>
                    <span className="text-[10px] opacity-40">Depuis {r.comptes_bancaires?.nom || 'Compte inconnu'}</span>
                  </div>
                  <span className="ml-auto mr-3 font-semibold">
                    {Number(r.montant_mensuel).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <button onClick={() => handleDelete(r.id)} className="text-red">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}