import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Check, Loader2, ArrowRightLeft, PiggyBank, ArrowDown, ArrowUp, ArrowRight } from 'lucide-react'

export default function StartMonthModal({ isOpen, onClose, currentBalance, targetMonth, onSuccess }) {
  // Données de base de l'utilisateur
  const [accounts, setAccounts] = useState([]) 
  const [fixedIncomes, setFixedIncomes] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [forcedSavings, setForcedSavings] = useState([])
  const [internalTransfers, setInternalTransfers] = useState([])

  // États de sélection (Coché/Décoché)
  const [selectedIncomes, setSelectedIncomes] = useState([])
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [selectedSavings, setSelectedSavings] = useState([])
  const [selectedTransfers, setSelectedTransfers] = useState([])

  // États d'attribution dynamique des comptes bancaires (ID item -> ID compte bancaire)
  const [salaryAccount, setSalaryAccount] = useState('')
  const [incomeAccounts, setIncomeAccounts] = useState({})
  const [expenseAccounts, setExpenseAccounts] = useState({})
  const [savingAccounts, setSavingAccounts] = useState({})

  const [salaireVariable, setSalaireVariable] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Récupération globale de tous les modèles de l'utilisateur
      const [bankRes, incRes, expRes, savRes, transRes] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id),
        supabase.from('revenus_fixes_modeles').select('*').eq('user_id', user.id),
        supabase.from('charges_fixes_modeles').select('*').eq('user_id', user.id),
        supabase.from('epargne_forcee').select('id, montant_mensuel, sous_compte_id, compte_id, sous_comptes_epargne(nom)').eq('user_id', user.id),
        supabase.from('virements_internes_modeles').select(`
          id, nom, montant, compte_origine_id, compte_destination_id,
          origine:comptes_bancaires!compte_origine_id(nom),
          destination:comptes_bancaires!compte_destination_id(nom)
        `).eq('user_id', user.id)
      ])

      const userBanks = bankRes.data || []
      setAccounts(userBanks)

      if (userBanks.length > 0) {
        setSalaryAccount(userBanks[0].id)
      }

      setFixedIncomes(incRes.data || [])
      setFixedExpenses(expRes.data || [])
      setForcedSavings(savRes.data || [])
      setInternalTransfers(transRes.data || [])

      // Tout cocher par défaut à l'ouverture du nouveau mois
      setSelectedIncomes(incRes.data ? incRes.data.map(i => i.id) : [])
      setSelectedExpenses(expRes.data ? expRes.data.map(e => e.id) : [])
      setSelectedSavings(savRes.data ? savRes.data.map(s => s.id) : [])
      setSelectedTransfers(transRes.data ? transRes.data.map(t => t.id) : [])

      // Cartographie initiale des comptes associés par défaut selon les modèles
      setIncomeAccounts(incRes.data ? incRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.compte_id }), {}) : {})
      setExpenseAccounts(expRes.data ? expRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.compte_id }), {}) : {})
      setSavingAccounts(savRes.data ? savRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.compte_id }), {}) : {})

    } catch (err) {
      console.error("Erreur de pré-chargement du mois :", err)
    }
  }

  const handleStartMonth = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utilisateur déconnecté")

      // 1. CALCULS DU BUDGET GLOBAL
      const totalIncomes = fixedIncomes
        .filter(i => selectedIncomes.includes(i.id))
        .reduce((acc, curr) => acc + Number(curr.montant), 0)
      const revenusTotaux = totalIncomes + (parseFloat(salaireVariable) || 0)

      const totalCharges = fixedExpenses
        .filter(e => selectedExpenses.includes(e.id))
        .reduce((acc, curr) => acc + Number(curr.montant), 0)
      
      // L'épargne forcée est comptée comme une dépense fixe car elle sort du reste à vivre disponible
      const totalSavings = forcedSavings
        .filter(s => selectedSavings.includes(s.id))
        .reduce((acc, curr) => acc + Number(curr.montant_mensuel), 0)

      const depensesFixesTotales = totalCharges + totalSavings
      const resteAVivre = currentBalance + revenusTotaux - depensesFixesTotales

      // 2. EXTRACTION DES DONNÉES FRAÎCHES POUR MISE À JOUR BANCAIRE
      const savingsAccountsRes = await supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id)

      let updatedBanks = accounts.map(a => ({ ...a }))
      let updatedSavings = [...(savingsAccountsRes.data || [])]

      // A. Application du Salaire principal
      const variableMontant = parseFloat(salaireVariable) || 0
      if (variableMontant > 0 && salaryAccount) {
        const acc = updatedBanks.find(b => b.id === salaryAccount)
        if (acc) acc.solde = Number(acc.solde) + variableMontant
      }

      // B. Application des revenus fixes cochés (sur le compte choisi)
      fixedIncomes.filter(i => selectedIncomes.includes(i.id)).forEach(inc => {
        const chosenAccountId = incomeAccounts[inc.id] || inc.compte_id
        const acc = updatedBanks.find(b => b.id === chosenAccountId)
        if (acc) acc.solde = Number(acc.solde) + Number(inc.montant)
      })

      // C. Application des charges fixes cochées (depuis le compte choisi)
      fixedExpenses.filter(e => selectedExpenses.includes(e.id)).forEach(exp => {
        const chosenAccountId = expenseAccounts[exp.id] || exp.compte_id
        const acc = updatedBanks.find(b => b.id === chosenAccountId)
        if (acc) acc.solde = Number(acc.solde) - Number(exp.montant)
      })

      // D. Application des virements internes de compte à compte cochés
      internalTransfers.filter(t => selectedTransfers.includes(t.id)).forEach(trans => {
        const srcAcc = updatedBanks.find(b => b.id === trans.compte_origine_id)
        const destAcc = updatedBanks.find(b => b.id === trans.compte_destination_id)
        if (srcAcc) srcAcc.solde = Number(srcAcc.solde) - Number(trans.montant)
        if (destAcc) destAcc.solde = Number(destAcc.solde) + Number(trans.montant)
      })

      // E. Application des épargnes forcées (Le double mouvement : Débit courant -> Crédit enveloppe)
      forcedSavings.filter(s => selectedSavings.includes(s.id)).forEach(sav => {
        // Débit du compte courant sélectionné
        const chosenSourceId = savingAccounts[sav.id] || sav.compte_id
        const srcAcc = updatedBanks.find(b => b.id === chosenSourceId)
        if (srcAcc) srcAcc.solde = Number(srcAcc.solde) - Number(sav.montant_mensuel)

        // Crédit du sous-compte d'épargne cible
        const destSav = updatedSavings.find(sAcc => sAcc.id === sav.sous_compte_id)
        if (destSav) destSav.montant_actuel = Number(destSav.montant_actuel) + Number(sav.montant_mensuel)
      })

      // Soumission groupée des nouveaux soldes en BDD
      const bankUpdates = updatedBanks.map(b => supabase.from('comptes_bancaires').update({ solde: b.solde }).eq('id', b.id))
      const savingsUpdates = updatedSavings.map(s => supabase.from('sous_comptes_epargne').update({ montant_actuel: s.montant_actuel }).eq('id', s.id))
      await Promise.all([...bankUpdates, ...savingsUpdates])

      // 3. ENVOI DE LA LIGNE BUDGET MENSUEL (Initial et Évolutif)
      const { error } = await supabase.from('budgets_mensuels').upsert({
        user_id: user.id,
        mois: targetMonth.code,
        total_revenus: revenusTotaux,
        total_depenses_fixes: depensesFixesTotales,
        reste_a_vivre_initial: resteAVivre,
        reste_a_vivre: resteAVivre
      }, { onConflict: 'user_id, mois' })

      if (error) throw error

      setSalaireVariable('')
      onSuccess()
    } catch (err) {
      console.error("Erreur initialisation mois :", err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const toggleSelection = (id, list, setList) => {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Initialiser le mois de {targetMonth?.label}</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>
        
        {/* FORMULAIRE SCROLLABLE SÉCURISÉ */}
        <div className="sheet-form" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* 1. SAISIE SALAIRE PRINCIPAL */}
          <div className="input-group-vertical">
            <label className="flex items-center gap-2 text-green"><ArrowUp size={16}/> Mon Salaire principal (Net reçu ce mois)</label>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <input 
                type="number" 
                placeholder="Montant net reçu (€)" 
                value={salaireVariable} 
                onChange={e => setSalaireVariable(e.target.value)} 
                style={{ flex: 2 }}
              />
              <select 
                value={salaryAccount} 
                onChange={e => setSalaryAccount(e.target.value)}
                className="modal-account-select"
                style={{ flex: 2, height: '42px' }}
              >
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
              </select>
            </div>
          </div>

          {/* 2. AUTRES REVENUS FIXES */}
          <div className="input-group-vertical">
            <label>Autres Revenus attendus</label>
            <div className="list-wrapper">
              {fixedIncomes.length === 0 ? (
                <p className="text-xs opacity-40 p-2 text-center">Aucun revenu fixe paramétré.</p>
              ) : (
                fixedIncomes.map(income => (
                  <div key={income.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => toggleSelection(income.id, selectedIncomes, setSelectedIncomes)}>
                    <div className={`checkbox-custom ${selectedIncomes.includes(income.id) ? 'checked' : ''}`}>
                      {selectedIncomes.includes(income.id) && <Check size={14} />}
                    </div>
                    
                    {/* [2] LIBELLE */}
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{income.nom}</span>
                    
                    {/* [1] MONTANT SUR UNE SEULE LIGNE */}
                    <span className="opacity-80 font-semibold" style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap' }}>
                      {Number(income.montant).toLocaleString('fr-FR')} €
                    </span>

                    {/* [1] CHOIX DE LA BANQUE */}
                    <select
                      value={incomeAccounts[income.id] || ''}
                      onClick={e => e.stopPropagation()} 
                      onChange={e => setIncomeAccounts({ ...incomeAccounts, [income.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. CHARGES FIXES */}
          <div className="input-group-vertical">
            <label className="flex items-center gap-2 text-red"><ArrowDown size={16}/> Charges fixes prévues</label>
            <div className="list-wrapper">
              {fixedExpenses.length === 0 ? (
                <p className="text-xs opacity-40 p-2 text-center">Aucune charge fixe paramétrée.</p>
              ) : (
                fixedExpenses.map(expense => (
                  <div key={expense.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => toggleSelection(expense.id, selectedExpenses, setSelectedExpenses)}>
                    <div className={`checkbox-custom ${selectedExpenses.includes(expense.id) ? 'checked' : ''}`}>
                      {selectedExpenses.includes(expense.id) && <Check size={14} />}
                    </div>
                    
                    {/* [2] LIBELLE */}
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{expense.nom}</span>
                    
                    {/* [1] MONTANT SUR UNE SEULE LIGNE */}
                    <span className="opacity-80 font-semibold" style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap' }}>
                      {Number(expense.montant).toLocaleString('fr-FR')} €
                    </span>

                    {/* [1] CHOIX DE LA BANQUE (Résolution du bug du 'e') */}
                    <select
                      value={expenseAccounts[expense.id] || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setExpenseAccounts({ ...expenseAccounts, [expense.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. ÉPARGNES FORCÉES AUTOMATIQUES */}
          <div className="input-group-vertical">
            <label className="flex items-center gap-2 text-blue"><PiggyBank size={16}/> Épargnes forcées automatiques</label>
            <div className="list-wrapper">
              {forcedSavings.length === 0 ? (
                <p className="text-xs opacity-40 p-2 text-center">Aucune épargne automatique configurée.</p>
              ) : (
                forcedSavings.map(saving => (
                  <div key={saving.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => toggleSelection(saving.id, selectedSavings, setSelectedSavings)}>
                    <div className={`checkbox-custom ${selectedSavings.includes(saving.id) ? 'checked' : ''}`}>
                      {selectedSavings.includes(saving.id) && <Check size={14} />}
                    </div>
                    
                    {/* [2] LIBELLE DE L'ENVELOPPE CIBLE */}
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {saving.sous_comptes_epargne?.nom || 'Épargne'}
                    </span>

                    {/* [1] MONTANT SUR UNE SEULE LIGNE */}
                    <span className="opacity-80 font-semibold" style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap' }}>
                      {Number(saving.montant_mensuel).toLocaleString('fr-FR')} €
                    </span>

                    {/* [1] CHOIX DU COMPTE BANQUE SOURCE DU PRÉLÈVEMENT */}
                    <select
                      value={savingAccounts[saving.id] || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setSavingAccounts({ ...savingAccounts, [saving.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. VIREMENTS DE COMPTE À COMPTE INTERNES */}
          <div className="input-group-vertical">
            <label className="flex items-center gap-2 text-blue-fill"><ArrowRightLeft size={16}/> Virements internes programmés</label>
            <div className="list-wrapper">
              {internalTransfers.length === 0 ? (
                <p className="text-xs opacity-40 p-2 text-center">Aucun virement interne configuré.</p>
              ) : (
                internalTransfers.map(transfer => (
                  <div key={transfer.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => toggleSelection(transfer.id, selectedTransfers, setSelectedTransfers)}>
                    <div className={`checkbox-custom ${selectedTransfers.includes(transfer.id) ? 'checked' : ''}`}>
                      {selectedTransfers.includes(transfer.id) && <Check size={14} />}
                    </div>
                    
                    {/* [2] LIBELLE & TRACE DE CHEMIN DE TRANSITION */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: 0 }}>
                      <span className="font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{transfer.nom}</span>
                      <div className="flex items-center gap-1 opacity-40" style={{ fontSize: '10px' }}>
                        <span>{transfer.origine?.nom || 'Source'}</span>
                        <ArrowRight size={8} />
                        <span>{transfer.destination?.nom || 'Cible'}</span>
                      </div>
                    </div>
                    
                    {/* [1] MONTANT SUR UNE SEULE LIGNE */}
                    <span className="opacity-70 font-semibold" style={{ flex: 1, textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                      {Number(transfer.montant).toLocaleString('fr-FR')} €
                    </span>

                    {/* [1] DIVISION FICTIVE POUR RESPECTER LE COMPORTEMENT DU RATIO EN CONSOLE DE LIGNE */}
                    <div style={{ flex: 1 }} />
                  </div>
                ))
              )}
            </div>
          </div>
          
          <button onClick={handleStartMonth} className="submit-expense-btn" style={{ marginTop: '16px' }} disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20}/> : `Valider et lancer le mois de ${targetMonth?.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}