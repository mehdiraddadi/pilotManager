import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '../services/api';
import { CompanySearch } from '../components/CompanySearch';
import type { CompanySearchResult } from '../types';

type Step = 'company' | 'taken' | 'account' | 'sent';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400';

function apiErrorMessage(err: unknown, fallback: string) {
  return (axios.isAxiosError(err) && err.response?.data?.error) || fallback;
}

// Inscription en libre-service : 1) choix de l'entreprise dans l'Annuaire des Entreprises,
// 2) refus si un compte y est déjà rattaché, sinon 3) email + mot de passe, 4) confirmation par email.
export function Register() {
  const [step, setStep] = useState<Step>('company');
  const [company, setCompany] = useState<CompanySearchResult | null>(null);
  const [checkingCompany, setCheckingCompany] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCompanySelect(result: CompanySearchResult) {
    setError(null);
    setCompany(result);
    setCheckingCompany(true);
    try {
      const { data } = await api.get<{ hasAccount: boolean }>('/auth/register/company-status', {
        params: { siren: result.siren },
      });
      setStep(data.hasAccount ? 'taken' : 'account');
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de vérifier l'entreprise"));
    } finally {
      setCheckingCompany(false);
    }
  }

  async function checkEmail() {
    if (!email.includes('@')) return;
    try {
      const { data } = await api.get<{ available: boolean }>('/auth/register/email-available', {
        params: { email },
      });
      setEmailTaken(!data.available);
    } catch {
      setEmailTaken(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/register', { company, email, password, firstName, lastName });
      setStep('sent');
    } catch (err) {
      const message = apiErrorMessage(err, "Impossible de créer le compte");
      if (message.includes('email')) setEmailTaken(true);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function backToSearch() {
    setCompany(null);
    setError(null);
    setStep('company');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Créer un compte</h1>

        {step === 'company' && (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Recherchez votre entreprise dans l'Annuaire des Entreprises.
            </p>
            <CompanySearch endpoint="/auth/register/company-search" onSelect={handleCompanySelect} />
            {checkingCompany && <p className="mb-4 text-sm text-slate-500">Vérification...</p>}
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          </>
        )}

        {step === 'taken' && company && (
          <>
            <div className="mt-4 mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Un compte existe déjà pour <span className="font-medium">{company.name}</span>. Contactez
              l'administrateur de votre société pour qu'il vous crée un accès.
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={backToSearch}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Choisir une autre entreprise
              </button>
              <Link
                to="/login"
                className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-teal-700"
              >
                Se connecter
              </Link>
            </div>
          </>
        )}

        {step === 'account' && company && (
          <form onSubmit={handleSubmit}>
            <div className="mt-4 mb-6 flex items-start justify-between gap-3 rounded-md bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{company.name}</p>
                <p className="text-xs text-slate-500">
                  {[`SIREN ${company.siren}`, company.address].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" onClick={backToSearch} className="text-xs text-teal-700 hover:underline">
                Modifier
              </button>
            </div>

            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">Prénom</label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </div>
            </div>

            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTaken(false);
              }}
              onBlur={checkEmail}
              className={inputClass}
              placeholder="vous@entreprise.com"
            />
            {emailTaken ? (
              <p className="mt-1 mb-4 text-xs text-red-600">Un compte existe déjà avec cet email.</p>
            ) : (
              <div className="mb-4" />
            )}

            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mb-1 ${inputClass}`}
              placeholder="••••••••"
            />
            <p className="mb-4 text-xs text-slate-400">8 caractères minimum</p>

            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmer le mot de passe</label>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`mb-4 ${inputClass}`}
              placeholder="••••••••"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || emailTaken}
              className="w-full rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        )}

        {step === 'sent' && (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
            Un email de confirmation a été envoyé à <span className="font-medium">{email}</span>. Cliquez sur
            le lien qu'il contient pour activer votre compte.
          </div>
        )}

        {step !== 'taken' && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-teal-700 hover:underline">
              Se connecter
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
