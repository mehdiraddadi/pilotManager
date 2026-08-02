import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Assignment, Project, UserSummary } from '../types';

function formatDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
}

// Une date ISO ("2026-07-01T00:00:00.000Z") -> "2026-07-01" pour préremplir un <input type="date">.
function toDateInputValue(d?: string | null) {
    return d ? d.slice(0, 10) : '';
}

export function Resources() {
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [userId, setUserId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [rate, setRate] = useState('');

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: async () => (await api.get<UserSummary[]>('/users')).data,
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => (await api.get<Project[]>('/projects')).data,
    });

    const { data: assignments, isLoading } = useQuery({
        queryKey: ['assignments'],
        queryFn: async () => (await api.get<Assignment[]>('/assignments')).data,
    });

    function resetForm() {
        setEditingId(null);
        setUserId('');
        setProjectId('');
        setStartDate('');
        setEndDate('');
        setRate('');
        setShowForm(false);
    }

    const createAssignment = useMutation({
        mutationFn: async () =>
            (
                await api.post('/assignments', {
                    userId,
                    projectId,
                    startDate,
                    endDate: endDate || undefined,
                    rate: rate ? Number(rate) : undefined,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            resetForm();
        },
    });

    const updateAssignment = useMutation({
        mutationFn: async () =>
            (
                await api.patch(`/assignments/${editingId}`, {
                    userId,
                    projectId,
                    startDate,
                    endDate: endDate || undefined,
                    rate: rate ? Number(rate) : undefined,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            resetForm();
        },
    });

    const deleteAssignment = useMutation({
        mutationFn: async (id: string) => api.delete(`/assignments/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    function startEdit(a: Assignment) {
        setEditingId(a.id);
        setUserId(a.userId);
        setProjectId(a.projectId);
        setStartDate(toDateInputValue(a.startDate));
        setEndDate(toDateInputValue(a.endDate));
        setRate(a.rate != null ? String(a.rate) : '');
        setShowForm(true);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!(userId && projectId && startDate)) return;
        if (editingId) updateAssignment.mutate();
        else createAssignment.mutate();
    }

    const canCreate = !!users?.length && !!projects?.length;

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Ressources</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Consultants et staffing sur les projets
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => (showForm ? resetForm() : setShowForm(true))}
                        className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                        {showForm ? 'Annuler' : '+ Nouvelle affectation'}
                    </button>
                )}
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {users?.map((u) => (
                    <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="font-medium text-slate-900">
                            {u.firstName} {u.lastName}
                        </p>
                        {u.profile && <p className="text-xs font-medium text-teal-700">{u.profile}</p>}
                        <p className="text-xs text-slate-500">{u.email}</p>
                        <p className="mt-2 text-sm text-slate-600">
                            {u._count?.assignments ?? 0} affectation(s)
                        </p>
                    </div>
                ))}
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5"
                >
                    <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    >
                        <option value="">Consultant...</option>
                        {users?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.firstName} {u.lastName}
                            </option>
                        ))}
                    </select>
                    <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    >
                        <option value="">Projet...</option>
                        {projects?.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="Fin (optionnel)"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="TJM (€)"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={createAssignment.isPending || updateAssignment.isPending || !canCreate}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-5"
                    >
                        {editingId ? 'Enregistrer les modifications' : 'Affecter'}
                    </button>
                    {!canCreate && (
                        <p className="text-xs text-amber-600 sm:col-span-5">
                            Il faut au moins un consultant et un projet pour créer une affectation.
                        </p>
                    )}
                </form>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                        <th className="px-5 py-3 font-medium">Consultant</th>
                        <th className="px-5 py-3 font-medium">Projet</th>
                        <th className="px-5 py-3 font-medium">Client</th>
                        <th className="px-5 py-3 font-medium">Début</th>
                        <th className="px-5 py-3 font-medium">Fin</th>
                        <th className="px-5 py-3 font-medium">TJM</th>
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
                    {!isLoading && assignments?.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                                Aucune affectation pour l'instant
                            </td>
                        </tr>
                    )}
                    {assignments?.map((a) => (
                        <tr key={a.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-medium text-slate-900">
                                {a.user?.firstName} {a.user?.lastName}
                            </td>
                            <td className="px-5 py-3 text-slate-600">{a.project?.name}</td>
                            <td className="px-5 py-3 text-slate-500">{a.project?.client?.name ?? '—'}</td>
                            <td className="px-5 py-3 text-slate-500">{formatDate(a.startDate)}</td>
                            <td className="px-5 py-3 text-slate-500">{formatDate(a.endDate)}</td>
                            <td className="px-5 py-3 text-slate-500">{a.rate ? `${a.rate} €` : '—'}</td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                {canEdit && (
                                    <button
                                        onClick={() => startEdit(a)}
                                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                                    >
                                        Modifier
                                    </button>
                                )}
                                {canEdit && <span className="mx-2 text-slate-300">|</span>}
                                {canEdit && (
                                    <button
                                        onClick={() => deleteAssignment.mutate(a.id)}
                                        className="text-xs font-medium text-red-600 hover:text-red-700"
                                    >
                                        Retirer
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
