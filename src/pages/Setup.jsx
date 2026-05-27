import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react'
import './Setup.css'

export default function Setup({ onSetupComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [revenus, setRevenus] = useState([{ nom: 'Salaire', montant: '' }])
  const [charges, setCharges] = useState([{ nom: 'Loyer', montant: '' }])
  const [comptes, setComptes] = useState([
    { nom: 'Épargne de précaution', horizon: 'court_terme', montant_actuel: '', objectif_total: '' }
  ])
  const [epargnesForcees, setEpargnesForcees] = useState({})

  const addRow = (type) => {
    if (type === 'revenu') setRevenus([...revenus, { nom: '', montant: '' }])
    if (type === 'charge') setCharges([...charges, { nom: '', montant: '' }])
    if (type === 'compte') setComptes([...comptes, { nom: '', horizon: 'court_terme', montant_actuel: '', objectif_total: '' }])
  }

  const removeRow = (type, index) => {
    if (type === 'revenu') setRevenus(revenus.filter((_, i) => i !== index))
    if (type === 'charge') setCharges(charges.filter((_, i) => i !== index))
    if (type === 'compte') setComptes(comptes.filter((_, i) => i !== index))
  }

  const updateRow = (type, index, field, value) => {
    const updateArr = (arr, setter) => {
      const newArr = [...arr];
      newArr[index][field] = value;
      setter(newArr);
    };
    if (type === 'revenu') updateArr(revenus, setRevenus)
    if (type === 'charge') updateArr(charges, setCharges)
    if (type === 'compte') updateArr(comptes, setComptes)
  }

  const goToStep3 = () => {
    const initialForcee = {}
    comptes.forEach((_, index) => { initialForcee[index] = '' })
    setEpargnesForcees(initialForcee)
    setStep(3)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utilisateur non authentifié")

      // 1. Insertion Revenus
      const revenusData = revenus.filter(r => r.nom && r.montant).map(r => ({
        user_id: user.id, nom: r.nom, montant: parseFloat(r.montant)
      }))
      if (revenusData.length > 0) {
        const { error } = await supabase.from('revenus_fixes_modeles').insert(revenusData)
        if (error) throw new Error("Revenus: " + error.message)
      }

      // 2. Insertion Charges
      const chargesData = charges.filter(c => c.nom && c.montant).map(c => ({
        user_id: user.id, nom: c.nom, montant: parseFloat(c.montant)
      }))
      if (chargesData.length > 0) {
        const { error } = await supabase.from('charges_fixes_modeles').insert(chargesData)
        if (error) throw new Error("Charges: " + error.message)
      }

      // 3. Insertion Comptes & Épargne
      for (let i = 0; i < comptes.length; i++) {
        const c = comptes[i]
        if (!c.nom) continue

        const { data: insertedCompte, error: compteErr } = await supabase
          .from('sous_comptes_epargne')
          .insert({
            user_id: user.id,
            nom: c.nom,
            horizon: c.horizon,
            montant_actuel: parseFloat(c.montant_actuel) || 0,
            objectif_total: c.objectif_total ? parseFloat(c.objectif_total) : null
          })
          .select().single()

        if (compteErr) throw compteErr

        const montantMensuel = parseFloat(epargnesForcees[i])
        if (montantMensuel > 0 && insertedCompte) {
          const { error: forceeErr } = await supabase.from('epargne_forcee').insert({
            user_id: user.id,
            sous_compte_id: insertedCompte.id,
            montant_mensuel: montantMensuel
          })
          if (forceeErr) throw forceeErr
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

  return (
    <div className="setup-container">
      <div className="setup-progress">
        <span className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</span>
        <div className="step-line"></div>
        <span className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</span>
        <div className="step-line"></div>
        <span className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</span>
      </div>

      {step === 1 && (
        <div className="glass-card setup-card">
          <h2>Revenus & Charges fixes</h2>
          <div className="setup-section">
            <h3>Mes Revenus</h3>
            {revenus.map((r, i) => (
              <div key={i} className="form-row">
                <input type="text" placeholder="Ex: Salaire" value={r.nom} onChange={(e) => updateRow('revenu', i, 'nom', e.target.value)} />
                <input type="number" placeholder="0 €" value={r.montant} onChange={(e) => updateRow('revenu', i, 'montant', e.target.value)} />
                {revenus.length > 1 && <button onClick={() => removeRow('revenu', i)} className="btn-delete"><Trash2 size={18} /></button>}
              </div>
            ))}
            <button onClick={() => addRow('revenu')} className="btn-add"><Plus size={16} /> Ajouter un revenu</button>
          </div>
          <div className="setup-section">
            <h3>Charges Fixes</h3>
            {charges.map((c, i) => (
              <div key={i} className="form-row">
                <input type="text" placeholder="Ex: Loyer" value={c.nom} onChange={(e) => updateRow('charge', i, 'nom', e.target.value)} />
                <input type="number" placeholder="0 €" value={c.montant} onChange={(e) => updateRow('charge', i, 'montant', e.target.value)} />
                {charges.length > 1 && <button onClick={() => removeRow('charge', i)} className="btn-delete"><Trash2 size={18} /></button>}
              </div>
            ))}
            <button onClick={() => addRow('charge')} className="btn-add"><Plus size={16} /> Ajouter une charge</button>
          </div>
          <button onClick={() => setStep(2)} className="btn-next">Continuer <ArrowRight size={18} /></button>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card setup-card">
          <h2>Mes Enveloppes d'Épargne</h2>
          <div className="setup-section">
            {comptes.map((c, i) => (
              <div key={i} className="account-form-block">
                <div className="form-row">
                  <input type="text" placeholder="Nom (ex: Noël)" value={c.nom} onChange={(e) => updateRow('compte', i, 'nom', e.target.value)} className="wide-input" />
                  {comptes.length > 1 && <button onClick={() => removeRow('compte', i)} className="btn-delete"><Trash2 size={18} /></button>}
                </div>
                <div className="form-grid-3">
                  <select value={c.horizon} onChange={(e) => updateRow('compte', i, 'horizon', e.target.value)}>
                    <option value="court_terme">Court terme</option>
                    <option value="long_terme">Long terme</option>
                  </select>
                  <input type="number" placeholder="Solde (€)" value={c.montant_actuel} onChange={(e) => updateRow('compte', i, 'montant_actuel', e.target.value)} />
                  <input type="number" placeholder="Objectif (€)" value={c.objectif_total} onChange={(e) => updateRow('compte', i, 'objectif_total', e.target.value)} />
                </div>
              </div>
            ))}
            <button onClick={() => addRow('compte')} className="btn-add"><Plus size={16} /> Ajouter une enveloppe</button>
          </div>
          <div className="flex-buttons">
            <button onClick={() => setStep(1)} className="btn-back"><ArrowLeft size={18} /> Retour</button>
            <button onClick={goToStep3} className="btn-next">Continuer <ArrowRight size={18} /></button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card setup-card">
          <h2>Épargne Forcée</h2>
          <div className="setup-section">
            {comptes.map((c, i) => (
              <div key={i} className="form-row-between">
                <span>{c.nom || 'Sans nom'}</span>
                <input type="number" placeholder="0 € / mois" value={epargnesForcees[i] || ''} onChange={(e) => setEpargnesForcees({...epargnesForcees, [i]: e.target.value})} />
              </div>
            ))}
          </div>
          <div className="flex-buttons">
            <button onClick={() => setStep(2)} className="btn-back"><ArrowLeft size={18} /> Retour</button>
            <button onClick={handleSubmit} className="btn-submit" disabled={loading}>
              {loading ? <Loader2 className="spinner" size={18} /> : <><Check size={18} /> Finaliser</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}