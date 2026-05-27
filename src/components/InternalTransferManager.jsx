import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Plus, Trash2, Loader2, ArrowRightLeft, ArrowRight } from 'lucide-react'

export default function InternalTransferManager({ isOpen, onClose }) {
  const [transfers, setTransfers] = useState([])
  const [accounts, setAccounts] = useState([])

  const [nom, setNom] = useState('')
  const [montant, setMontant] = useState('')
  const [compteOrigineId, setCompteOrigineId] = useState('')
  const [compteDestinationId, setCompteDestinationId] = useState('')

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (isOpen) fetchInitialData()
  }, [isOpen])

  const fetchInitialData = async () => {
    setFetching(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [accountsRes, transfersRes] = await Promise.all([
        supabase.from('comptes_bancaires').select('id, nom').eq('user_id', user.id).order('nom'),
        supabase
          .from('virements_internes_modeles')
          .select(`
            id, nom, montant, compte_origine_id, compte_destination_id,
            origine:comptes_bancaires!compte_origine_id(nom),
            destination:comptes_bancaires!compte_destination_id(nom)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
      ])

      setAccounts(accountsRes.data || [])
      setTransfers(transfersRes.data || [])
    } catch (err) {
      console.error('Erreur de récupération des données :', err)
    } finally {
      setFetching(false)
    }
  }

  const handleAddTransfer = async (e) => {
    e.preventDefault()
    if (!nom || !montant || !compteOrigineId || !compteDestinationId) {
      alert('Veuillez remplir tous les champs.')
      return
    }
    if (compteOrigineId === compteDestinationId) {
      alert("Le compte d'origine et de destination doivent être différents.")
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('virements_internes_modeles').insert({
        user_id: user.id,
        nom,
        montant: parseFloat(montant),
        compte_origine_id: compteOrigineId,
        compte_destination_id: compteDestinationId
      })

      if (error) throw error

      setNom('')
      setMontant('')
      setCompteOrigineId('')
      setCompteDestinationId('')
      fetchInitialData()
    } catch (err) {
      alert("Erreur lors de l'ajout : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransfer = async (id) => {
    const { error } = await supabase.from('virements_internes_modeles').delete().eq('id', id)
    if (!error) setTransfers(prev => prev.filter(t => t.id !== id))
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue"/>
            <h3>Virements internes (modèles)</h3>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleAddTransfer} className="sheet-form">
          <div className="input-group-vertical">
            <label>Nom ou motif du virement</label>
            <input
              type="text"
              placeholder="Ex: Virement Loyer Appartement"
              value={nom}
              onChange={e => setNom(e.target.value)}
              required
            />
          </div>

          <div className="input-group-vertical">
            <label>Compte source (Débité)</label>
            <select value={compteOrigineId} onChange={e => setCompteOrigineId(e.target.value)} required>
              <option value="">-- Choisir le compte émetteur --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.nom}</option>
              ))}
            </select>
          </div>

          <div className="input-group-vertical">
            <label>Compte cible (Crédité)</label>
            <select value={compteDestinationId} onChange={e => setCompteDestinationId(e.target.value)} required>
              <option value="">-- Choisir le compte récepteur --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.nom}</option>
              ))}
            </select>
          </div>

          <div className="input-group-vertical">
            <label>Montant mensuel fixe</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00 €"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-expense-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : <><Plus size={16}/> Ajouter ce virement</>}
          </button>
        </form>

        <div className="mt-4">
          <label className="card-label">Virements enregistrés</label>
          {fetching ? (
            <div className="flex items-center" style={{ justifyContent: 'center', padding: '16px' }}>
              <Loader2 className="spinner" size={20}/>
            </div>
          ) : transfers.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              Aucun virement automatique programmé.
            </p>
          ) : (
            <div className="list-wrapper" style={{ maxHeight: '220px' }}>
              {transfers.map(t => (
                <div key={t.id} className="list-item">
                  <div className="flex flex-col" style={{ gap: '3px' }}>
                    <span className="font-medium">{t.nom}</span>
                    <div className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>{t.origine?.nom || 'Compte inconnu'}</span>
                      <ArrowRight size={10}/>
                      <span>{t.destination?.nom || 'Compte inconnu'}</span>
                    </div>
                  </div>
                  <span className="ml-auto mr-3 font-semibold text-blue">
                    {Number(t.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <button
                    onClick={() => handleDeleteTransfer(t.id)}
                    className="text-red"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}