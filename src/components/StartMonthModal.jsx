import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Check, Loader2, ArrowRightLeft, PiggyBank, ArrowDown, ArrowUp, Coins } from 'lucide-react'

function SectionHeader({ icon, label, colorClass }) {
  return (
    <div className={`section-header ${colorClass}`}>
      {icon}
      <span>{label}</span>
    </div>
  )
}

function EmptyRow({ label }) {
  return <p className="empty-row">{label}</p>
}

function CheckRow({ checked, onClick, children }) {
  return (
    <div
      className={`check-row ${checked ? 'check-row--checked' : ''}`}
      onClick={onClick}
    >
      <div className={`checkbox-custom ${checked ? 'checked' : ''}`}>
        {checked && <Check size={11} strokeWidth={3}/>}
      </div>
      {children}
    </div>
  )
}

function InlineSelect({ value, options, onChange, onClick }) {
  return (
    <select
      className="inline-account-select"
      value={value}
      onChange={onChange}
      onClick={onClick}
    >
      {options.map(acc => (
        <option key={acc.id} value={acc.id}>{acc.nom}</option>
      ))}
    </select>
  )
}

export default function StartMonthModal({ isOpen, onClose, currentBalance, targetMonth, onSuccess }) {
  const [accounts, setAccounts] = useState([])
  const [fixedIncomes, setFixedIncomes] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [forcedSavings, setForcedSavings] = useState([])
  const [internalTransfers, setInternalTransfers] = useState([])
  const [directSavingsIncomes, setDirectSavingsIncomes] = useState([])

  const [selectedIncomes, setSelectedIncomes] = useState([])
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [selectedSavings, setSelectedSavings] = useState([])
  const [selectedTransfers, setSelectedTransfers] = useState([])

  const [incomeAccounts, setIncomeAccounts] = useState({})
  const [expenseAccounts, setExpenseAccounts] = useState({})
  const [savingAccounts, setSavingAccounts] = useState({})

  const [salaireVariable, setSalaireVariable] = useState('')
  const [salaryAccount, setSalaryAccount] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [bankRes, incRes, expRes, savRes, transRes, directRes] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id),
        supabase.from('revenus_fixes_modeles').select('*').eq('user_id', user.id),
        supabase.from('charges_fixes_modeles').select('*').eq('user_id', user.id),
        supabase.from('epargne_forcee')
          .select('id, montant_mensuel, sous_compte_id, compte_id, sous_comptes_epargne(nom)')
          .eq('user_id', user.id),
        supabase.from('virements_internes_modeles')
          .select(`id, nom, montant, compte_origine_id, compte_destination_id,
            origine:comptes_bancaires!compte_origine_id(nom),
            destination:comptes_bancaires!compte_destination_id(nom)`)
          .eq('user_id', user.id),
        supabase.from('revenus_directs_epargne')
          .select('id, montant, sous_compte_id, sous_comptes_epargne(nom)')
          .eq('user_id', user.id)
      ])

      const userBanks   = bankRes.data   || []
      const firstBankId = userBanks.length > 0 ? userBanks[0].id : ''
      const incomes     = incRes.data    || []
      const expenses    = expRes.data    || []
      const savings     = savRes.data    || []
      const transfers   = transRes.data  || []
      const direct      = directRes.data || []

      setAccounts(userBanks)
      setSalaryAccount(firstBankId)
      setFixedIncomes(incomes)
      setFixedExpenses(expenses)
      setForcedSavings(savings)
      setInternalTransfers(transfers)
      setDirectSavingsIncomes(direct)

      setSelectedIncomes(incomes.map(i => i.id))
      setSelectedExpenses(expenses.map(e => e.id))
      setSelectedSavings(savings.map(s => s.id))
      setSelectedTransfers(transfers.map(t => t.id))

      setIncomeAccounts(incomes.reduce((a, c) => ({ ...a, [c.id]: firstBankId }), {}))
      setExpenseAccounts(expenses.reduce((a, c) => ({ ...a, [c.id]: firstBankId }), {}))
      setSavingAccounts(savings.reduce((a, c) => ({ ...a, [c.id]: c.compte_id || firstBankId }), {}))
    } catch (err) {
      console.error('Erreur de pré-chargement du mois :', err)
    }
  }

  const toggle = (id, list, setList) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const handleStartMonth = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur déconnecté')

      const totalFixedIncomes    = fixedIncomes.filter(i => selectedIncomes.includes(i.id)).reduce((a, c) => a + Number(c.montant), 0)
      const revenusTotaux        = totalFixedIncomes + (parseFloat(salaireVariable) || 0)
      const totalCharges         = fixedExpenses.filter(e => selectedExpenses.includes(e.id)).reduce((a, c) => a + Number(c.montant), 0)
      const totalForcedSavings   = forcedSavings.filter(s => selectedSavings.includes(s.id)).reduce((a, c) => a + Number(c.montant_mensuel), 0)
      const depensesFixesTotales = totalCharges + totalForcedSavings
      const resteAVivre          = currentBalance + revenusTotaux - depensesFixesTotales

      const [bankSnap, savSnap] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id),
        supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id)
      ])

      let updatedBanks   = (bankSnap.data || []).map(a => ({ ...a }))
      let updatedSavings = (savSnap.data  || []).map(s => ({ ...s }))

      const variableMontant = parseFloat(salaireVariable) || 0
      if (variableMontant > 0 && salaryAccount) {
        const acc = updatedBanks.find(b => b.id === salaryAccount)
        if (acc) acc.solde = Number(acc.solde) + variableMontant
      }

      fixedIncomes.filter(i => selectedIncomes.includes(i.id)).forEach(inc => {
        const acc = updatedBanks.find(b => b.id === incomeAccounts[inc.id])
        if (acc) acc.solde = Number(acc.solde) + Number(inc.montant)
      })

      fixedExpenses.filter(e => selectedExpenses.includes(e.id)).forEach(exp => {
        const acc = updatedBanks.find(b => b.id === expenseAccounts[exp.id])
        if (acc) acc.solde = Number(acc.solde) - Number(exp.montant)
      })

      internalTransfers.filter(t => selectedTransfers.includes(t.id)).forEach(trans => {
        const src  = updatedBanks.find(b => b.id === trans.compte_origine_id)
        const dest = updatedBanks.find(b => b.id === trans.compte_destination_id)
        if (src)  src.solde  = Number(src.solde)  - Number(trans.montant)
        if (dest) dest.solde = Number(dest.solde) + Number(trans.montant)
      })

      forcedSavings.filter(s => selectedSavings.includes(s.id)).forEach(sav => {
        const src  = updatedBanks.find(b => b.id === savingAccounts[sav.id])
        const dest = updatedSavings.find(s => s.id === sav.sous_compte_id)
        if (src)  src.solde           = Number(src.solde)           - Number(sav.montant_mensuel)
        if (dest) dest.montant_actuel = Number(dest.montant_actuel) + Number(sav.montant_mensuel)
      })

      directSavingsIncomes.forEach(dr => {
        const dest = updatedSavings.find(s => s.id === dr.sous_compte_id)
        if (dest) dest.montant_actuel = Number(dest.montant_actuel) + Number(dr.montant)
      })

      await Promise.all([
        ...updatedBanks.map(b => supabase.from('comptes_bancaires').update({ solde: b.solde }).eq('id', b.id)),
        ...updatedSavings.map(s => supabase.from('sous_comptes_epargne').update({ montant_actuel: s.montant_actuel }).eq('id', s.id))
      ])

      // On prépare les données du budget
const budgetPayload = {
  user_id: user.id,
  mois: targetMonth.code,
  total_revenus: revenusTotaux,
  total_depenses_fixes: depensesFixesTotales,
  // Sécurité: on s'assure qu'on envoie bien un nombre (fallback à 0 si currentBalance bug)
  reste_a_vivre_initial: resteAVivre || 0,
  reste_a_vivre: resteAVivre || 0 
}

// 1. On cherche si le mois est déjà initialisé
const { data: existingBudget } = await supabase
  .from('budgets_mensuels')
  .select('id')
  .eq('user_id', user.id)
  .eq('mois', targetMonth.code)
  .maybeSingle()

// 2. On Update ou on Insert manuellement
if (existingBudget) {
  const { error } = await supabase
    .from('budgets_mensuels')
    .update(budgetPayload)
    .eq('id', existingBudget.id)
    
  if (error) throw error
} else {
  const { error } = await supabase
    .from('budgets_mensuels')
    .insert([budgetPayload])
    
  if (error) throw error
}

      setSalaireVariable('')
      onSuccess()
    } catch (err) {
      console.error('Erreur initialisation mois :', err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const fmt = (n) => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sheet-header">
          <h3>Initialiser le mois de {targetMonth?.label}</h3>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        {/* Scroll zone — sans le CTA */}
        <div className="month-form-scroll">

          {/* 1. Salaire principal */}
          <div className="month-section">
            <SectionHeader icon={<ArrowUp size={14}/>} label="Salaire principal" colorClass="color-green"/>
            <div className="salary-row">
              <input
                type="number"
                placeholder="Montant net (€)"
                value={salaireVariable}
                onChange={e => setSalaireVariable(e.target.value)}
                className="salary-input"
              />
              <select
                value={salaryAccount}
                onChange={e => setSalaryAccount(e.target.value)}
                className="salary-select"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Autres revenus fixes */}
          <div className="month-section">
            <SectionHeader icon={<ArrowUp size={14}/>} label="Autres revenus attendus" colorClass="color-green"/>
            {fixedIncomes.length === 0
              ? <EmptyRow label="Aucun revenu fixe paramétré"/>
              : fixedIncomes.map(income => (
                <CheckRow
                  key={income.id}
                  checked={selectedIncomes.includes(income.id)}
                  onClick={() => toggle(income.id, selectedIncomes, setSelectedIncomes)}
                >
                  <span className="check-row__label">{income.nom}</span>
                  <span className="check-row__amount color-green">+{fmt(income.montant)}</span>
                  <InlineSelect
                    value={incomeAccounts[income.id] || ''}
                    options={accounts}
                    onChange={e => setIncomeAccounts({ ...incomeAccounts, [income.id]: e.target.value })}
                    onClick={e => e.stopPropagation()}
                  />
                </CheckRow>
              ))
            }
          </div>

          {/* 3. Charges fixes */}
          <div className="month-section">
            <SectionHeader icon={<ArrowDown size={14}/>} label="Charges fixes prévues" colorClass="color-red"/>
            {fixedExpenses.length === 0
              ? <EmptyRow label="Aucune charge fixe paramétrée"/>
              : fixedExpenses.map(expense => (
                <CheckRow
                  key={expense.id}
                  checked={selectedExpenses.includes(expense.id)}
                  onClick={() => toggle(expense.id, selectedExpenses, setSelectedExpenses)}
                >
                  <span className="check-row__label">{expense.nom}</span>
                  <span className="check-row__amount color-red">−{fmt(expense.montant)}</span>
                  <InlineSelect
                    value={expenseAccounts[expense.id] || ''}
                    options={accounts}
                    onChange={e => setExpenseAccounts({ ...expenseAccounts, [expense.id]: e.target.value })}
                    onClick={e => e.stopPropagation()}
                  />
                </CheckRow>
              ))
            }
          </div>

          {/* 4. Épargnes forcées */}
          <div className="month-section">
            <SectionHeader icon={<PiggyBank size={14}/>} label="Épargnes programmées" colorClass="color-blue"/>
            {forcedSavings.length === 0
              ? <EmptyRow label="Aucune épargne automatique configurée"/>
              : forcedSavings.map(saving => (
                <CheckRow
                  key={saving.id}
                  checked={selectedSavings.includes(saving.id)}
                  onClick={() => toggle(saving.id, selectedSavings, setSelectedSavings)}
                >
                  <span className="check-row__label">{saving.sous_comptes_epargne?.nom || 'Épargne'}</span>
                  <span className="check-row__amount color-blue">{fmt(saving.montant_mensuel)}</span>
                  <InlineSelect
                    value={savingAccounts[saving.id] || ''}
                    options={accounts}
                    onChange={e => setSavingAccounts({ ...savingAccounts, [saving.id]: e.target.value })}
                    onClick={e => e.stopPropagation()}
                  />
                </CheckRow>
              ))
            }
          </div>

          {/* 5. Virements internes */}
          <div className="month-section">
            <SectionHeader icon={<ArrowRightLeft size={14}/>} label="Virements internes" colorClass="color-blue"/>
            {internalTransfers.length === 0
              ? <EmptyRow label="Aucun virement interne configuré"/>
              : internalTransfers.map(transfer => (
                <CheckRow
                  key={transfer.id}
                  checked={selectedTransfers.includes(transfer.id)}
                  onClick={() => toggle(transfer.id, selectedTransfers, setSelectedTransfers)}
                >
                  <div className="check-row__transfer">
                    <span className="check-row__label">{transfer.nom}</span>
                    <span className="check-row__route">
                      {transfer.origine?.nom || '?'} → {transfer.destination?.nom || '?'}
                    </span>
                  </div>
                  <span className="check-row__amount color-blue">{fmt(transfer.montant)}</span>
                  <div className="check-row__spacer"/>
                </CheckRow>
              ))
            }
          </div>

          {/* 6. Revenus directs épargne */}
          {directSavingsIncomes.length > 0 && (
            <div className="month-section">
              <SectionHeader icon={<Coins size={14}/>} label="Revenus directs → Épargne" colorClass="color-green"/>
              {directSavingsIncomes.map(dr => (
                <div key={dr.id} className="direct-saving-row">
                  <span className="check-row__label">{dr.sous_comptes_epargne?.nom || 'Enveloppe'}</span>
                  <span className="check-row__amount color-green">+{fmt(dr.montant)}</span>
                </div>
              ))}
            </div>
          )}

        </div>{/* fin month-form-scroll */}

        {/* CTA — collé en bas, hors du scroll */}
        <div className="month-cta">
          <button
            onClick={handleStartMonth}
            className="submit-expense-btn"
            disabled={loading}
          >
            {loading
              ? <Loader2 className="spinner" size={20}/>
              : <><Check size={18}/> Commencer le mois</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}