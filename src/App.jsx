import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { Wallet, Landmark, Plus, Loader2 } from 'lucide-react'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Setup from './pages/Setup'
import Accounts from './pages/Accounts'
import UpdatePassword from './pages/UpdatePassword'
import AddExpenseModal from './components/AddExpenseModal'

function BottomNav({ onAddClick }) {
  const location = useLocation()
  return (
    <div className="bottom-nav glass-card">
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Wallet size={24} />
        <span>Budget</span>
      </Link>
      <button className="nav-item fab-nav-item" onClick={onAddClick}>
        <div className="fab-circle"><Plus size={28} /></div>
      </button>
      <Link to="/comptes" className={`nav-item ${location.pathname === '/comptes' ? 'active' : ''}`}>
        <Landmark size={24} />
        <span>Comptes</span>
      </Link>
    </div>
  )
}

function MainApp() {
  const [session, setSession] = useState(null)
  const [checkingSetup, setCheckingSetup] = useState(true)
  const [hasConfig, setHasConfig] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // 1. Récupération de la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    // 2. Écoute des changements d'état (Correction pour la récupération de mot de passe)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }
      handleSession(session)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  const handleSession = (session) => {
    setSession(session)
    if (session) {
      checkUserConfiguration(session.user.id)
    } else {
      setHasConfig(false)
      setCheckingSetup(false)
    }
  }

  const checkUserConfiguration = async (userId) => {
    try {
      setCheckingSetup(true)
      
      // OPTIMISATION : On vérifie 'comptes_bancaires' plutôt que les revenus fixes.
      // C'est beaucoup plus robuste si l'utilisateur supprime ses modèles plus tard.
      const { count, error } = await supabase
        .from('comptes_bancaires')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw error
      
      const isConfigured = (count || 0) > 0
      console.log("Configuration détectée :", isConfigured, "| Nombre de comptes :", count)
      setHasConfig(isConfigured)
    } catch (err) {
      console.error("Erreur check configuration:", err)
      setHasConfig(false)
    } finally {
      setCheckingSetup(false)
    }
  }

  if (recoveryMode) return <UpdatePassword onComplete={() => setRecoveryMode(false)} />
  if (!session) return <Auth />
  if (checkingSetup) return <div className="center-screen"><Loader2 className="spinner" size={32} /></div>
  
  // Si aucun compte bancaire n'est trouvé, on lance le Setup initiatique
  if (!hasConfig) return <Setup onSetupComplete={() => setHasConfig(true)} />

  return (
    <Router>
      <div style={{ paddingBottom: '80px' }}>
        <Routes>
          <Route path="/" element={<Dashboard key={refreshKey} />} />
          <Route path="/comptes" element={<Accounts />} />
        </Routes>
      </div>
      
      <BottomNav onAddClick={() => setIsExpenseModalOpen(true)} />
      
      <AddExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        onSuccess={() => {
          setIsExpenseModalOpen(false)
          setRefreshKey(prev => prev + 1) // Déclenche le re-useffect du Dashboard
        }} 
      />
    </Router>
  )
}

export default MainApp