import { Fragment, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Client, Contact } from '../types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ClientContacts({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  function resetForm() {
    setFirstName('');
    setLastName('');
    setRole('');
    setEmail('');
    setPhone('');
    setEditingId(null);
    setShowForm(false);
  }

  const createContact = useMutation({
    mutationFn: async () =>
      (
        await api.post('/contacts', {
          clientId: client.id,
          firstName,
          lastName,
          role: role || undefined,
          email: email || undefined,
          phone: phone || undefined,
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
        await api.patch(`/contacts/${editingId}`, {
          firstName,
          lastName,
          role: role || undefined,
          email: email || undefined,
          phone: phone || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: invalidate,
  });

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setRole(contact.role ?? '');
    setEmail(contact.email ?? '');
    setPhone(contact.phone ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    if (editingId) updateContact.mutate();
    else createContact.mutate();
  }

  const contacts = client.contacts ?? [];

  return (
    <div className="space-y-3 bg-slate-50 px-5 py-4">
      {contacts.length === 0 && !showForm && (
        <p className="text-sm text-slate-400">Aucun contact pour ce client.</p>
      )}
      {contacts.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">
                  {contact.firstName} {contact.lastName}
                </span>
                {contact.role && <span className="ml-2 text-slate-500">— {contact.role}</span>}
                <div className="text-xs text-slate-500">
                  {[contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
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
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
              />
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Fonction"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Téléphone"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
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

export function Clients() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDelete = user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await api.get<Client[]>('/clients')).data,
  });

  const createClient = useMutation({
    mutationFn: async () =>
      (
        await api.post('/clients', {
          name,
          siret: siret || undefined,
          vatNumber: vatNumber || undefined,
          address: address || undefined,
          logo: logo || undefined,
          vatRate: vatRate ? Number(vatRate) : undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetForm();
    },
  });

  const updateClient = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/clients/${editingId}`, {
          name,
          siret: siret || undefined,
          vatNumber: vatNumber || undefined,
          address: address || undefined,
          logo: logo || undefined,
          vatRate: vatRate ? Number(vatRate) : undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetForm();
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setError(null);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'Erreur lors de la suppression');
    },
  });

  function resetForm() {
    setName('');
    setSiret('');
    setVatNumber('');
    setAddress('');
    setLogo('');
    setVatRate('20');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setName(client.name);
    setSiret(client.siret ?? '');
    setVatNumber(client.vatNumber ?? '');
    setAddress(client.address ?? '');
    setLogo(client.logo ?? '');
    setVatRate(String(client.vatRate));
    setShowForm(true);
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setLogo(dataUrl);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) updateClient.mutate();
    else createClient.mutate();
  }

  function handleDelete(id: string) {
    if (window.confirm('Supprimer ce client ? Cette action est irréversible.')) {
      setError(null);
      deleteClient.mutate(id);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sociétés clientes et leurs contacts
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {showForm ? 'Annuler' : '+ Nouveau client'}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du client"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            placeholder="SIRET"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            placeholder="N° TVA intracommunautaire"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Adresse"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="TVA (%)"
            title="Taux de TVA par défaut appliqué aux factures de ce client"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <div className="flex items-center gap-3 sm:col-span-4">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoChange}
              className="w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
            {logo && <img src={logo} alt="Logo" className="h-10 w-10 rounded object-contain" />}
          </div>
          <button
            type="submit"
            disabled={createClient.isPending || updateClient.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-4"
          >
            {editingId ? 'Enregistrer les modifications' : 'Créer'}
          </button>
        </form>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Logo</th>
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="px-5 py-3 font-medium">TVA</th>
              <th className="px-5 py-3 font-medium">Projets</th>
              <th className="px-5 py-3 font-medium">Contacts</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && clients?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Aucun client pour l'instant
                </td>
              </tr>
            )}
            {clients?.map((client) => (
              <Fragment key={client.id}>
                <tr className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    {client.logo ? (
                      <img src={client.logo} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{client.name}</td>
                  <td className="px-5 py-3 text-slate-500">{client.vatRate}%</td>
                  <td className="px-5 py-3 text-slate-500">{client._count?.projects ?? 0}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() =>
                        setExpandedClientId(expandedClientId === client.id ? null : client.id)
                      }
                      className="text-slate-600 hover:text-teal-700"
                    >
                      {client._count?.contacts ?? 0}{' '}
                      <span className="text-xs">{expandedClientId === client.id ? '▲' : '▼'}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <button
                        onClick={() => startEdit(client)}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                      >
                        Modifier
                      </button>
                    )}
                    {canEdit && canDelete && <span className="mx-2 text-slate-300">|</span>}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(client.id)}
                        disabled={deleteClient.isPending}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
                {expandedClientId === client.id && (
                  <tr className="border-b border-slate-100 last:border-0">
                    <td colSpan={6} className="p-0">
                      <ClientContacts client={client} canEdit={canEdit} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
