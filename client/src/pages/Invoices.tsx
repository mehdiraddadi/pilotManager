import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Client, Invoice, InvoiceStatus } from '../types';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
    DRAFT: 'Brouillon',
    SENT: 'Envoyée',
    PAID: 'Payée',
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    SENT: 'bg-blue-100 text-blue-700',
    PAID: 'bg-teal-100 text-teal-700',
};

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatEuros(value: string | number) {
    return Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

// Enveloppe + silhouette (badge) : distincte de l'icône client pour ne pas confondre les deux
// destinataires d'un coup d'œil (pas seulement une différence de couleur).
function MailToConsultantIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
            <rect x="1.5" y="4.5" width="14" height="11" rx="1.5" />
            <path d="m1.5 6.5 7 5 7-5" />
            <circle cx="18.5" cy="16.5" r="4" fill="currentColor" stroke="none" />
            <circle cx="18.5" cy="15" r="1.3" fill="white" stroke="none" />
            <path d="M15.6 19.3c.5-1.4 1.6-2.2 2.9-2.2s2.4.8 2.9 2.2" stroke="white" strokeWidth={1.1} fill="none" strokeLinecap="round" />
        </svg>
    );
}

// Enveloppe + bâtiment (badge) pour le destinataire "client".
function MailToClientIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
            <rect x="1.5" y="4.5" width="14" height="11" rx="1.5" />
            <path d="m1.5 6.5 7 5 7-5" />
            <rect x="15" y="12" width="7.5" height="8.5" rx="0.8" fill="currentColor" stroke="none" />
            <rect x="16.3" y="13.3" width="1.4" height="1.4" fill="white" />
            <rect x="19.3" y="13.3" width="1.4" height="1.4" fill="white" />
            <rect x="16.3" y="16" width="1.4" height="1.4" fill="white" />
            <rect x="19.3" y="16" width="1.4" height="1.4" fill="white" />
        </svg>
    );
}

function DownloadIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
            <path d="M12 3v12" strokeLinecap="round" />
            <path d="m6.5 10.5 5.5 5.5 5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 19.5h16" strokeLinecap="round" />
        </svg>
    );
}

export function Invoices() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canDelete = user?.role === 'ADMIN';
    const [showForm, setShowForm] = useState(false);
    const [clientId, setClientId] = useState('');
    const [month, setMonth] = useState(currentMonth());
    const [vatRate, setVatRate] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const { data: clients } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => (await api.get<Client[]>('/clients')).data,
    });

    const { data: invoices, isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => (await api.get<Invoice[]>('/invoices')).data,
    });

    const { data: detail } = useQuery({
        queryKey: ['invoice', expandedId],
        queryFn: async () => (await api.get<Invoice>(`/invoices/${expandedId}`)).data,
        enabled: !!expandedId,
    });

    const generateInvoice = useMutation({
        mutationFn: async () =>
            (
                await api.post('/invoices/generate', {
                    clientId,
                    month,
                    vatRate: vatRate ? Number(vatRate) : undefined,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setShowForm(false);
            setError(null);
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setError(err.response?.data?.error ?? 'Erreur lors de la génération');
        },
    });

    function handleClientChange(id: string) {
        setClientId(id);
        const selected = clients?.find((c) => c.id === id);
        setVatRate(selected ? String(selected.vatRate) : '');
    }

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) =>
            (await api.patch(`/invoices/${id}`, { status })).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    });

    const deleteInvoice = useMutation({
        mutationFn: async (id: string) => api.delete(`/invoices/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setError(null);
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setError(err.response?.data?.error ?? 'Erreur lors de la suppression');
        },
    });

    const sendToClient = useMutation({
        mutationFn: async (id: string) => (await api.post<{ sentTo: string }>(`/invoices/${id}/send-client`)).data,
        onSuccess: (data) => {
            setError(null);
            setFeedback(`Facture envoyée au client (${data.sentTo}).`);
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setFeedback(null);
            setError(err.response?.data?.error ?? "Erreur lors de l'envoi au client");
        },
    });

    const sendToConsultant = useMutation({
        mutationFn: async (id: string) =>
            (await api.post<{ sentTo: string[] }>(`/invoices/${id}/send-consultant`)).data,
        onSuccess: (data) => {
            setError(null);
            setFeedback(`Facture envoyée au(x) consultant(s) : ${data.sentTo.join(', ')}.`);
        },
        onError: (err: AxiosError<{ error?: string }>) => {
            setFeedback(null);
            setError(err.response?.data?.error ?? "Erreur lors de l'envoi au consultant");
        },
    });

    async function handleDownloadPdf(invoice: Invoice) {
        const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `Facture-${invoice.number}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        if (clientId && month) generateInvoice.mutate();
    }

    function handleDelete(id: string) {
        if (window.confirm('Supprimer cette facture ? Cette action est irréversible.')) {
            setError(null);
            deleteInvoice.mutate(id);
        }
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Factures</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Générées à partir des jours de production déclarés au CRA (TJM × jours travaillés)
                    </p>
                </div>
                <button
                    onClick={() => setShowForm((v) => !v)}
                    className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                    + Générer une facture
                </button>
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
                >
                    <select
                        value={clientId}
                        onChange={(e) => handleClientChange(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:col-span-2 text-slate-900 placeholder:text-slate-400"
                    >
                        <option value="">Client...</option>
                        {clients?.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="TVA (%)"
                        title="Pré-rempli avec le taux par défaut du client, modifiable pour cette facture"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={generateInvoice.isPending || !clientId}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                        Générer
                    </button>
                </form>
            )}

            {error && (
                <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
            )}

            {feedback && (
                <p className="mb-4 rounded-md bg-teal-50 px-4 py-2 text-sm text-teal-700">{feedback}</p>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                        <th className="px-5 py-3 font-medium">N°</th>
                        <th className="px-5 py-3 font-medium">ID</th>
                        <th className="px-5 py-3 font-medium">Client</th>
                        <th className="px-5 py-3 font-medium">Période</th>
                        <th className="px-5 py-3 font-medium">Montant</th>
                        <th className="px-5 py-3 font-medium">Statut</th>
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
                    {!isLoading && invoices?.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                                Aucune facture pour l'instant
                            </td>
                        </tr>
                    )}
                    {invoices?.map((invoice) => (
                        <Fragment key={invoice.id}>
                            <tr className="border-b border-slate-100 last:border-0">
                                <td className="px-5 py-3 font-medium text-slate-900">{invoice.number}</td>
                                <td className="px-5 py-3 font-mono text-xs text-slate-400" title={invoice.id}>
                                    {invoice.id}
                                </td>
                                <td className="px-5 py-3 text-slate-600">{invoice.client?.name}</td>
                                <td className="px-5 py-3 text-slate-500">
                                    {new Date(invoice.periodMonth).toLocaleDateString('fr-FR', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </td>
                                <td className="px-5 py-3">
                                    <span className="font-medium text-slate-900">
                                        {formatEuros(invoice.totalWithVat)}
                                    </span>
                                    <span className="ml-1 text-xs text-slate-400">
                                        (HT {formatEuros(invoice.totalAmount)}, TVA {Number(invoice.vatRate)}%)
                                    </span>
                                </td>
                                <td className="px-5 py-3">
                                    <select
                                        value={invoice.status}
                                        onChange={(e) =>
                                            updateStatus.mutate({
                                                id: invoice.id,
                                                status: e.target.value as InvoiceStatus,
                                            })
                                        }
                                        className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                                    >
                                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                    <button
                                        onClick={() => handleDownloadPdf(invoice)}
                                        title="Télécharger la facture en PDF"
                                        className="mr-2 inline-flex align-middle text-slate-500 hover:text-slate-900"
                                    >
                                        <DownloadIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => sendToConsultant.mutate(invoice.id)}
                                        disabled={sendToConsultant.isPending}
                                        title="Envoyer la facture au(x) consultant(s)"
                                        className="mr-2 inline-flex align-middle text-slate-500 hover:text-teal-700 disabled:opacity-40"
                                    >
                                        <MailToConsultantIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => sendToClient.mutate(invoice.id)}
                                        disabled={sendToClient.isPending}
                                        title="Envoyer la facture au client"
                                        className="mr-3 inline-flex align-middle text-slate-500 hover:text-blue-700 disabled:opacity-40"
                                    >
                                        <MailToClientIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}
                                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                                    >
                                        {expandedId === invoice.id ? 'Masquer' : 'Détail'}
                                    </button>
                                    {canDelete && invoice.status === 'DRAFT' && (
                                        <>
                                            <span className="mx-2 text-slate-300">|</span>
                                            <button
                                                onClick={() => handleDelete(invoice.id)}
                                                disabled={deleteInvoice.isPending}
                                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                                            >
                                                Supprimer
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                            {expandedId === invoice.id && detail && (
                                <tr>
                                    <td colSpan={7} className="bg-slate-50 px-5 py-4">
                                        <table className="w-full text-xs">
                                            <thead className="text-slate-500">
                                            <tr>
                                                <th className="py-1 text-left font-medium">Consultant / Projet</th>
                                                <th className="py-1 text-left font-medium">Jours</th>
                                                <th className="py-1 text-left font-medium">TJM</th>
                                                <th className="py-1 text-left font-medium">Montant</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {detail.lines?.map((line) => (
                                                <tr key={line.id}>
                                                    <td className="py-1">{line.description}</td>
                                                    <td className="py-1">{line.quantity}</td>
                                                    <td className="py-1">{formatEuros(line.unitPrice)}</td>
                                                    <td className="py-1 font-medium">{formatEuros(line.amount)}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                            <tfoot className="border-t border-slate-200 text-slate-600">
                                            <tr>
                                                <td colSpan={3} className="py-1 text-right">Total HT</td>
                                                <td className="py-1 font-medium">{formatEuros(detail.totalAmount)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="py-1 text-right">
                                                    TVA ({Number(detail.vatRate)}%)
                                                </td>
                                                <td className="py-1 font-medium">{formatEuros(detail.vatAmount)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="py-1 text-right font-semibold text-slate-900">
                                                    Total TTC
                                                </td>
                                                <td className="py-1 font-semibold text-slate-900">
                                                    {formatEuros(detail.totalWithVat)}
                                                </td>
                                            </tr>
                                            </tfoot>
                                        </table>
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
