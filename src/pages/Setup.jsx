import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react'
import './Setup.css'

export default function Setup({ onSetupComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — Revenus & Charges fixes
  const [revenus, setRevenus] = useState([{ nom: 'Salaire', montant: '' }])
  const [charges, setCharges] = useState([{ nom: 'Loyer', montant: '' }])

  // Step 2 — Comptes bancaires (NEW — required for app to unlock)
  const [comptesBancaires, setComptesBancaires] = useState([
    { nom: 'Compte courant', solde: '' }
  ])

  // Step 3 — Enveloppes d'épargne
  const [comptes, setComptes] = useState([
    { nom: 'Épargne de précaution', horizon: 'court_terme', montant_actuel: '', objectif_total: '' }
  ])

  // Step 4 — Épargne forcée
  const [epargnesForcees, setEpargnesForcees] = useState({})

  // ── Generic row helpers ──────────────────────────────────────────────────────

  const addRow = (type) => {
    if (type === 'revenu')  setRevenus([...revenus, { nom: '', montant: '' }])
    if (type === 'charge')  setCharges([...charges, { nom: '', montant: '' }])
    if (type === 'banque')  setComptesBancaires([...comptesBancaires, { nom: '', solde: '' }])
    if (type === 'compte')  setComptes([...comptes, { nom: '', horizon: 'court_terme', montant_actuel: '', objectif_total: '' }])
  }

  const removeRow = (type, index) => {
    if (type === 'revenu')  setRevenus(revenus.filter((_, i) => i !== index))
    if (type === 'charge')  setCharges(charges.filter((_, i) => i !== index))
    if (type === 'banque')  setComptesBancaires(comptesBancaires.filter((_, i) => i !== index))
    if (type === 'compte')  setComptes(comptes.filter((_, i) => i !== index))
  }

  const updateRow = (type, index, field, value) => {
    const updateArr = (arr, setter) => {
      const newArr = [...arr]
      newArr[index][field] = value
      setter(newArr)
    }
    if (type === 'revenu')  updateArr(revenus, setRevenus)
    if (type === 'charge')  updateArr(charges, setCharges)
    if (type === 'banque')  updateArr(comptesBancaires, setComptesBancaires)
    if (type === 'compte')  updateArr(comptes, setComptes)
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  const goToStep3 = () => {
    // Require at least one named bank account before proceeding
    const validBanques = comptesBancaires.filter(b => b.nom.trim())
    if (validBanques.length === 0) {
      alert('Ajoute au moins un compte bancaire pour continuer.')
      return
    }
    setStep(3)
  }

  const goToStep4 = () => {
    const initialForcee = {}
    comptes.forEach((_, index) => { initialForcee[index] = '' })
    setEpargnesForcees(initialForcee)
    setStep(4)
  }

  // ── Final submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non authentifié')

      // 1. Comptes bancaires (gates the entire app — must be first)
      const banquesData = comptesBancaires
        .filter(b => b.nom.trim())
        .map(b => ({
          user_id: user.id,
          nom: b.nom.trim(),
          solde: parseFloat(b.solde) || 0
        }))

      if (banquesData.length === 0) throw new Error('Au moins un compte bancaire est requis.')

      const { error: banquesErr } = await supabase
        .from('comptes_bancaires')
        .insert(banquesData)
      if (banquesErr) throw new Error('Comptes bancaires : ' + banquesErr.message)

      // 2. Revenus fixes
      const revenusData = revenus
        .filter(r => r.nom && r.montant)
        .map(r => ({ user_id: user.id, nom: r.nom, montant: parseFloat(r.montant) }))
      if (revenusData.length > 0) {
        const { error } = await supabase.from('revenus_fixes_modeles').insert(revenusData)
        if (error) throw new Error('Revenus : ' + error.message)
      }

      // 3. Charges fixes
      const chargesData = charges
        .filter(c => c.nom && c.montant)
        .map(c => ({ user_id: user.id, nom: c.nom, montant: parseFloat(c.montant) }))
      if (chargesData.length > 0) {
        const { error } = await supabase.from('charges_fixes_modeles').insert(chargesData)
        if (error) throw new Error('Charges : ' + error.message)
      }

      // 4. Enveloppes d'épargne + épargne forcée
      for (let i = 0; i < comptes.length; i++) {
        const c = comptes[i]
        if (!c.nom.trim()) continue

        const { data: insertedCompte, error: compteErr } = await supabase
          .from('sous_comptes_epargne')
          .insert({
            user_id: user.id,
            nom: c.nom.trim(),
            horizon: c.horizon,
            montant_actuel: parseFloat(c.montant_actuel) || 0,
            objectif_total: c.objectif_total ? parseFloat(c.objectif_total) : null
          })
          .select()
          .single()

        if (compteErr) throw new Error('Épargne : ' + compteErr.message)

        const montantMensuel = parseFloat(epargnesForcees[i])
        if (montantMensuel > 0 && insertedCompte) {
          const { error: forceeErr } = await supabase.from('epargne_forcee').insert({
            user_id: user.id,
            sous_compte_id: insertedCompte.id,
            montant_mensuel: montantMensuel
            // compte_id intentionally omitted — user configures it later via ForcedSavingsManager
          })
          if (forceeErr) throw new Error('Épargne forcée : ' + forceeErr.message)
        }
      }

      onSetupComplete()
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="setup-container">

      {/* Progress dots — now 4 steps */}
      <div className="setup-progress">
        <span className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</span>
        <div className="step-line"></div>
        <span className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</span>
        <div className="step-line"></div>
        <span className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</span>
        <div className="step-line"></div>
        <span className={`step-dot ${step >= 4 ? 'active' : ''}`}>4</span>
      </div>

      {/* ── STEP 1 : Revenus & Charges ── */}
      {step === 1 && (
        <div className="glass-card setup-card">
          <h2>Revenus & Charges fixes</h2>
          <p className="setup-subtitle">Ces modèles seront réutilisés chaque mois lors de l'initialisation.</p>

          <div className="setup-section">
            <h3>Mes Revenus</h3>
            {revenus.map((r, i) => (
              <div key={i} className="form-row">
                <input
                  type="text"
                  placeholder="Ex : Salaire"
                  value={r.nom}
                  onChange={(e) => updateRow('revenu', i, 'nom', e.target.value)}
                  className="wide-input"
                />
                <input
                  type="number"
                  placeholder="0 €"
                  value={r.montant}
                  onChange={(e) => updateRow('revenu', i, 'montant', e.target.value)}
                  className="narrow-input"
                />
                {revenus.length > 1 && (
                  <button onClick={() => removeRow('revenu', i)} className="btn-delete">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addRow('revenu')} className="btn-add">
              <Plus size={16} /> Ajouter un revenu
            </button>
          </div>

          <div className="setup-section">
            <h3>Charges Fixes</h3>
            {charges.map((c, i) => (
              <div key={i} className="form-row">
                <input
                  type="text"
                  placeholder="Ex : Loyer"
                  value={c.nom}
                  onChange={(e) => updateRow('charge', i, 'nom', e.target.value)}
                  className="wide-input"
                />
                <input
                  type="number"
                  placeholder="0 €"
                  value={c.montant}
                  onChange={(e) => updateRow('charge', i, 'montant', e.target.value)}
                  className="narrow-input"
                />
                {charges.length > 1 && (
                  <button onClick={() => removeRow('charge', i)} className="btn-delete">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addRow('charge')} className="btn-add">
              <Plus size={16} /> Ajouter une charge
            </button>
          </div>

          <button onClick={() => setStep(2)} className="btn-next">
            Continuer <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* ── STEP 2 : Comptes Bancaires (NEW — gates app unlock) ── */}
      {step === 2 && (
        <div className="glass-card setup-card">
          <h2>Mes Comptes Bancaires</h2>
          <p className="setup-subtitle">
            Ajoute tes comptes courants, livrets, etc. Le solde sera mis à jour à chaque début de mois.
          </p>

          <div className="setup-section">
            {comptesBancaires.map((b, i) => (
              <div key={i} className="form-row">
                <input
                  type="text"
                  placeholder="Ex : Compte courant LCL"
                  value={b.nom}
                  onChange={(e) => updateRow('banque', i, 'nom', e.target.value)}
                  className="wide-input"
                />
                <input
                  type="number"
                  placeholder="Solde (€)"
                  value={b.solde}
                  onChange={(e) => updateRow('banque', i, 'solde', e.target.value)}
                  className="narrow-input"
                />
                {comptesBancaires.length > 1 && (
                  <button onClick={() => removeRow('banque', i)} className="btn-delete">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addRow('banque')} className="btn-add">
              <Plus size={16} /> Ajouter un compte
            </button>
          </div>

          <div className="flex-buttons">
            <button onClick={() => setStep(1)} className="btn-back">
              <ArrowLeft size={18} /> Retour
            </button>
            <button onClick={goToStep3} className="btn-next">
              Continuer <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : Enveloppes d'épargne ── */}
      {step === 3 && (
        <div className="glass-card setup-card">
          <h2>Mes Enveloppes d'Épargne</h2>
          <p className="setup-subtitle">Crée des enveloppes pour organiser ton épargne par projet ou horizon.</p>

          <div className="setup-section">
            {comptes.map((c, i) => (
              <div key={i} className="account-form-block">
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Nom (ex : Vacances)"
                    value={c.nom}
                    onChange={(e) => updateRow('compte', i, 'nom', e.target.value)}
                    className="wide-input"
                  />
                  {comptes.length > 1 && (
                    <button onClick={() => removeRow('compte', i)} className="btn-delete">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <div className="form-grid-3">
                  <select
                    value={c.horizon}
                    onChange={(e) => updateRow('compte', i, 'horizon', e.target.value)}
                  >
                    <option value="court_terme">Court terme</option>
                    <option value="long_terme">Long terme</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Solde (€)"
                    value={c.montant_actuel}
                    onChange={(e) => updateRow('compte', i, 'montant_actuel', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Objectif (€)"
                    value={c.objectif_total}
                    onChange={(e) => updateRow('compte', i, 'objectif_total', e.target.value)}
                  />
                </div>
              </div>
            ))}
            <button onClick={() => addRow('compte')} className="btn-add">
              <Plus size={16} /> Ajouter une enveloppe
            </button>
          </div>

          <div className="flex-buttons">
            <button onClick={() => setStep(2)} className="btn-back">
              <ArrowLeft size={18} /> Retour
            </button>
            <button onClick={goToStep4} className="btn-next">
              Continuer <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 : Épargne forcée ── */}
      {step === 4 && (
        <div className="glass-card setup-card">
          <h2>Épargne Forcée</h2>
          <p className="setup-subtitle">
            Définis combien tu veux virer automatiquement vers chaque enveloppe à chaque début de mois.
            Tu pourras rattacher les comptes source plus tard.
          </p>

          <div className="setup-section">
            {comptes.filter(c => c.nom.trim()).map((c, i) => (
              <div key={i} className="form-row-between">
                <span>{c.nom}</span>
                <input
                  type="number"
                  placeholder="0 € / mois"
                  value={epargnesForcees[i] || ''}
                  onChange={(e) => setEpargnesForcees({ ...epargnesForcees, [i]: e.target.value })}
                  className="narrow-input"
                />
              </div>
            ))}
            {comptes.filter(c => c.nom.trim()).length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textAlign: 'center' }}>
                Aucune enveloppe nommée à l'étape précédente.
              </p>
            )}
          </div>

          <div className="flex-buttons">
            <button onClick={() => setStep(3)} className="btn-back">
              <ArrowLeft size={18} /> Retour
            </button>
            <button onClick={handleSubmit} className="btn-submit" disabled={loading}>
              {loading
                ? <Loader2 className="spinner" size={18} />
                : <><Check size={18} /> Finaliser</>
              }
            </button>
          </div>
        </div>
      )}

    </div>
  )
}