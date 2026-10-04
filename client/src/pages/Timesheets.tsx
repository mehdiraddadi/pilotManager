import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../services/api';
import { AbsenceRequestModal, type AbsenceRequestData } from '../components/AbsenceRequestModal';
import type { Assignment, TimeEntry, TimeEntryType, TimesheetStatus, TimesheetSummary, UserSummary } from '../types';

const DOW_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // index = date.getDay()

const ABSENCE_TYPES: { value: TimeEntryType; label: string; short: string; dot: string }[] = [
    { value: 'INTERNE', label: 'Activité interne', short: 'INT', dot: 'bg-purple-500' },
    { value: 'RTT', label: 'RTT', short: 'RTT', dot: 'bg-amber-500' },
    { value: 'CP', label: 'Congés payés', short: 'CP', dot: 'bg-blue-500' },
    { value: 'MALADIE', label: 'Maladie', short: 'MAL', dot: 'bg-red-500' },
    { value: 'AUTRE', label: 'Autre absence', short: 'AUT', dot: 'bg-slate-500' },
];

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dimanche de Pâques (algorithme de Gauss/Meeus), point de départ des jours fériés mobiles.
function easterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monthNum = Math.floor((h + l - 7 * m + 114) / 31);
    const dayNum = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, monthNum - 1, dayNum);
}

function addDays(date: Date, n: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + n);
    return result;
}

// Jours fériés français (métropole) pour une année donnée : date -> libellé.
function frenchHolidays(year: number): Map<string, string> {
    const easter = easterSunday(year);
    const holidays: [Date, string][] = [
        [new Date(year, 0, 1), "Jour de l'an"],
        [addDays(easter, 1), 'Lundi de Pâques'],
        [new Date(year, 4, 1), 'Fête du travail'],
        [new Date(year, 4, 8), 'Victoire 1945'],
        [addDays(easter, 39), 'Ascension'],
        [addDays(easter, 50), 'Lundi de Pentecôte'],
        [new Date(year, 6, 14), 'Fête nationale'],
        [new Date(year, 7, 15), 'Assomption'],
        [new Date(year, 10, 1), 'Toussaint'],
        [new Date(year, 10, 11), 'Armistice'],
        [new Date(year, 11, 25), 'Noël'],
    ];
    return new Map(holidays.map(([date, label]) => [formatDateStr(date), label]));
}

function getMonthDays(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidays = frenchHolidays(year);
    return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(year, month - 1, day);
        const dow = date.getDay();
        const dateStr = formatDateStr(date);
        return {
            day,
            dateStr,
            dowLetter: DOW_LETTERS[dow],
            isWeekend: dow === 0 || dow === 6,
            isHoliday: holidays.has(dateStr),
            holidayLabel: holidays.get(dateStr),
        };
    });
}

function monthLabel(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// Liste des jours ouvres (lun-ven) entre deux dates incluses.
function weekdaysBetween(startStr: string, endStr: string): string[] {
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const days: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) days.push(formatDateStr(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

// Cliquer une cellule fait tourner sa valeur : vide -> 1 jour -> 0,5 jour -> vide.
function nextQuantity(current?: number): number | undefined {
    if (current === undefined) return 1;
    if (current === 1) return 0.5;
    return undefined;
}

const STATUS_BADGE: Record<TimesheetStatus, { label: string; className: string } | null> = {
    DRAFT: null,
    VALIDATED: { label: 'Validé', className: 'bg-teal-100 text-teal-700' },
    REJECTED: { label: 'Rejeté - a corriger', className: 'bg-red-100 text-red-700' },
};

export function Timesheets() {
    const queryClient = useQueryClient();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [month, setMonth] = useState(currentMonth());
    const [comment, setComment] = useState('');
    const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [craError, setCraError] = useState<string | null>(null);

    const days = useMemo(() => getMonthDays(month), [month]);
    const joursOuvres = days.filter((d) => !d.isWeekend && !d.isHoliday).length;

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: async () => (await api.get<UserSummary[]>('/users')).data,
    });

    const consultants = useMemo(() => users?.filter((u) => u.role === 'CONSULTANT') ?? [], [users]);

    useEffect(() => {
        if (!selectedUserId && consultants.length > 0) {
            setSelectedUserId(consultants[0].id);
        }
    }, [consultants, selectedUserId]);

    const { data: assignments } = useQuery({
        queryKey: ['assignments', selectedUserId],
        queryFn: async () =>
            (await api.get<Assignment[]>('/assignments', { params: { userId: selectedUserId } })).data,
        enabled: !!selectedUserId,
    });

    const { data: entries } = useQuery({
        queryKey: ['timesheets', selectedUserId, month],
        queryFn: async () =>
            (await api.get<TimeEntry[]>('/timesheets', { params: { userId: selectedUserId, month } })).data,
        enabled: !!selectedUserId,
    });

    const { data: summary } = useQuery({
        queryKey: ['timesheet-summary', selectedUserId, month],
        queryFn: async () =>
            (await api.get<TimesheetSummary>('/timesheets/summary', { params: { userId: selectedUserId, month } })).data,
        enabled: !!selectedUserId,
    });

    // Ne resynchronise le commentaire local que lors d'un changement de consultant/mois,
    // pour ne pas ecraser une saisie en cours lors d'un refetch en arriere-plan.
    useEffect(() => {
        setComment(summary?.comment ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUserId, month]);

    const saveEntry = useMutation({
        mutationFn: async (payload: { assignmentId: string; date: string; type: TimeEntryType; quantity: number }) =>
            (await api.post('/timesheets', payload)).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timesheets', selectedUserId, month] }),
    });

    const deleteEntry = useMutation({
        mutationFn: async (id: string) => api.delete(`/timesheets/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timesheets', selectedUserId, month] }),
    });

    const saveSummary = useMutation({
        mutationFn: async (payload: { comment?: string; status?: TimesheetStatus }) =>
            (await api.patch('/timesheets/summary', { userId: selectedUserId, month, ...payload })).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timesheet-summary', selectedUserId, month] }),
    });

    const primaryAssignmentId = assignments?.[0]?.id;
    const primaryIntermediary = assignments?.[0]?.project?.intermediary;

    const createAbsenceRange = useMutation({
        mutationFn: async (data: AbsenceRequestData) => {
            if (!primaryAssignmentId) throw new Error('Aucune affectation disponible pour ce consultant');
            const dates = weekdaysBetween(data.startDate, data.endDate);
            const quantity = data.halfDay && dates.length === 1 ? 0.5 : 1;
            await Promise.all(
                dates.map((dateStr) =>
                    api.post('/timesheets', {
                        assignmentId: primaryAssignmentId,
                        date: dateStr,
                        type: data.type,
                        quantity,
                    })
                )
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timesheets', selectedUserId, month] });
            setAbsenceModalOpen(false);
        },
    });

    const entryMap = useMemo(() => {
        const map: Record<string, Record<string, TimeEntry>> = {};
        for (const e of entries ?? []) {
            const dateStr = e.date.slice(0, 10);
            map[e.assignmentId] ??= {};
            map[e.assignmentId][dateStr] = e;
        }
        return map;
    }, [entries]);

    const usedAbsenceTypes = useMemo(() => {
        const types = new Set<TimeEntryType>();
        for (const e of entries ?? []) {
            if (e.type !== 'WORKED') types.add(e.type);
        }
        return types;
    }, [entries]);

    const absenceRowTypes = ABSENCE_TYPES.filter((t) => usedAbsenceTypes.has(t.value));

    const isLocked = summary?.status === 'VALIDATED';
    const statusBadge = summary ? STATUS_BADGE[summary.status] : null;

    function rowTotal(getValue: (dateStr: string) => number | undefined) {
        return days.reduce((sum, d) => sum + (getValue(d.dateStr) ?? 0), 0);
    }

    function handleProjectCellClick(assignmentId: string, dateStr: string) {
        if (isLocked) return;
        const existing = entryMap[assignmentId]?.[dateStr];
        if (existing && existing.type !== 'WORKED') return;
        const qty = nextQuantity(existing ? Number(existing.quantity) : undefined);
        if (qty === undefined) {
            if (existing) deleteEntry.mutate(existing.id);
        } else {
            saveEntry.mutate({ assignmentId, date: dateStr, type: 'WORKED', quantity: qty });
        }
    }

    function handleAbsenceCellClick(type: TimeEntryType, dateStr: string) {
        if (isLocked || !primaryAssignmentId) return;
        const existing = entryMap[primaryAssignmentId]?.[dateStr];
        if (existing && existing.type !== type) return;
        const qty = nextQuantity(existing ? Number(existing.quantity) : undefined);
        if (qty === undefined) {
            if (existing) deleteEntry.mutate(existing.id);
        } else {
            saveEntry.mutate({ assignmentId: primaryAssignmentId, date: dateStr, type, quantity: qty });
        }
    }

    const allEntriesByDate = useMemo(() => {
        const map: Record<string, number> = {};
        for (const e of entries ?? []) {
            const dateStr = e.date.slice(0, 10);
            map[dateStr] = (map[dateStr] ?? 0) + Number(e.quantity);
        }
        return map;
    }, [entries]);

    const totalDeclared = Object.values(allEntriesByDate).reduce((s, v) => s + v, 0);
    const progressPct = joursOuvres > 0 ? Math.round((totalDeclared / joursOuvres) * 100) : 0;

    const productionTotal = (entries ?? [])
        .filter((e) => e.type === 'WORKED')
        .reduce((s, e) => s + Number(e.quantity), 0);
    const interneTotal = (entries ?? [])
        .filter((e) => e.type === 'INTERNE')
        .reduce((s, e) => s + Number(e.quantity), 0);
    const absenceTotal = (entries ?? [])
        .filter((e) => e.type !== 'WORKED' && e.type !== 'INTERNE')
        .reduce((s, e) => s + Number(e.quantity), 0);

    const selectedUser = users?.find((u) => u.id === selectedUserId);

    async function downloadPdf(path: string, filenamePrefix: string) {
        const res = await api.get(path, {
            params: { userId: selectedUserId, month },
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenamePrefix}-${selectedUser?.lastName ?? 'consultant'}-${month}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async function handleExportPdf() {
        await downloadPdf('/timesheets/pdf', 'CRA');
    }

    const generateCra = useMutation({
        mutationFn: async () => {
            try {
                await downloadPdf('/timesheets/cra', 'CRA-personnalise');
            } catch (err) {
                const blob = (err as AxiosError<Blob>).response?.data;
                const text = blob instanceof Blob ? await blob.text() : undefined;
                const message = text ? JSON.parse(text)?.error : undefined;
                throw new Error(message ?? 'Erreur lors de la génération du CRA');
            }
        },
        onSuccess: () => setCraError(null),
        onError: (err: Error) => setCraError(err.message),
    });

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-semibold text-slate-900">
                            Feuille de temps
                            {selectedUser && ` - ${selectedUser.firstName} ${selectedUser.lastName}`}
                        </h1>
                        {statusBadge && (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 capitalize">{monthLabel(month)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    >
                        <option value="">Selectionner un consultant...</option>
                        {consultants.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.firstName} {u.lastName}
                            </option>
                        ))}
                    </select>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
                    />
                    {selectedUserId && (
                        <button
                            onClick={handleExportPdf}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            Exporter PDF
                        </button>
                    )}
                    {selectedUserId && (
                        <button
                            onClick={() => generateCra.mutate()}
                            disabled={generateCra.isPending}
                            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                            {generateCra.isPending
                                ? 'Génération...'
                                : primaryIntermediary
                                    ? "Générer CRA à l'intermédiaire"
                                    : 'Générer CRA'}
                        </button>
                    )}
                </div>
            </div>

            {craError && (
                <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {craError}
                </p>
            )}

            {!selectedUserId && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                    Choisis un consultant pour afficher et saisir sa feuille de temps.
                </p>
            )}

            {selectedUserId && (
                <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-700">Activite normale</span>
                            <button
                                onClick={() => setAbsenceModalOpen(true)}
                                disabled={isLocked || !primaryAssignmentId}
                                title={!primaryAssignmentId ? "Ce consultant n'a aucune affectation" : undefined}
                                className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                                + Ajouter une absence
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-sm text-slate-600">
                {progressPct}% - {totalDeclared} / {joursOuvres} jours ouvres
              </span>
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-40">
                                <div
                                    className="h-full rounded-full bg-teal-500 transition-all"
                                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                                />
                            </div>
                            <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
                                    progressPct >= 100 ? 'bg-teal-500' : 'bg-slate-300'
                                }`}
                            >
                &#10003;
              </span>
                        </div>
                    </div>

                    <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="text-xs">
                            <thead>
                            <tr>
                                <th className="sticky left-0 z-10 min-w-[110px] border-b sm:min-w-[220px] border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500">
                                    &nbsp;
                                </th>
                                {days.map((d) => (
                                    <th
                                        key={d.dateStr}
                                        title={d.holidayLabel}
                                        className={`w-8 min-w-8 border-b lg:min-w-0 border-slate-200 py-1 text-center font-normal text-slate-400 ${
                                            d.isHoliday ? 'bg-amber-100' : d.isWeekend ? 'bg-slate-100' : ''
                                        }`}
                                    >
                                        {d.dowLetter}
                                    </th>
                                ))}
                                <th className="min-w-[60px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center font-medium text-slate-500">
                                    Total
                                </th>
                            </tr>
                            <tr>
                                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-500 sm:px-3">
                                    Activite normale
                                </th>
                                {days.map((d) => (
                                    <th
                                        key={d.dateStr}
                                        title={d.holidayLabel}
                                        className={`border-b border-slate-200 py-1 text-center text-xs font-normal text-slate-400 ${
                                            d.isHoliday ? 'bg-amber-100' : d.isWeekend ? 'bg-slate-100' : ''
                                        }`}
                                    >
                                        {d.day}
                                    </th>
                                ))}
                                <th className="border-b border-l border-slate-200 bg-slate-50" />
                            </tr>
                            </thead>
                            <tbody>
                            {assignments?.map((a) => {
                                const total = rowTotal((dateStr) => {
                                    const e = entryMap[a.id]?.[dateStr];
                                    return e && e.type === 'WORKED' ? Number(e.quantity) : undefined;
                                });
                                return (
                                    <tr key={a.id} className="border-b border-slate-100 last:border-0">
                                        <td className="sticky left-0 z-10 max-w-[140px] border-r border-slate-200 bg-white px-2 py-2 font-medium text-slate-900 sm:max-w-none sm:px-3">
                                            {a.project?.name}
                                        </td>
                                        {days.map((d) => {
                                            const e = entryMap[a.id]?.[d.dateStr];
                                            const isForeign = !!e && e.type !== 'WORKED';
                                            return (
                                                <td
                                                    key={d.dateStr}
                                                    onClick={() => !isForeign && handleProjectCellClick(a.id, d.dateStr)}
                                                    className={`h-9 select-none text-center align-middle ${
                                                        d.isHoliday ? 'bg-amber-50' : d.isWeekend ? 'bg-slate-100' : ''
                                                    } ${isLocked || isForeign ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-teal-50'}`}
                                                    title={isForeign ? ABSENCE_TYPES.find((t) => t.value === e!.type)?.label : d.holidayLabel}
                                                >
                                                    {e && e.type === 'WORKED' && (
                                                        <span className="inline-block rounded bg-teal-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                {Number(e.quantity) === 1 ? '1' : '½'}
                              </span>
                                                    )}
                                                    {!e && d.isHoliday && <span className="text-[10px] text-amber-600">0</span>}
                                                </td>
                                            );
                                        })}
                                        <td className="border-l border-slate-200 text-center font-medium text-slate-900">
                                            {total} j
                                        </td>
                                    </tr>
                                );
                            })}
                            {!assignments?.length && (
                                <tr>
                                    <td colSpan={days.length + 2} className="px-3 py-4 text-center text-slate-400">
                                        Aucune affectation pour ce consultant.
                                    </td>
                                </tr>
                            )}

                            {absenceRowTypes.length > 0 && (
                                <tr>
                                    <td
                                        colSpan={days.length + 2}
                                        className="sticky left-0 border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500"
                                    >
                                        Absences
                                    </td>
                                </tr>
                            )}

                            {absenceRowTypes.map((t) => {
                                const total = rowTotal((dateStr) => {
                                    if (!primaryAssignmentId) return undefined;
                                    const e = entryMap[primaryAssignmentId]?.[dateStr];
                                    return e && e.type === t.value ? Number(e.quantity) : undefined;
                                });
                                return (
                                    <tr key={t.value} className="border-b border-slate-100 last:border-0">
                                        <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-2 py-2 text-slate-700 sm:px-3">
                                            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${t.dot}`} />
                                            {t.label}
                                        </td>
                                        {days.map((d) => {
                                            const e = primaryAssignmentId ? entryMap[primaryAssignmentId]?.[d.dateStr] : undefined;
                                            const isMine = !!e && e.type === t.value;
                                            const isForeign = !!e && e.type !== t.value;
                                            return (
                                                <td
                                                    key={d.dateStr}
                                                    onClick={() => !isForeign && handleAbsenceCellClick(t.value, d.dateStr)}
                                                    className={`h-9 select-none text-center align-middle ${
                                                        d.isHoliday ? 'bg-amber-50' : d.isWeekend ? 'bg-slate-100' : ''
                                                    } ${isLocked || isForeign ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-teal-50'}`}
                                                >
                                                    {isMine && (
                                                        <span className="text-[10px] font-medium text-slate-600">
                                {Number(e!.quantity) === 1 ? t.short : '½'}
                              </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="border-l border-slate-200 text-center font-medium text-slate-900">
                                            {total} j
                                        </td>
                                    </tr>
                                );
                            })}

                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                                <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-2 py-2 font-medium text-slate-600 sm:px-3">
                                    TOTAL
                                </td>
                                {days.map((d) => (
                                    <td
                                        key={d.dateStr}
                                        title={d.holidayLabel}
                                        className={`text-center text-slate-500 ${d.isHoliday ? 'bg-amber-100' : d.isWeekend ? 'bg-slate-100' : ''}`}
                                    >
                                        {allEntriesByDate[d.dateStr] || (d.isHoliday ? '0' : '')}
                                    </td>
                                ))}
                                <td className="border-l border-slate-200 text-center font-semibold text-slate-900">
                                    {totalDeclared} j
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="bg-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white">
                                Production
                            </div>
                            <div className="px-4 py-3 text-sm text-slate-600">
                                {assignments?.map((a) => (
                                    <div key={a.id} className="flex justify-between py-0.5">
                                        <span>{a.project?.name}</span>
                                    </div>
                                ))}
                                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                                    <span>TOTAL</span>
                                    <span>{productionTotal} j</span>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="bg-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white">
                                Absence
                            </div>
                            <div className="px-4 py-3 text-sm text-slate-600">
                                {absenceRowTypes
                                    .filter((t) => t.value !== 'INTERNE')
                                    .map((t) => {
                                        const total = rowTotal((dateStr) => {
                                            if (!primaryAssignmentId) return undefined;
                                            const e = entryMap[primaryAssignmentId]?.[dateStr];
                                            return e && e.type === t.value ? Number(e.quantity) : undefined;
                                        });
                                        if (total === 0) return null;
                                        return (
                                            <div key={t.value} className="flex justify-between py-0.5">
                                                <span>{t.label}</span>
                                                <span>{total} j</span>
                                            </div>
                                        );
                                    })}
                                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                                    <span>TOTAL</span>
                                    <span>{absenceTotal} j</span>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="bg-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white">
                                Interne
                            </div>
                            <div className="px-4 py-3 text-sm text-slate-600">
                                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                                    <span>TOTAL</span>
                                    <span>{interneTotal} j</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="mb-2 text-sm font-medium text-slate-700">Commentaires</p>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            disabled={isLocked}
                            placeholder="Redigez vos commentaires..."
                            rows={3}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400 text-slate-900 placeholder:text-slate-400"
                        />

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                            {summary?.status !== 'DRAFT' && (
                                <button
                                    onClick={() => saveSummary.mutate({ status: 'DRAFT' })}
                                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    Rouvrir
                                </button>
                            )}
                            <button
                                onClick={() => saveSummary.mutate({ comment })}
                                disabled={isLocked || saveSummary.isPending}
                                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                            >
                                Enregistrer
                            </button>
                            <button
                                onClick={() => saveSummary.mutate({ comment, status: 'VALIDATED' })}
                                disabled={isLocked || saveSummary.isPending}
                                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                            >
                                Valider
                            </button>
                        </div>
                    </div>
                </>
            )}

            <AbsenceRequestModal
                open={absenceModalOpen}
                onClose={() => setAbsenceModalOpen(false)}
                onSubmit={(data) => createAbsenceRange.mutate(data)}
                submitting={createAbsenceRange.isPending}
            />
        </div>
    );
}