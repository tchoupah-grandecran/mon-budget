import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Loader2, 
  ChevronDown, 
  ArrowDownRight, 
  ArrowUpRight, 
  Calendar, 
  User, 
  Clock, 
  TrendingUp 
} from 'lucide-react'
import './Dashboard.css'

import StartMonthModal from '../components/StartMonthModal'
import AddFixExpenseTemplate from '../components/AddFixExpenseTemplate'
import IncomeManager from '../components/IncomeManager'
import ProfileModal from '../components/ProfileModal'
import InternalTransferManager from '../components/InternalTransferManager'
import ForcedSavingsManager from '../components/ForcedSavingsManager'
import DirectIncomeSavingsManager from '../components/DirectIncomeSavingsManager'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ budget: null, banques: [], epargnes: [], totalVariables: 0 })
  
  const [activeMonthCode, setActiveMonthCode] = useState('')
  const [displayMonthLabel, setDisplayMonthLabel] = useState('')
  const [totalDirectEpargne, setTotalDirectEpargne] = useState(0)

  const [isBudgetExpanded, setIsBudgetExpanded] = useState(false)
  const [isEpargneExpanded, setIsEpargneExpanded] = useState(false)
  
  const [isStartMonthOpen, setIsStartMonthOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false) 
  const [isIncomeSettingsOpen, setIsIncomeSettingsOpen] = useState(false) 
  const [isTransferSettingsOpen, setIsTransferSettingsOpen] = useState(false)
  const [isSavingSettingsOpen, setIsSavingSettingsOpen] = useState(false) 
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isDirectIncomeSettingsOpen, setIsDirectIncomeSettingsOpen] = useState(false)

  // Préparation du mois suivant pour la modale calendrier
  const getTargetMonthForModal = () => {
    const today = new Date()
    const target = new Date(today.getFullYear(), today.getMonth(), 1)
    if (today.getDate() >= 20) {
      target.setMonth(target.getMonth() + 1)
    }
    return {
      code: target.toISOString().slice(0, 7),
      label: target.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    }
  }
  const targetMonth = getTargetMonthForModal()

  useEffect(() => { fetchDashboardData() }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const [bankRes, epargneRes, directEpargneRes] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id),
        supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id),
        supabase.from('revenus_directs_epargne').select('montant').eq('user_id', user.id)
      ])
      
      const banques = bankRes.data || []
      const epargnes = epargneRes.data || []
      
      const sumDirectEpargne = directEpargneRes.data?.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0) || 0
      setTotalDirectEpargne(sumDirectEpargne)

      const civilMonthCode = new Date().toISOString().slice(0, 7) 
      let budgetData = null
      let selectedMonth = civilMonthCode

      const { data: currentBudget } = await supabase
        .from('budgets_mensuels')
        .select('*')
        .eq('user_id', user.id)
        .eq('mois', civilMonthCode)
        .maybeSingle()

      if (currentBudget) {
        budgetData = currentBudget
        selectedMonth = civilMonthCode
      } else {
        const { data: latestBudget } = await supabase
          .from('budgets_mensuels')
          .select('*')
          .eq('user_id', user.id)
          .order('mois', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestBudget) {
          budgetData = latestBudget
          selectedMonth = latestBudget.mois
        }
      }

      const { data: variableExpenses } = await supabase
        .from('depenses')
        .select('montant')
        .eq('user_id', user.id)
        .eq('mois', selectedMonth)
      
      const totalVars = variableExpenses?.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0) || 0
      
      const [year, month] = selectedMonth.split('-')
      const formattedLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

      setActiveMonthCode(selectedMonth)
      setDisplayMonthLabel(formattedLabel)
      setData({ budget: budgetData, banques, epargnes, totalVariables: totalVars })

    } catch (err) { 
      console.error("Erreur chargement dashboard :", err) 
    } finally { 
      setLoading(false) 
    }
  }

  // --- CALCULS DU DASHBOARD ---
  const formatEUR = (val) => Number(val || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  const getDaysRemaining = () => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return lastDay.getDate() - today.getDate()
  }
  const joursRestants = getDaysRemaining()

  const totalLiquiditeReel = data.banques.reduce((acc, curr) => acc + (Number(curr.solde) || 0), 0)
  const resteAVivreActuel = totalLiquiditeReel

  const totalRevenusAffichage = (data.budget?.total_revenus || 0) + totalDirectEpargne
  const totalDepensesFixes = data.budget?.total_depenses_fixes || 0
  const totalDepensesAffichage = totalDepensesFixes + data.totalVariables

  const resteAVivreInitial = data.budget?.reste_a_vivre_initial ?? 
                            (data.budget ? ((totalRevenusAffichage - totalDirectEpargne) - totalDepensesFixes) : null) ?? 
                            totalLiquiditeReel ?? 1

  const progressResteAVivre = resteAVivreInitial > 0 
    ? Math.max(0, Math.min((resteAVivreActuel / resteAVivreInitial) * 100, 100)) 
    : 0

  const totalEpargne = data.epargnes.reduce((acc, curr) => acc + (Number(curr.montant_actuel) || 0), 0)
  const objectifGlobalEpargne = 6400
  const progressEpargneGlobale = (totalEpargne / objectifGlobalEpargne) * 100

  if (loading) return <div className="center-screen"><Loader2 className="spinner" size={32} /></div>

  return (
    <div className="dashboard-container">
      {/* --- EN-TÊTE --- */}
      <header className="dashboard-header">
        <div className="header-left">
          <span className="header-subtitle">{displayMonthLabel}</span>
          <h1 className="header-title">Tableau de bord</h1>
        </div>
        <div className="header-right">
          <button onClick={() => setIsStartMonthOpen(true)} className="icon-button">
            <Calendar size={20} />
          </button>
          <button onClick={() => setIsProfileOpen(true)} className="icon-button">
            <User size={20} />
          </button>
        </div>
      </header>

      {/* --- CARTE 1 : RESTE À VIVRE (HALF-DONUT) --- */}
      <div className="glass-card dashboard-card-clickable" onClick={() => setIsBudgetExpanded(!isBudgetExpanded)}>
        <div className="card-main-content">
          <div className="card-header-row">
            <span className="card-label">Reste à vivre disponible</span>
            <div className="days-badge">
              <Clock size={14} />
              <span>{joursRestants} jours</span>
            </div>
          </div>

          <div className="half-donut-wrapper">
            <svg viewBox="0 0 120 70" className="half-donut-svg">
              <path 
                d="M 10,65 A 50,50 0 0,1 110,65" 
                fill="none" 
                stroke="rgba(255, 255, 255, 0.1)" 
                strokeWidth="10" 
                strokeLinecap="round"
              />
              <path 
                d="M 10,65 A 50,50 0 0,1 110,65" 
                fill="none" 
                stroke={progressResteAVivre < 20 ? "#e74c3c" : "white"} 
                strokeWidth="10" 
                strokeLinecap="round"
                strokeDasharray="157.08"
                strokeDashoffset={157.08 - (progressResteAVivre / 100) * 157.08}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="half-donut-center">
              <h2 className="card-amount-donut">{formatEUR(resteAVivreActuel)}</h2>
              <span className="gauge-max-label">sur {formatEUR(resteAVivreInitial)}</span>
            </div>
          </div>
        </div>

        {isBudgetExpanded && (
          <div className="card-expanded-details" onClick={(e) => e.stopPropagation()}>
            <h4 className="details-section-title">Répartition par compte</h4>
            <div className="details-list">
              {data.banques.map(b => (
                <div key={b.id} className="details-item-row">
                  <span className="item-name">{b.nom}</span>
                  <span className="item-value font-semibold">{formatEUR(b.solde)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-footer-wrapper">
          <div className="card-footer-left">
            <span className="footer-sub-metric text-green">
              <ArrowUpRight size={12} /> R : {formatEUR(totalRevenusAffichage)}
            </span>
            <span className="footer-sub-metric text-red">
              <ArrowDownRight size={12} /> D : {formatEUR(totalDepensesAffichage)}
            </span>
          </div>
          <ChevronDown className={`expand-chevron-icon ${isBudgetExpanded ? 'rotate' : ''}`} size={18} />
        </div>
      </div>

      {/* --- CARTE 2 : L'ÉPARGNE --- */}
      <div className="glass-card dashboard-card-clickable mt-4" onClick={() => setIsEpargneExpanded(!isEpargneExpanded)}>
        <div className="card-main-content">
          <span className="card-label">Épargne totale cumulée</span>
          <h2 className="card-amount text-blue">{formatEUR(totalEpargne)}</h2>
          <div className="gauge-container">
            <div className="gauge-track bg-blue-track">
              <div className="gauge-fill bg-blue-fill" style={{ width: `${Math.min(progressEpargneGlobale, 100)}%` }}></div>
            </div>
            <span className="goal-reminder-text">
              Objectif global de précaution : <span className="font-semibold">{formatEUR(objectifGlobalEpargne)}</span> ({Math.round(progressEpargneGlobale)}%)
            </span>
          </div>
        </div>

        {isEpargneExpanded && (
          <div className="card-expanded-details" onClick={(e) => e.stopPropagation()}>
            <h4 className="details-section-title">Mes enveloppes d'épargne</h4>
            <div className="details-list space-y-3">
              {data.epargnes.map(e => {
                const stepProgress = e.objectif_total ? (Number(e.montant_actuel) / Number(e.objectif_total)) * 100 : 100
                return (
                  <div key={e.id} className="sub-account-block">
                    <div className="sub-account-header">
                      <div className="sub-account-title-group">
                        {e.horizon === 'court_terme' ? (
                          <Clock size={14} className="text-orange" title="Court terme" />
                        ) : (
                          <TrendingUp size={14} className="text-purple" title="Long terme" />
                        )}
                        <span className="item-name font-medium">{e.nom}</span>
                      </div>
                      <span className="item-value font-semibold">{formatEUR(e.montant_actuel)}</span>
                    </div>
                    {e.objectif_total && (
                      <div className="sub-gauge-wrapper">
                        <div className="sub-gauge-track">
                          <div className="sub-gauge-fill" style={{ width: `${Math.min(stepProgress, 100)}%` }}></div>
                        </div>
                        <div className="sub-gauge-labels">
                          <span>Cible : {formatEUR(e.objectif_total)}</span>
                          <span>{Math.round(stepProgress)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="card-footer-wrapper justify-end">
          <ChevronDown className={`expand-chevron-icon ${isEpargneExpanded ? 'rotate' : ''}`} size={18} />
        </div>
      </div>
      
      {/* --- MODALES --- */}
      <StartMonthModal 
        isOpen={isStartMonthOpen} 
        onClose={() => setIsStartMonthOpen(false)} 
        currentBalance={totalLiquiditeReel}
        targetMonth={targetMonth} 
        onOpenSettings={() => { setIsStartMonthOpen(false); setIsSettingsOpen(true); }} 
        onSuccess={() => { setIsStartMonthOpen(false); fetchDashboardData(); }} 
      />
      
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)}
        onOpenIncomeSettings={() => { setIsProfileOpen(false); setIsIncomeSettingsOpen(true); }}
        onOpenDirectSavingSettings={() => { setIsProfileOpen(false); setIsDirectIncomeSettingsOpen(true); }} // <-- CORRIGÉ : La prop manquante est ici !
        onOpenExpenseSettings={() => { setIsProfileOpen(false); setIsSettingsOpen(true); }}
        onOpenTransferSettings={() => { setIsProfileOpen(false); setIsTransferSettingsOpen(true); }}
        onOpenSavingSettings={() => { setIsProfileOpen(false); setIsSavingSettingsOpen(true); }}
      />

      <DirectIncomeSavingsManager 
        isOpen={isDirectIncomeSettingsOpen} 
        onClose={() => { setIsDirectIncomeSettingsOpen(false); fetchDashboardData(); }} 
      />
      
      <AddFixExpenseTemplate isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <IncomeManager isOpen={isIncomeSettingsOpen} onClose={() => setIsIncomeSettingsOpen(false)} />
      <InternalTransferManager isOpen={isTransferSettingsOpen} onClose={() => setIsTransferSettingsOpen(false)} />
      <ForcedSavingsManager isOpen={isSavingSettingsOpen} onClose={() => setIsSavingSettingsOpen(false)} />
    </div>
  )
}