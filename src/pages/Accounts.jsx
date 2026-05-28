import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Landmark, PiggyBank, Plus, Loader2, Wallet, Target,
  TrendingUp, Clock, ChevronRight, Unlink, BadgePercent
} from 'lucide-react'
import EditAmountModal from '../components/EditAmountModal'
import AddBankModal from '../components/AddBankModal'
import AddSavingModal from '../components/AddSavingModal'
import './Accounts.css'

// Icône contextuelle selon le nom du compte bancaire
function BankIcon({ nom }) {
  const n = nom?.toLowerCase() || ''
  if (n.includes('livret') || n.includes('épargne') || n.includes('epargne')) {
    return <PiggyBank size={18} />
  }
  if (n.includes('joint') || n.includes('commun')) return <Wallet size={18} />
  return <Landmark size={18} />
}

// Icône contextuelle selon le nom de l'enveloppe d'épargne
function SavingIcon({ nom, horizon }) {
  const n = nom?.toLowerCase() || ''
  if (n.includes('vacances') || n.includes('voyage')) return <Target size={15} />
  if (n.includes('précaution') || n.includes('precaution') || n.includes('urgence')) {
    return <BadgePercent size={15} />
  }
  if (horizon === 'long_terme') return <TrendingUp size={15} />
  return <Clock size={15} />
}

// Initiales pour le badge coloré du compte bancaire
function BankInitials({ nom }) {
  const words = (nom || '').trim().split(/\s+/)
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (nom || '').slice(0, 2).toUpperCase()
  return <span className="bank-initials">{initials}</span>
}

export default function Accounts() {
  const [comptesBanque, setComptesBanque]   = useState([])
  const [epargnes, setEpargnes]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [expandedBanks, setExpandedBanks]   = useState({})

  const [editModal, setEditModal]           = useState({ isOpen: false, item: null, type: null })
  const [isAddBankOpen, setIsAddBankOpen]   = useState(false)
  const [isAddSavingOpen, setIsAddSavingOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [banquesRes, epargnesRes] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id).order('created_at')
      ])

      if (banquesRes.error)  throw banquesRes.error
      if (epargnesRes.error) throw epargnesRes.error

      const banks = banquesRes.data || []
      setComptesBanque(banks)
      setEpargnes(epargnesRes.data || [])

      // Déplier par défaut tous les comptes qui ont des enveloppes liées
      const initial = {}
      banks.forEach(b => { initial[b.id] = true })
      setExpandedBanks(initial)
    } catch (err) {
      console.error('Erreur chargement comptes :', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const toggleBank = (id) =>
    setExpandedBanks(prev => ({ ...prev, [id]: !prev[id] }))

  const fmt = (n) =>
    Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  const totalBanque  = comptesBanque.reduce((a, c) => a + (Number(c.solde) || 0), 0)
  const totalEpargne = epargnes.reduce((a, e) => a + (Number(e.montant_actuel) || 0), 0)
  const orphanEpargnes = epargnes.filter(e => !e.compte_bancaire_id)

  if (loading) return (
    <div className="center-screen">
      <Loader2 className="spinner" size={32} />
    </div>
  )

  return (
    <div className="accounts-container">

      {/* ── EN-TÊTE ── */}
      <header className="accounts-header">
        <div>
          <span className="header-subtitle">Patrimoine</span>
          <h1 className="header-title">Mes comptes</h1>
        </div>
      </header>

      {/* ── CARTE PATRIMOINE GLOBAL ── */}
      <div className="patrimoine-card glass-card">
        <div className="patrimoine-card__left">
          <span className="patrimoine-card__label">Total disponible</span>
          <span className="patrimoine-card__amount">{fmt(totalBanque + totalEpargne)}</span>
          {totalEpargne > 0 && (
            <span className="patrimoine-card__sub">
              dont&nbsp;<strong>{fmt(totalEpargne)}</strong>&nbsp;en épargne
            </span>
          )}
        </div>
        <div className="patrimoine-card__icon">
          <Landmark size={22} />
        </div>
      </div>

      {/* ── COMPTES BANCAIRES ── */}
      <section className="account-section">
        <div className="accounts-section-hdr">
          <span className="accounts-section-lbl">Comptes bancaires</span>
          <button
            className="icon-button"
            onClick={() => setIsAddBankOpen(true)}
            aria-label="Ajouter un compte"
          >
            <Plus size={20} />
          </button>
        </div>

        {comptesBanque.length === 0 ? (
          <p className="empty-text">Aucun compte bancaire ajouté.</p>
        ) : (
          <div className="accounts-list">
            {comptesBanque.map(compte => {
              const linked = epargnes.filter(e => e.compte_bancaire_id === compte.id)
              const isOpen = expandedBanks[compte.id]

              return (
                <div key={compte.id} className="bank-card glass-card">

                  {/* Ligne principale du compte */}
                  <div
                    className="bank-card__row"
                    onClick={() => toggleBank(compte.id)}
                  >
                    <div className="bank-card__avatar">
                      <BankInitials nom={compte.nom} />
                    </div>

                    <div className="bank-card__info">
                      <span className="bank-card__name">{compte.nom}</span>
                      <span className="bank-card__sub">
                        {linked.length > 0
                          ? `${linked.length} enveloppe${linked.length > 1 ? 's' : ''} liée${linked.length > 1 ? 's' : ''}`
                          : 'Aucune enveloppe'}
                      </span>
                    </div>

                    <div className="bank-card__right">
                      <span className="bank-card__amount">{fmt(compte.solde)}</span>
                      {linked.length > 0 && (
                        <ChevronRight
                          size={16}
                          className={`bank-card__chevron ${isOpen ? 'rotated' : ''}`}
                        />
                      )}
                    </div>

                    {/* Bouton édition séparé du toggle */}
                    <button
                      className="bank-card__edit-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditModal({ isOpen: true, item: compte, type: 'banque' })
                      }}
                      aria-label="Modifier ce compte"
                    >
                      <span className="bank-card__edit-dot" />
                      <span className="bank-card__edit-dot" />
                      <span className="bank-card__edit-dot" />
                    </button>
                  </div>

                  {/* Enveloppes liées (dépliables) */}
                  {linked.length > 0 && isOpen && (
                    <div className="epargne-list">
                      {linked.map(epargne => {
                        const pct = epargne.objectif_total
                          ? Math.min((Number(epargne.montant_actuel) / Number(epargne.objectif_total)) * 100, 100)
                          : null
                        return (
                          <div
                            key={epargne.id}
                            className="epargne-row"
                            onClick={() => setEditModal({ isOpen: true, item: epargne, type: 'epargne' })}
                          >
                            <div className="epargne-row__icon">
                              <SavingIcon nom={epargne.nom} horizon={epargne.horizon} />
                            </div>
                            <div className="epargne-row__info">
                              <span className="epargne-row__name">{epargne.nom}</span>
                              {pct !== null && (
                                <div className="progress-bar-bg">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="epargne-row__right">
                              <span className="epargne-row__amount">
                                {fmt(epargne.montant_actuel)}
                              </span>
                              {pct !== null && (
                                <span className="epargne-row__pct">{Math.round(pct)}%</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── ÉPARGNES NON RATTACHÉES ── */}
      {orphanEpargnes.length > 0 && (
        <section className="account-section">
          <div className="accounts-section-hdr">
            <span className="accounts-section-lbl">Non rattachées</span>
            <button
              className="icon-button"
              onClick={() => setIsAddSavingOpen(true)}
              aria-label="Ajouter une épargne"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="accounts-list">
            {orphanEpargnes.map(epargne => (
              <div
                key={epargne.id}
                className="orphan-card glass-card"
                onClick={() => setEditModal({ isOpen: true, item: epargne, type: 'epargne' })}
              >
                <div className="orphan-card__icon">
                  <Unlink size={16} />
                </div>
                <div className="orphan-card__info">
                  <span className="orphan-card__name">{epargne.nom}</span>
                  <span className="orphan-card__hint">Appuyer pour rattacher à un compte</span>
                </div>
                <span className="orphan-card__amount">{fmt(epargne.montant_actuel)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── BOUTON AJOUTER ÉPARGNE si aucune orpheline ── */}
      {orphanEpargnes.length === 0 && (
        <section className="account-section">
          <div className="accounts-section-hdr">
            <span className="accounts-section-lbl">Épargnes</span>
            <button
              className="icon-button"
              onClick={() => setIsAddSavingOpen(true)}
              aria-label="Ajouter une épargne"
            >
              <Plus size={16} />
            </button>
          </div>
        </section>
      )}

      {/* ── MODALES ── */}
      <AddBankModal
        isOpen={isAddBankOpen}
        onClose={() => setIsAddBankOpen(false)}
        onSuccess={() => { setIsAddBankOpen(false); fetchData() }}
      />

      <EditAmountModal
        isOpen={editModal.isOpen}
        item={editModal.item}
        type={editModal.type}
        comptesBanque={comptesBanque}
        onClose={() => setEditModal({ isOpen: false, item: null, type: null })}
        onSuccess={() => { setEditModal({ isOpen: false, item: null, type: null }); fetchData() }}
      />

      <AddSavingModal
        isOpen={isAddSavingOpen}
        onClose={() => setIsAddSavingOpen(false)}
        onSuccess={() => { setIsAddSavingOpen(false); fetchData() }}
        comptesBanque={comptesBanque}
      />
    </div>
  )
}