import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Client, Intermediary, Project, ProjectContact, ProjectStatus } from '../types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PROSPECT: 'Prospect',
  EN_COURS: 'En cours',
  EN_PAUSE: 'En pause',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PROSPECT: 'bg-slate-100 text-slate-600',
  EN_COURS: 'bg-teal-100 text-teal-700',
  EN_PAUSE: 'bg-amber-100 text-amber-700',
  TERMINE: 'bg-blue-100 text-blue-700',
  ANNULE: 'bg-red-100 text-red-700',
};

function ProjectContacts({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  function resetForm() {
    setFirstName('');
    setLastName('');
    setRole('');
    setEditingId(null);
    setShowForm(false);
  }

  const createContact = useMutation({
    mutationFn: async () =>
      (
        await api.post('/project-contacts', {
          projectId: project.id,
          firstName,
          lastName,
          role: role || undefined,
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
        await api.patch(`/project-contacts/${editingId}`, {
          firstName,
          lastName,
          role: role || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => api.delete(`/project-contacts/${id}`),
    onSuccess: invalidate,
  });

  function startEdit(contact: ProjectContact) {
    setEditingId(contact.id);
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setRole(contact.role ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    if (editingId) updateContact.mutate();
    else createContact.mutate();
  }

  const contacts = project.contacts ?? [];

  return (
    <div className="space-y-3 bg-slate-50 px-5 py-4">
      {contacts.length === 0 && !showForm && (
        <p className="text-sm text-slate-400">Aucun contact pour ce projet.</p>
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
              className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-4"
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
              <div className="flex gap-2">
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

export function Projects() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDelete = user?.role === 'ADMIN';
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PROSPECT');
  const [dailyRate, setDailyRate] = useState('');
  const [intermediaryId, setIntermediaryId] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await api.get<Client[]>('/clients')).data,
  });

  const { data: intermediaries } = useQuery({
    queryKey: ['intermediaries'],
    queryFn: async () => (await api.get<Intermediary[]>('/intermediaries')).data,
  });

  const createProject = useMutation({
    mutationFn: async () =>
      (
        await api.post('/projects', {
          name,
          clientId,
          status,
          dailyRate: dailyRate ? Number(dailyRate) : undefined,
          intermediaryId: intermediaryId || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetForm();
    },
  });

  const updateProject = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/projects/${editingId}`, {
          name,
          clientId,
          status,
          dailyRate: dailyRate ? Number(dailyRate) : undefined,
          intermediaryId: intermediaryId || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetForm();
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setError(null);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'Erreur lors de la suppression');
    },
  });

  function resetForm() {
    setName('');
    setClientId('');
    setStatus('PROSPECT');
    setDailyRate('');
    setIntermediaryId('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setName(project.name);
    setClientId(project.clientId);
    setStatus(project.status);
    setDailyRate(project.dailyRate != null ? String(project.dailyRate) : '');
    setIntermediaryId(project.intermediaryId ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) return;
    if (editingId) updateProject.mutate();
    else createProject.mutate();
  }

  function handleDelete(id: string) {
    if (window.confirm('Supprimer ce projet ? Cette action est irréversible.')) {
      setError(null);
      deleteProject.mutate(id);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projets</h1>
          <p className="mt-1 text-sm text-slate-500">Missions en cours et prospects</p>
        </div>
        {canEdit && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {showForm ? 'Annuler' : '+ Nouveau projet'}
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
            placeholder="Nom du projet"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          />
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          >
            <option value="">Client...</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="TJM (€)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
          <select
            value={intermediaryId}
            onChange={(e) => setIntermediaryId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
          >
            <option value="">Intermédiaire (aucun)</option>
            {intermediaries?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createProject.isPending || updateProject.isPending || !clients?.length}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-4"
          >
            {editingId ? 'Enregistrer les modifications' : 'Créer le projet'}
          </button>
          {!clients?.length && (
            <p className="text-xs text-amber-600 sm:col-span-4">
              Crée d'abord un client dans l'onglet Clients.
            </p>
          )}
        </form>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Intermédiaire</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">TJM</th>
              <th className="px-5 py-3 font-medium">Staffés</th>
              <th className="px-5 py-3 font-medium">Contacts</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && projects?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  Aucun projet pour l'instant
                </td>
              </tr>
            )}
            {projects?.map((project) => (
              <Fragment key={project.id}>
                <tr className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-5 py-3 text-slate-600">{project.client?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{project.intermediary?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[project.status]}`}
                    >
                      {STATUS_LABELS[project.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {project.dailyRate ? `${project.dailyRate} €` : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{project._count?.assignments ?? 0}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() =>
                        setExpandedProjectId(expandedProjectId === project.id ? null : project.id)
                      }
                      className="text-slate-600 hover:text-teal-700"
                    >
                      {project._count?.contacts ?? 0}{' '}
                      <span className="text-xs">{expandedProjectId === project.id ? '▲' : '▼'}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <button
                        onClick={() => startEdit(project)}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                      >
                        Modifier
                      </button>
                    )}
                    {canEdit && canDelete && <span className="mx-2 text-slate-300">|</span>}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={deleteProject.isPending}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
                {expandedProjectId === project.id && (
                  <tr className="border-b border-slate-100 last:border-0">
                    <td colSpan={8} className="p-0">
                      <ProjectContacts project={project} canEdit={canEdit} />
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
