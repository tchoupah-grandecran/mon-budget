import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Loader2,
  ChevronDown,
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

// Génère une phrase contextuelle selon l'état budgétaire (Corrigé)
function getBudgetContextLine(progress, joursRestants, resteActuel) {
  const pct = Math.round(progress)

  // 1. État DANGER : Budget épuisé OU consommation >= 97%
  if (resteActuel <= 0 || pct >= 97) {
    return { 
      text: resteActuel <= 0 
        ? <>Le budget du mois est <strong>épuisé</strong>. Attention aux dépenses variables.</>
        : <>Attention, vous avez consommé <strong>{pct}%</strong> de votre budget. Seuil critique atteint !</>, 
      state: 'danger' 
    }
  }

  // 2. État WARN : Consommation >= 80% (et < 97%)
  if (pct >= 80) {
    return { 
      text: <>À <strong>{pct}%</strong> consommé, le rythme est élevé pour {joursRestants} jours restants.</>, 
      state: 'warn' 
    }
  }

  // 3. État NORMAL (Optionnel : bonus si très peu consommé en début de mois)
  if (pct < 20 && joursRestants > 10) {
    return { 
      text: <>Il reste encore <strong>beaucoup de marge</strong> — vous avez consommé seulement {pct}% du budget.</>, 
      state: 'normal' 
    }
  }

  // État NORMAL par défaut
  return { 
    text: <>Vous avez consommé <strong>{pct}%</strong> de votre budget ce mois-ci.</>, 
    state: 'normal' 
  }
}

// Génère une phrase narrative pour l'épargne
function getSavingsNarrative(total, objectif) {
  const reste = objectif - total
  if (reste <= 0) {
    return <>Votre épargne de précaution est <strong>constituée</strong>. Vous pouvez viser des objectifs plus longs.</>
  }
  const formatted = reste.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  return <>Il reste <strong>{formatted}</strong> à atteindre pour constituer votre épargne de précaution.</>
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    budget: null,
    banques: [],
    epargnes: [],
    totalVariables: 0,
    totalRevenusVariables: 0
  })

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
      const sumDirectEpargne = directEpargneRes.data?.reduce(
        (acc, curr) => acc + (Number(curr.montant) || 0), 0
      ) || 0
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

      const monthStart = `${selectedMonth}-01`
      const [y, m] = selectedMonth.split('-')
      const lastDay = new Date(Number(y), Number(m), 0).getDate()
      const monthEnd = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`

      const { data: variableExpenses } = await supabase
        .from('depenses_variables')
        .select('montant')
        .eq('user_id', user.id)
        .gte('date_depense', monthStart)
        .lte('date_depense', monthEnd)

      const totalVars = variableExpenses?.reduce(
        (acc, curr) => acc + (Number(curr.montant) || 0), 0
      ) || 0

      const { data: variableIncomes } = await supabase
        .from('revenus_variables')
        .select('montant')
        .eq('user_id', user.id)
        .gte('date_revenu', monthStart)
        .lte('date_revenu', monthEnd)

      const totalRevenusVars = variableIncomes?.reduce(
        (acc, curr) => acc + (Number(curr.montant) || 0), 0
      ) || 0

      const [year, month] = selectedMonth.split('-')
      const formattedLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
        month: 'long', year: 'numeric'
      })

      setActiveMonthCode(selectedMonth)
      setDisplayMonthLabel(formattedLabel)
      setData({
        budget: budgetData,
        banques,
        epargnes,
        totalVariables: totalVars,
        totalRevenusVariables: totalRevenusVars
      })

    } catch (err) {
      console.error('Erreur chargement dashboard :', err)
    } finally {
      setLoading(false)
    }
  }

  // --- CALCULS ---
  const formatEUR = (val) =>
    Number(val || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  const getDaysRemaining = () => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return lastDay.getDate() - today.getDate()
  }
  const joursRestants = getDaysRemaining()

  const totalLiquiditeReel = data.banques.reduce(
    (acc, curr) => acc + (Number(curr.solde) || 0), 0
  )

  const totalRevenusAffichage =
    (data.budget?.total_revenus || 0) +
    totalDirectEpargne +
    data.totalRevenusVariables

  const totalDepensesFixes = data.budget?.total_depenses_fixes || 0
  const totalDepensesAffichage = totalDepensesFixes + data.totalVariables

  const resteAVivreInitial =
    data.budget?.reste_a_vivre_initial ??
    (data.budget
      ? (data.budget.total_revenus || 0) - totalDepensesFixes
      : null) ??
    totalLiquiditeReel ?? 1

  const resteAVivreActuel = totalLiquiditeReel

  const progressResteAVivre = resteAVivreInitial > 0
    ? Math.max(0, Math.min((resteAVivreActuel / resteAVivreInitial) * 100, 100))
    : 0

  // Pourcentage consommé (inverse du reste)
  const progressConsomme = 100 - progressResteAVivre

  const totalEpargne = data.epargnes.reduce(
    (acc, curr) => acc + (Number(curr.montant_actuel) || 0), 0
  )
  const objectifGlobalEpargne = 6400
  const progressEpargneGlobale = Math.min((totalEpargne / objectifGlobalEpargne) * 100, 100)

  // Contexte dynamique
  const budgetContext = getBudgetContextLine(progressConsomme, joursRestants, resteAVivreActuel)
  const savingsNarrative = getSavingsNarrative(totalEpargne, objectifGlobalEpargne)

  // Couleur de jauge selon état
  const gaugeColor = budgetContext.state === 'danger'
    ? '#C0392B'
    : budgetContext.state === 'warn'
    ? '#D4855A'
    : '#1D9E75'

  // Calcul arc SVG (demi-cercle = 157.08 de long)
  const arcLength = 157.08
  const arcOffset = arcLength - (progressResteAVivre / 100) * arcLength

  if (loading) {
    return (
      <div className="center-screen">
        <Loader2 className="spinner" size={28} />
      </div>
    )
  }

  return (
    <div className="dashboard-container">

      {/* EN-TÊTE */}
      <header className="dashboard-header">
        <div className="header-left">
          <span className="header-month">{displayMonthLabel}</span>
          <h1 className="header-title">Tableau de bord</h1>
        </div>
        <div className="header-right">
          <button onClick={() => setIsStartMonthOpen(true)} className="icon-button" aria-label="Démarrer un mois">
            <Calendar size={18} />
          </button>
          <button onClick={() => setIsProfileOpen(true)} className="icon-button" aria-label="Profil">
            <User size={18} />
          </button>
        </div>
      </header>

      {/* CARTE 1 : RESTE À VIVRE */}
      <div
        className={`budget-card card-state-${budgetContext.state}`}
        onClick={() => setIsBudgetExpanded(!isBudgetExpanded)}
      >
        {/* Pill jours restants */}
        <div className="days-pill">
          <Clock size={12} />
          <span>{joursRestants} jours restants</span>
        </div>

        {/* Phrase contextuelle */}
        <p className="context-line">{budgetContext.text}</p>

        {/* Demi-donut */}
        <div className="donut-wrap">
          <svg viewBox="0 0 120 70" className="donut-svg" aria-hidden="true">
            {/* Arc fond */}
            <path
              d="M 10,65 A 50,50 0 0,1 110,65"
              fill="none"
              stroke="rgba(75,72,72,0.3)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Arc actif */}
            <path
              d="M 10,65 A 50,50 0 0,1 110,65"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={arcOffset}
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="donut-center">
            <span className="donut-amount">{formatEUR(resteAVivreActuel)}</span>
            <span className="donut-sub">sur {formatEUR(resteAVivreInitial)}</span>
          </div>
        </div>

        {/* Détails déployés */}
        {isBudgetExpanded && (
          <div className="expanded-section" onClick={(e) => e.stopPropagation()}>
            <p className="expanded-title">répartition par compte</p>
            <div className="expanded-list">
              {data.banques.map(b => (
                <div key={b.id} className="expanded-row">
                  <span className="expanded-name">{b.nom}</span>
                  <span className="expanded-value">{formatEUR(b.solde)}</span>
                </div>
              ))}
            </div>

            {data.totalRevenusVariables > 0 && (
              <>
                <p className="expanded-title" style={{ marginTop: 14 }}>rentrées ponctuelles</p>
                <div className="expanded-row">
                  <span className="expanded-name expanded-positive">Revenus variables</span>
                  <span className="expanded-value expanded-positive">+{formatEUR(data.totalRevenusVariables)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pied de carte : trois colonnes */}
        <div className="card-footer">
          <div className="footer-col">
            <span className="footer-label">revenus</span>
            <span className="footer-value footer-value--positive">+{formatEUR(totalRevenusAffichage)}</span>
          </div>
          <div className="footer-col footer-col--center">
            <span className="footer-label">fixes</span>
            <span className="footer-value">{formatEUR(totalDepensesFixes)}</span>
          </div>
          <div className="footer-col footer-col--right">
            <span className="footer-label">variables</span>
            <span className="footer-value">{formatEUR(data.totalVariables)}</span>
          </div>
          <ChevronDown
            className={`chevron-icon ${isBudgetExpanded ? 'chevron-rotated' : ''}`}
            size={16}
          />
        </div>
      </div>

      {/* CARTE 2 : ÉPARGNE */}
      <div
        className="savings-card"
        onClick={() => setIsEpargneExpanded(!isEpargneExpanded)}
      >
        <span className="savings-label">épargne cumulée</span>
        <h2 className="savings-amount">{formatEUR(totalEpargne)}</h2>

        <p className="savings-narrative">{savingsNarrative}</p>

        {/* Barre de progression */}
        <div className="savings-progress">
          <div className="savings-track">
            <div
              className="savings-fill"
              style={{ width: `${progressEpargneGlobale}%` }}
            />
          </div>
          <div className="savings-progress-labels">
            <span>{Math.round(progressEpargneGlobale)}% de l'objectif</span>
            <span>{formatEUR(objectifGlobalEpargne)} visés</span>
          </div>
        </div>

        {/* Enveloppes déployées */}
        {isEpargneExpanded && (
          <div className="expanded-section" onClick={(e) => e.stopPropagation()}>
            <p className="expanded-title">mes enveloppes</p>
            <div className="expanded-list">
              {data.epargnes.map(e => {
                const pct = e.objectif_total
                  ? Math.round((Number(e.montant_actuel) / Number(e.objectif_total)) * 100)
                  : null
                return (
                  <div key={e.id} className="envelope-block">
                    <div className="envelope-header">
                      <div className="envelope-name-group">
                        {e.horizon === 'court_terme'
                          ? <Clock size={13} className="icon-amber" />
                          : <TrendingUp size={13} className="icon-purple" />
                        }
                        <span className="expanded-name">{e.nom}</span>
                      </div>
                      <span className="expanded-value">{formatEUR(e.montant_actuel)}</span>
                    </div>
                    {e.objectif_total && (
                      <div className="envelope-sub-progress">
                        <div className="sub-track">
                          <div className="sub-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <div className="sub-labels">
                          <span>Cible : {formatEUR(e.objectif_total)}</span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="card-footer card-footer--end">
          <ChevronDown
            className={`chevron-icon ${isEpargneExpanded ? 'chevron-rotated' : ''}`}
            size={16}
          />
        </div>
      </div>

      {/* MODALES */}
      <StartMonthModal
        isOpen={isStartMonthOpen}
        onClose={() => setIsStartMonthOpen(false)}
        currentBalance={totalLiquiditeReel}
        targetMonth={targetMonth}
        onOpenSettings={() => { setIsStartMonthOpen(false); setIsSettingsOpen(true) }}
        onSuccess={() => { setIsStartMonthOpen(false); fetchDashboardData() }}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenIncomeSettings={() => { setIsProfileOpen(false); setIsIncomeSettingsOpen(true) }}
        onOpenDirectSavingSettings={() => { setIsProfileOpen(false); setIsDirectIncomeSettingsOpen(true) }}
        onOpenExpenseSettings={() => { setIsProfileOpen(false); setIsSettingsOpen(true) }}
        onOpenTransferSettings={() => { setIsProfileOpen(false); setIsTransferSettingsOpen(true) }}
        onOpenSavingSettings={() => { setIsProfileOpen(false); setIsSavingSettingsOpen(true) }}
      />

      <DirectIncomeSavingsManager
        isOpen={isDirectIncomeSettingsOpen}
        onClose={() => { setIsDirectIncomeSettingsOpen(false); fetchDashboardData() }}
      />

      <AddFixExpenseTemplate isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <IncomeManager isOpen={isIncomeSettingsOpen} onClose={() => setIsIncomeSettingsOpen(false)} />
      <InternalTransferManager
        isOpen={isTransferSettingsOpen}
        onClose={() => setIsTransferSettingsOpen(false)}
      />
      <ForcedSavingsManager
        isOpen={isSavingSettingsOpen}
        onClose={() => setIsSavingSettingsOpen(false)}
      />
    </div>
  )
}