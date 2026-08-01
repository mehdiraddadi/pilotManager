import { useState, type FormEvent } from 'react';
import type { TimeEntryType } from '../types';

const ABSENCE_TYPE_OPTIONS: { value: TimeEntryType; label: string }[] = [
    { value: 'RTT', label: 'RTT' },
    { value: 'CP', label: 'Congés payés' },
    { value: 'MALADIE', label: 'Maladie' },
    { value: 'INTERNE', label: 'Activité interne' },
    { value: 'AUTRE', label: 'Autre absence' },
];

export interface AbsenceRequestData {
    type: TimeEntryType;
    startDate: string;
    endDate: string;
    halfDay: boolean;
    comment: string;
}

interface AbsenceRequestModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: AbsenceRequestData) => void;
    submitting?: boolean;
}

export function AbsenceRequestModal({ open, onClose, onSubmit, submitting }: AbsenceRequestModalProps) {
    const [type, setType] = useState<TimeEntryType>('RTT');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [halfDay, setHalfDay] = useState(false);
    const [comment, setComment] = useState('');

    if (!open) return null;

    const isSingleDay = !!startDate && startDate === endDate;

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!startDate || !endDate) return;
        onSubmit({ type, startDate, endDate, halfDay: halfDay && isSingleDay, comment });
    }

    function handleClose() {
        setType('RTT');
        setStartDate('');
        setEndDate('');
        setHalfDay(false);
        setComment('');
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-900">Nouvelle demande d'absence</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Choisis le type et la période. Seuls les jours ouvrés seront déclarés.
                </p>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Type d'absence</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as TimeEntryType)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                            {ABSENCE_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Du</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Au</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                        </div>
                    </div>

                    {isSingleDay && (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
                            Demi-journée
                        </label>
                    )}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Commentaire (optionnel)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !startDate || !endDate}
                            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                            {submitting ? 'Création...' : 'Créer la demande'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
