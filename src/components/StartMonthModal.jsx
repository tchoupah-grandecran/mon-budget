import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Check, Loader2, ArrowRightLeft, PiggyBank, ArrowDown, ArrowUp, ArrowRight } from 'lucide-react'

export default function StartMonthModal({ isOpen, onClose, currentBalance, targetMonth, onSuccess }) {
  // Raw data from DB
  const [accounts, setAccounts] = useState([])
  const [fixedIncomes, setFixedIncomes] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [forcedSavings, setForcedSavings] = useState([])
  const [internalTransfers, setInternalTransfers] = useState([])
  const [directSavingsIncomes, setDirectSavingsIncomes] = useState([])

  // Checked/unchecked selection per item
  const [selectedIncomes, setSelectedIncomes] = useState([])
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [selectedSavings, setSelectedSavings] = useState([])
  const [selectedTransfers, setSelectedTransfers] = useState([])

  // Per-item bank account overrides (item id → bank account id)
  // FIX: initialized to the first bank account (not a non-existent `compte_id` field)
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
        supabase
          .from('epargne_forcee')
          .select('id, montant_mensuel, sous_compte_id, compte_id, sous_comptes_epargne(nom)')
          .eq('user_id', user.id),
        supabase
          .from('virements_internes_modeles')
          .select(`
            id, nom, montant, compte_origine_id, compte_destination_id,
            origine:comptes_bancaires!compte_origine_id(nom),
            destination:comptes_bancaires!compte_destination_id(nom)
          `)
          .eq('user_id', user.id),
        // FIX: fetch revenus_directs_epargne so they are applied to savings envelopes on month start
        supabase
          .from('revenus_directs_epargne')
          .select('id, montant, sous_compte_id, sous_comptes_epargne(nom)')
          .eq('user_id', user.id)
      ])

      const userBanks = bankRes.data || []
      // The id of the first bank account — used as the safe default everywhere
      const firstBankId = userBanks.length > 0 ? userBanks[0].id : ''

      setAccounts(userBanks)
      setSalaryAccount(firstBankId)

      const incomes   = incRes.data   || []
      const expenses  = expRes.data   || []
      const savings   = savRes.data   || []
      const transfers = transRes.data || []
      const direct    = directRes.data || []

      setFixedIncomes(incomes)
      setFixedExpenses(expenses)
      setForcedSavings(savings)
      setInternalTransfers(transfers)
      setDirectSavingsIncomes(direct)

      // Check everything by default
      setSelectedIncomes(incomes.map(i => i.id))
      setSelectedExpenses(expenses.map(e => e.id))
      setSelectedSavings(savings.map(s => s.id))
      setSelectedTransfers(transfers.map(t => t.id))

      // FIX: revenus_fixes_modeles and charges_fixes_modeles have no compte_id column.
      // Default every item to the first bank account instead of reading a non-existent field.
      setIncomeAccounts(
        incomes.reduce((acc, curr) => ({ ...acc, [curr.id]: firstBankId }), {})
      )
      setExpenseAccounts(
        expenses.reduce((acc, curr) => ({ ...acc, [curr.id]: firstBankId }), {})
      )
      // epargne_forcee DOES have compte_id — use it when available, else fall back to first bank
      setSavingAccounts(
        savings.reduce((acc, curr) => ({
          ...acc,
          [curr.id]: curr.compte_id || firstBankId
        }), {})
      )

    } catch (err) {
      console.error('Erreur de pré-chargement du mois :', err)
    }
  }

  const toggleSelection = (id, list, setList) => {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id])
  }

  const handleStartMonth = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur déconnecté')

      // ── 1. Budget calculations ─────────────────────────────────────────────

      const totalFixedIncomes = fixedIncomes
        .filter(i => selectedIncomes.includes(i.id))
        .reduce((acc, curr) => acc + Number(curr.montant), 0)

      const revenusTotaux = totalFixedIncomes + (parseFloat(salaireVariable) || 0)

      const totalCharges = fixedExpenses
        .filter(e => selectedExpenses.includes(e.id))
        .reduce((acc, curr) => acc + Number(curr.montant), 0)

      const totalForcedSavings = forcedSavings
        .filter(s => selectedSavings.includes(s.id))
        .reduce((acc, curr) => acc + Number(curr.montant_mensuel), 0)

      const depensesFixesTotales = totalCharges + totalForcedSavings
      const resteAVivre = currentBalance + revenusTotaux - depensesFixesTotales

      // ── 2. Fetch fresh balances for mutation ───────────────────────────────

      const [bankSnap, savSnap] = await Promise.all([
        supabase.from('comptes_bancaires').select('*').eq('user_id', user.id),
        supabase.from('sous_comptes_epargne').select('*').eq('user_id', user.id)
      ])

      let updatedBanks   = (bankSnap.data || []).map(a => ({ ...a }))
      let updatedSavings = (savSnap.data  || []).map(s => ({ ...s }))

      // A. Salaire principal → chosen bank account
      const variableMontant = parseFloat(salaireVariable) || 0
      if (variableMontant > 0 && salaryAccount) {
        const acc = updatedBanks.find(b => b.id === salaryAccount)
        if (acc) acc.solde = Number(acc.solde) + variableMontant
      }

      // B. Revenus fixes cochés → per-item chosen bank account
      fixedIncomes.filter(i => selectedIncomes.includes(i.id)).forEach(inc => {
        const chosenId = incomeAccounts[inc.id]
        const acc = updatedBanks.find(b => b.id === chosenId)
        if (acc) acc.solde = Number(acc.solde) + Number(inc.montant)
      })

      // C. Charges fixes cochées → debited from per-item chosen bank account
      fixedExpenses.filter(e => selectedExpenses.includes(e.id)).forEach(exp => {
        const chosenId = expenseAccounts[exp.id]
        const acc = updatedBanks.find(b => b.id === chosenId)
        if (acc) acc.solde = Number(acc.solde) - Number(exp.montant)
      })

      // D. Virements internes cochés → debit origin, credit destination
      internalTransfers.filter(t => selectedTransfers.includes(t.id)).forEach(trans => {
        const srcAcc  = updatedBanks.find(b => b.id === trans.compte_origine_id)
        const destAcc = updatedBanks.find(b => b.id === trans.compte_destination_id)
        if (srcAcc)  srcAcc.solde  = Number(srcAcc.solde)  - Number(trans.montant)
        if (destAcc) destAcc.solde = Number(destAcc.solde) + Number(trans.montant)
      })

      // E. Épargnes forcées cochées → debit bank, credit savings envelope
      forcedSavings.filter(s => selectedSavings.includes(s.id)).forEach(sav => {
        const chosenSourceId = savingAccounts[sav.id]
        const srcAcc  = updatedBanks.find(b => b.id === chosenSourceId)
        const destSav = updatedSavings.find(s => s.id === sav.sous_compte_id)
        if (srcAcc)  srcAcc.solde         = Number(srcAcc.solde)         - Number(sav.montant_mensuel)
        if (destSav) destSav.montant_actuel = Number(destSav.montant_actuel) + Number(sav.montant_mensuel)
      })

      // FIX F. Revenus directs épargne → credit savings envelope only (no bank debit — external income)
      directSavingsIncomes.forEach(dr => {
        const destSav = updatedSavings.find(s => s.id === dr.sous_compte_id)
        if (destSav) destSav.montant_actuel = Number(destSav.montant_actuel) + Number(dr.montant)
      })

      // ── 3. Persist all balance changes ────────────────────────────────────

      const bankUpdates    = updatedBanks.map(b =>
        supabase.from('comptes_bancaires').update({ solde: b.solde }).eq('id', b.id)
      )
      const savingsUpdates = updatedSavings.map(s =>
        supabase.from('sous_comptes_epargne').update({ montant_actuel: s.montant_actuel }).eq('id', s.id)
      )
      await Promise.all([...bankUpdates, ...savingsUpdates])

      // ── 4. Upsert monthly budget row ───────────────────────────────────────

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
      console.error('Erreur initialisation mois :', err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet glass-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Initialiser {targetMonth?.label}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="sheet-form" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>

          {/* ── 1. Salaire principal ── */}
          <div className="input-group-vertical">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2ecc71' }}>
              <ArrowUp size={16} /> Mon Salaire principal (Net reçu ce mois)
            </label>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <input
                type="number"
                placeholder="Montant net (€)"
                value={salaireVariable}
                onChange={e => setSalaireVariable(e.target.value)}
                style={{ flex: 2 }}
              />
              <select
                value={salaryAccount}
                onChange={e => setSalaryAccount(e.target.value)}
                style={{ flex: 2, height: '42px' }}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── 2. Autres revenus fixes ── */}
          <div className="input-group-vertical">
            <label>Autres Revenus attendus</label>
            <div className="list-wrapper">
              {fixedIncomes.length === 0 ? (
                <p style={{ fontSize: '12px', opacity: 0.4, textAlign: 'center', padding: '8px' }}>
                  Aucun revenu fixe paramétré.
                </p>
              ) : (
                fixedIncomes.map(income => (
                  <div
                    key={income.id}
                    className="list-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => toggleSelection(income.id, selectedIncomes, setSelectedIncomes)}
                  >
                    <div className={`checkbox-custom ${selectedIncomes.includes(income.id) ? 'checked' : ''}`}>
                      {selectedIncomes.includes(income.id) && <Check size={14} />}
                    </div>
                    <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {income.nom}
                    </span>
                    <span style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {Number(income.montant).toLocaleString('fr-FR')} €
                    </span>
                    <select
                      value={incomeAccounts[income.id] || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setIncomeAccounts({ ...incomeAccounts, [income.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.nom}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 3. Charges fixes ── */}
          <div className="input-group-vertical">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e74c3c' }}>
              <ArrowDown size={16} /> Charges fixes prévues
            </label>
            <div className="list-wrapper">
              {fixedExpenses.length === 0 ? (
                <p style={{ fontSize: '12px', opacity: 0.4, textAlign: 'center', padding: '8px' }}>
                  Aucune charge fixe paramétrée.
                </p>
              ) : (
                fixedExpenses.map(expense => (
                  <div
                    key={expense.id}
                    className="list-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => toggleSelection(expense.id, selectedExpenses, setSelectedExpenses)}
                  >
                    <div className={`checkbox-custom ${selectedExpenses.includes(expense.id) ? 'checked' : ''}`}>
                      {selectedExpenses.includes(expense.id) && <Check size={14} />}
                    </div>
                    <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {expense.nom}
                    </span>
                    <span style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {Number(expense.montant).toLocaleString('fr-FR')} €
                    </span>
                    <select
                      value={expenseAccounts[expense.id] || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setExpenseAccounts({ ...expenseAccounts, [expense.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.nom}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 4. Épargnes forcées ── */}
          <div className="input-group-vertical">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a8e0ff' }}>
              <PiggyBank size={16} /> Épargnes forcées automatiques
            </label>
            <div className="list-wrapper">
              {forcedSavings.length === 0 ? (
                <p style={{ fontSize: '12px', opacity: 0.4, textAlign: 'center', padding: '8px' }}>
                  Aucune épargne automatique configurée.
                </p>
              ) : (
                forcedSavings.map(saving => (
                  <div
                    key={saving.id}
                    className="list-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => toggleSelection(saving.id, selectedSavings, setSelectedSavings)}
                  >
                    <div className={`checkbox-custom ${selectedSavings.includes(saving.id) ? 'checked' : ''}`}>
                      {selectedSavings.includes(saving.id) && <Check size={14} />}
                    </div>
                    <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {saving.sous_comptes_epargne?.nom || 'Épargne'}
                    </span>
                    <span style={{ flex: 1, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {Number(saving.montant_mensuel).toLocaleString('fr-FR')} €
                    </span>
                    <select
                      value={savingAccounts[saving.id] || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setSavingAccounts({ ...savingAccounts, [saving.id]: e.target.value })}
                      className="inline-account-select"
                      style={{ flex: 1, fontSize: '12px', padding: '4px', minWidth: 0 }}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.nom}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 5. Virements internes ── */}
          <div className="input-group-vertical">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a8e0ff' }}>
              <ArrowRightLeft size={16} /> Virements internes programmés
            </label>
            <div className="list-wrapper">
              {internalTransfers.length === 0 ? (
                <p style={{ fontSize: '12px', opacity: 0.4, textAlign: 'center', padding: '8px' }}>
                  Aucun virement interne configuré.
                </p>
              ) : (
                internalTransfers.map(transfer => (
                  <div
                    key={transfer.id}
                    className="list-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => toggleSelection(transfer.id, selectedTransfers, setSelectedTransfers)}
                  >
                    <div className={`checkbox-custom ${selectedTransfers.includes(transfer.id) ? 'checked' : ''}`}>
                      {selectedTransfers.includes(transfer.id) && <Check size={14} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {transfer.nom}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.4, fontSize: '10px' }}>
                        <span>{transfer.origine?.nom || 'Source'}</span>
                        <ArrowRight size={8} />
                        <span>{transfer.destination?.nom || 'Cible'}</span>
                      </div>
                    </div>
                    <span style={{ flex: 1, textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '8px', fontWeight: 600, opacity: 0.8 }}>
                      {Number(transfer.montant).toLocaleString('fr-FR')} €
                    </span>
                    {/* Spacer to align with other rows that have a select */}
                    <div style={{ flex: 1 }} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 6. Revenus directs épargne (info only — always applied) ── */}
          {directSavingsIncomes.length > 0 && (
            <div className="input-group-vertical">
              <label style={{ color: '#2ecc71' }}>Revenus directs → Épargne (appliqués automatiquement)</label>
              <div className="list-wrapper">
                {directSavingsIncomes.map(dr => (
                  <div key={dr.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>{dr.sous_comptes_epargne?.nom || 'Enveloppe'}</span>
                    <span style={{ fontWeight: 600, color: '#2ecc71' }}>
                      +{Number(dr.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleStartMonth}
            className="submit-expense-btn"
            style={{ marginTop: '16px' }}
            disabled={loading}
          >
            {loading
              ? <Loader2 className="spinner" size={20} />
              : `Valider et lancer ${targetMonth?.label}`
            }
          </button>

        </div>
      </div>
    </div>
  )
}