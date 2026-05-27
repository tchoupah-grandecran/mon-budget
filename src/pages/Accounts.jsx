import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Landmark, PiggyBank, Plus, Loader2 } from 'lucide-react'
import EditAmountModal from '../components/EditAmountModal'
import AddBankModal from '../components/AddBankModal'
import AddSavingModal from '../components/AddSavingModal'
import './Accounts.css'

export default function Accounts() {
  const [comptesBanque, setComptesBanque] = useState([])
  const [epargnes, setEpargnes] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [editModal, setEditModal] = useState({ isOpen: false, item: null, type: null })
  const [isAddBankOpen, setIsAddBankOpen] = useState(false)
  const [isAddSavingOpen, setIsAddSavingOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const [banquesResponse, epargnesResponse] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id).order('created_at')
      ])

      if (banquesResponse.error) throw banquesResponse.error
      if (epargnesResponse.error) throw epargnesResponse.error

      setComptesBanque(banquesResponse.data || [])
      setEpargnes(epargnesResponse.data || [])
    } catch (err) {
      console.error("Erreur lors du chargement des comptes :", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const soldeGlobalBanque = comptesBanque.reduce((acc, curr) => acc + (Number(curr.solde) || 0), 0)
  
  // Dans une base UUID, la comparaison directe === est fiable car ce sont des strings
  const orphanEpargnes = epargnes.filter(e => !e.compte_bancaire_id)

  if (loading) return <div className="center-screen"><Loader2 className="spinner" size={32} /></div>

  return (
    <div className="accounts-container">
      <header className="dashboard-header">
        <div>
          <span className="header-subtitle">Patrimoine</span>
          <h1 className="header-title">Mes Comptes</h1>
        </div>
      </header>

      {/* Section Banques */}
      <section className="account-section">
        <div className="section-header">
          <div className="section-title">
            <Landmark size={18} />
            <h2>Banques (Global : {soldeGlobalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })})</h2>
          </div>
          <button onClick={() => setIsAddBankOpen(true)} className="icon-button"><Plus size={16} /></button>
        </div>

        <div className="accounts-list">
          {comptesBanque.length === 0 ? (
            <p className="empty-text">Aucun compte bancaire ajouté.</p>
          ) : (
            comptesBanque.map(compte => {
              const linkedEpargnes = epargnes.filter(e => e.compte_bancaire_id === compte.id)
              return (
                <div key={compte.id} className="bank-group">
                  <div 
                    className="glass-card list-item clickable bank-item"
                    onClick={() => setEditModal({ isOpen: true, item: compte, type: 'banque' })}
                  >
                    <span>{compte.nom}</span>
                    <span className="item-amount">
                      {Number(compte.solde)?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>

                  {linkedEpargnes.length > 0 && (
                    <div className="linked-epargnes-container">
                      {linkedEpargnes.map(epargne => {
                        const progress = (epargne.montant_actuel / (epargne.objectif_total || 1)) * 100;
                        return (
                          <div 
                            key={epargne.id} 
                            className="linked-epargne-item clickable"
                            onClick={() => setEditModal({ isOpen: true, item: epargne, type: 'epargne' })}
                          >
                            <div className="item-info">
                              <span>↳ {epargne.nom}</span>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                              </div>
                            </div>
                            <span className="item-amount-small">
                              {Number(epargne.montant_actuel)?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Section Épargne Globale */}
      <section className="account-section" style={{ marginTop: '16px' }}>
        <div className="section-header">
          <div className="section-title">
            <PiggyBank size={18} />
            <h2>Toutes les épargnes</h2>
          </div>
          <button onClick={() => setIsAddSavingOpen(true)} className="icon-button"><Plus size={16} /></button>
        </div>

        {orphanEpargnes.length > 0 && (
          <div className="accounts-list">
            {orphanEpargnes.map(epargne => (
              <div 
                key={epargne.id} 
                className="glass-card list-item clickable orphan-item"
                onClick={() => setEditModal({ isOpen: true, item: epargne, type: 'epargne' })}
              >
                <div className="item-info">
                  <span>{epargne.nom}</span>
                  <span className="item-badge">Clique pour rattacher à une banque</span>
                </div>
                <span className="item-amount">
                  {Number(epargne.montant_actuel)?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modales */}
      <AddBankModal 
        isOpen={isAddBankOpen}
        onClose={() => setIsAddBankOpen(false)}
        onSuccess={() => { setIsAddBankOpen(false); fetchData(); }}
      />

      <EditAmountModal 
        isOpen={editModal.isOpen} 
        item={editModal.item} 
        type={editModal.type}
        comptesBanque={comptesBanque}
        onClose={() => setEditModal({ isOpen: false, item: null, type: null })}
        onSuccess={() => { setEditModal({ isOpen: false, item: null, type: null }); fetchData(); }}
      />

      <AddSavingModal 
        isOpen={isAddSavingOpen} 
        onClose={() => setIsAddSavingOpen(false)} 
        onSuccess={() => { setIsAddSavingOpen(false); fetchData(); }} 
        comptesBanque={comptesBanque}
      />
    </div>
  )
}