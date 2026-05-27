import { supabase } from '../lib/supabase'
import { 
  X, 
  LogOut, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ArrowRightLeft, 
  Trash2, 
  PiggyBank,
  Coins // Nouvelle icône pour les revenus directs épargne
} from 'lucide-react'

export default function ProfileModal({ 
  isOpen, 
  onClose, 
  onOpenExpenseSettings, 
  onOpenIncomeSettings, 
  onOpenTransferSettings,
  onOpenSavingSettings,
  onOpenDirectSavingSettings // Nouvelle prop pour ouvrir les revenus directs vers l'épargne
}) {
  
  const handleReset = async () => {
    if (!confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment remettre tous les soldes à 0€ ?")) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Réinitialisation des soldes
    const [res1, res2] = await Promise.all([
      supabase.from('comptes_bancaires').update({ solde: 0 }).eq('user_id', user.id),
      supabase.from('sous_comptes_epargne').update({ montant_actuel: 0 }).eq('user_id', user.id)
    ]);

    if (!res1.error && !res2.error) {
      alert("Comptes réinitialisés avec succès !");
      window.location.reload();
    } else {
      alert("Erreur lors de la réinitialisation.");
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Mon Profil</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>
        
        <div className="sheet-form">
          {/* Section Gestion / Modèles */}
          <button className="profile-action-btn" onClick={onOpenIncomeSettings}>
            <ArrowUpCircle size={20} className="text-green" /> Gérer mes revenus fixes (Courant)
          </button>

          {/* Nouveau bouton Revenus directs Épargne */}
          <button className="profile-action-btn" onClick={onOpenDirectSavingSettings}>
            <Coins size={20} className="text-green" /> Gérer mes revenus directs Épargne
          </button>
          
          <button className="profile-action-btn" onClick={onOpenExpenseSettings}>
            <ArrowDownCircle size={20} className="text-red" /> Gérer mes dépenses fixes
          </button>

          <button className="profile-action-btn" onClick={onOpenTransferSettings}>
            <ArrowRightLeft size={20} className="text-blue" /> Gérer mes virements internes
          </button>

          <button className="profile-action-btn" onClick={onOpenSavingSettings}>
            <PiggyBank size={20} className="text-blue" /> Gérer mes épargnes forcées
          </button>
          
          <hr style={{opacity: 0.1, margin: '20px 0'}} />
          
          {/* Section Actions de compte */}
          <button className="profile-action-btn text-red" onClick={handleReset}>
            <Trash2 size={20}/> Réinitialiser tous les soldes à 0€
          </button>
          
          <button className="profile-action-btn" onClick={() => supabase.auth.signOut()}>
            <LogOut size={20}/> Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}