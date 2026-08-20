import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Role, UserSummary } from '../types';

const ROLE_LABELS: Record<Role, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    CONSULTANT: 'Consultant',
};

export function Team() {
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const canManage = currentUser?.role === 'ADMIN';
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState<Role>('CONSULTANT');
    const [profile, setProfile] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => (await api.get<UserSummary[]>('/users')).data,
    });

    function resetForm() {
        setEditingId(null);
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setRole('CONSULTANT');
        setProfile('');
        setShowForm(false);
        setError(null);
    }

    const createUser = useMutation({
        mutationFn: async () =>
            (
                await api.post('/users', {
                    email,
                    password,
                    firstName,
                    lastName,
                    role,
                    profile: profile || undefined,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            resetForm();
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setError(err.response?.data?.error ?? 'Erreur lors de la création');
        },
    });

    const updateUser = useMutation({
        mutationFn: async () =>
            (
                await api.patch(`/users/${editingId}`, {
                    email,
                    firstName,
                    lastName,
                    role,
                    profile: profile || undefined,
                    // Mot de passe laissé vide = inchangé. S'il est renseigné, un email de
                    // notification est envoyé automatiquement au titulaire du compte.
                    password: password || undefined,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            resetForm();
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setError(err.response?.data?.error ?? 'Erreur lors de la modification');
        },
    });

    const deleteUser = useMutation({
        mutationFn: async (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    });

    function startEdit(u: UserSummary) {
        setEditingId(u.id);
        setEmail(u.email);
        setPassword('');
        setFirstName(u.firstName);
        setLastName(u.lastName);
        setRole(u.role);
        setProfile(u.profile ?? '');
        setError(null);
        setShowForm(true);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        if (editingId) {
            if (email && firstName && lastName) updateUser.mutate();
        } else if (email && password && firstName && lastName) {
            createUser.mutate();
        }
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Équipe</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Comptes utilisateurs (consultants, managers, admins)
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={() => (showForm ? resetForm() : setShowForm(true))}
                        className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                        {showForm ? 'Annuler' : '+ Nouveau membre'}
                    </button>
                )}
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5"
                >
                    <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Prénom"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Nom"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingId ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe (8+ car.)'}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <input
                        value={profile}
                        onChange={(e) => setProfile(e.target.value)}
                        placeholder="Profil (ex: Développeur Full Stack Senior)"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
                    />
                    {editingId && (
                        <p className="text-xs text-slate-500 sm:col-span-5">
                            Laisse le mot de passe vide pour ne pas le changer. S'il est renseigné, un email de
                            notification sera envoyé au titulaire du compte.
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={createUser.isPending || updateUser.isPending}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-5"
                    >
                        {editingId ? 'Enregistrer les modifications' : 'Créer le compte'}
                    </button>
                    {error && <p className="text-xs text-red-600 sm:col-span-5">{error}</p>}
                </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                        <th className="px-5 py-3 font-medium">Nom</th>
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Rôle</th>
                        <th className="px-5 py-3 font-medium">Profil</th>
                        <th className="px-5 py-3 font-medium">Affectations</th>
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
                    {users?.map((u) => (
                        <tr key={u.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-medium text-slate-900">
                                {u.firstName} {u.lastName}
                            </td>
                            <td className="px-5 py-3 text-slate-600">{u.email}</td>
                            <td className="px-5 py-3 text-slate-500">{ROLE_LABELS[u.role]}</td>
                            <td className="px-5 py-3 text-slate-500">{u.profile ?? '—'}</td>
                            <td className="px-5 py-3 text-slate-500">{u._count?.assignments ?? 0}</td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                {canManage && (
                                    <button
                                        onClick={() => startEdit(u)}
                                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                                    >
                                        Modifier
                                    </button>
                                )}
                                {canManage && <span className="mx-2 text-slate-300">|</span>}
                                {canManage && (
                                    <button
                                        onClick={() => deleteUser.mutate(u.id)}
                                        className="text-xs font-medium text-red-600 hover:text-red-700"
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
