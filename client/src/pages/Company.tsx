import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Company as CompanyType, CompanyContact } from '../types';

function CompanyContacts({ company, canEdit }: { company: CompanyType; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['company'] });

  function resetForm() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setMobile('');
    setEditingId(null);
    setShowForm(false);
  }

  const createContact = useMutation({
    mutationFn: async () =>
      (
        await api.post('/company-contacts', {
          companyId: company.id,
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          mobile: mobile || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateContact = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/company-contacts/${editingId}`, {
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          mobile: mobile || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => api.delete(`/company-contacts/${id}`),
    onSuccess: invalidate,
  });

  function startEdit(contact: CompanyContact) {
    setEditingId(contact.id);
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setEmail(contact.email ?? '');
    setPhone(contact.phone ?? '');
    setMobile(contact.mobile ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    if (editingId) updateContact.mutate();
    else createContact.mutate();
  }

  const contacts = company.contacts ?? [];

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Contacts</h2>

      {contacts.length === 0 && !showForm && (
        <p className="text-sm text-slate-400">Aucun contact pour l'instant.</p>
      )}

      {contacts.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">
                  {contact.firstName} {contact.lastName}
                </span>
                <div className="text-xs text-slate-500">
                  {[contact.email, contact.phone, contact.mobile].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => startEdit(contact)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteContact.mutate(contact.id)}
                    disabled={deleteContact.isPending}
                    className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              + Ajouter un contact
            </button>
          )}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-5"
            >
              <input
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Téléphone"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Mobile"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <div className="flex gap-2 sm:col-span-5">
                <button
                  type="submit"
                  disabled={createContact.isPending || updateContact.isPending}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function Company() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [siren, setSiren] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<CompanyType | null>('/company')).data,
  });

  useEffect(() => {
    if (company) {
      setName(company.name);
      setLegalForm(company.legalForm ?? '');
      setSiren(company.siren ?? '');
      setSiret(company.siret ?? '');
      setVatNumber(company.vatNumber ?? '');
      setAddress(company.address ?? '');
      setIban(company.iban ?? '');
      setBic(company.bic ?? '');
    }
  }, [company]);

  const createCompany = useMutation({
    mutationFn: async () =>
      (
        await api.post('/company', {
          name,
          legalForm: legalForm || undefined,
          siren: siren || undefined,
          siret: siret || undefined,
          vatNumber: vatNumber || undefined,
          address: address || undefined,
          iban: iban || undefined,
          bic: bic || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setError(null);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'Erreur lors de la création');
    },
  });

  const updateCompany = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/company/${company?.id}`, {
          name,
          legalForm: legalForm || undefined,
          siren: siren || undefined,
          siret: siret || undefined,
          vatNumber: vatNumber || undefined,
          address: address || undefined,
          iban: iban || undefined,
          bic: bic || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setError(null);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'Erreur lors de la modification');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    if (company) updateCompany.mutate();
    else createCompany.mutate();
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">Chargement...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Ma société</h1>
        <p className="mt-1 text-sm text-slate-500">
          {company
            ? 'Informations de votre société, utilisées sur les documents générés (factures, CRA...).'
            : "Configure ta société : c'est la première étape avant de créer un client, un projet ou autre chose."}
        </p>
      </div>

      {!company && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Aucune société configurée pour l'instant. Tant que ce formulaire n'est pas rempli, la création
          de clients, projets, etc. est bloquée.
        </p>
      )}

      {!canEdit && !company && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">
          Seul un administrateur peut configurer la société.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <input
          autoFocus
          disabled={!canEdit}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Raison sociale"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 sm:col-span-2"
        />
        <input
          disabled={!canEdit}
          value={legalForm}
          onChange={(e) => setLegalForm(e.target.value)}
          placeholder="Forme juridique (ex: SAS)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={siren}
          onChange={(e) => setSiren(e.target.value)}
          placeholder="SIREN"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={siret}
          onChange={(e) => setSiret(e.target.value)}
          placeholder="SIRET"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          placeholder="Numéro de TVA"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IBAN"
          title="Utilisé dans le bloc « Informations de paiement » des factures PDF"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <input
          disabled={!canEdit}
          value={bic}
          onChange={(e) => setBic(e.target.value)}
          placeholder="BIC"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
        />
        {canEdit && (
          <button
            type="submit"
            disabled={createCompany.isPending || updateCompany.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-2"
          >
            {company ? 'Enregistrer les modifications' : 'Créer ma société'}
          </button>
        )}
        {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
      </form>

      {company && <CompanyContacts company={company} canEdit={canEdit} />}
    </div>
  );
}
