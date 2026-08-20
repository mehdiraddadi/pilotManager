import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Intermediary } from '../types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Intermediaries() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDelete = user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: intermediaries, isLoading } = useQuery({
    queryKey: ['intermediaries'],
    queryFn: async () => (await api.get<Intermediary[]>('/intermediaries')).data,
  });

  function buildPayload() {
    return {
      name,
      contactName: contactName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      logo: logo || undefined,
    };
  }

  const createIntermediary = useMutation({
    mutationFn: async () => (await api.post('/intermediaries', buildPayload())).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intermediaries'] });
      resetForm();
    },
  });

  const updateIntermediary = useMutation({
    mutationFn: async () => (await api.patch(`/intermediaries/${editingId}`, buildPayload())).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intermediaries'] });
      resetForm();
    },
  });

  const deleteIntermediary = useMutation({
    mutationFn: async (id: string) => api.delete(`/intermediaries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intermediaries'] });
      setError(null);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'Erreur lors de la suppression');
    },
  });

  function resetForm() {
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setLogo('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(intermediary: Intermediary) {
    setEditingId(intermediary.id);
    setName(intermediary.name);
    setContactName(intermediary.contactName ?? '');
    setPhone(intermediary.phone ?? '');
    setEmail(intermediary.email ?? '');
    setLogo(intermediary.logo ?? '');
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
    if (editingId) updateIntermediary.mutate();
    else createIntermediary.mutate();
  }

  function handleDelete(id: string) {
    if (window.confirm('Supprimer cet intermédiaire ? Cette action est irréversible.')) {
      setError(null);
      deleteIntermediary.mutate(id);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Intermédiaires</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sociétés de service qui s'intercalent entre un consultant et un client sur certaines missions
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {showForm ? 'Annuler' : '+ Nouvel intermédiaire'}
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
            placeholder="Nom de la société"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nom du contact"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <div className="flex items-center gap-3 sm:col-span-2">
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
            disabled={createIntermediary.isPending || updateIntermediary.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-4"
          >
            {editingId ? 'Enregistrer les modifications' : 'Créer'}
          </button>
        </form>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Logo</th>
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Téléphone</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Missions</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && intermediaries?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  Aucun intermédiaire pour l'instant
                </td>
              </tr>
            )}
            {intermediaries?.map((intermediary) => (
              <tr key={intermediary.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3">
                  {intermediary.logo ? (
                    <img src={intermediary.logo} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3 font-medium text-slate-900">{intermediary.name}</td>
                <td className="px-5 py-3 text-slate-600">{intermediary.contactName ?? '—'}</td>
                <td className="px-5 py-3 text-slate-600">{intermediary.phone ?? '—'}</td>
                <td className="px-5 py-3 text-slate-600">{intermediary.email ?? '—'}</td>
                <td className="px-5 py-3 text-slate-500">{intermediary._count?.projects ?? 0}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <button
                      onClick={() => startEdit(intermediary)}
                      className="text-xs font-medium text-teal-700 hover:text-teal-800"
                    >
                      Modifier
                    </button>
                  )}
                  {canEdit && canDelete && <span className="mx-2 text-slate-300">|</span>}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(intermediary.id)}
                      disabled={deleteIntermediary.isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
