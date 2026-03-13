// src/Tabs/hours.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Clock, Play, Pause, Square, Plus, Calendar, User, FolderOpen, Search, Filter, X, Trash2, Timer, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, CheckCircle, Info, Download, CalendarPlus, CalendarCheck, Repeat, Bell } from 'lucide-react';

const API_BASE = '/api';
type UserRole = 'admin' | 'consultant' | 'client';

const getCurrentUserRole = (): { role: UserRole; email: string; name: string; consultantId: string } => {
    try { const raw = localStorage.getItem('timely_user'); if (!raw) return { role: 'admin', email: '', name: '', consultantId: '' }; const p = JSON.parse(raw); const r = (p.role || '').toLowerCase(); return { role: (r === 'admin' || r === 'consultant' || r === 'client') ? r : 'admin', email: p.email || '', name: p.name || '', consultantId: p.consultantId || '' }; } catch { return { role: 'admin', email: '', name: '', consultantId: '' }; }
};

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch { return null; } };

interface HoursLog { logId: string; projectId: string; consultantId: string; consultantEmail?: string; date: string; hours: number; description: string; createdAt: string; }
interface Project { projectId: string; projectCode: string; projectName: string; status: string; }
interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; }
interface Appointment { id: string; consultantId: string; projectId: string; date: string; startTime: string; durationMinutes: number; status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'; title: string; notes: string; recurring: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'; recurringEndDate?: string; parentId?: string; createdAt: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const APPT_STORAGE = 'timely_appointments';

const HoursPage: React.FC = () => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? 'neu-bg-dark' : 'neu-bg-light', card: isDark ? 'neu-dark' : 'neu-light',
        flat: isDark ? 'neu-dark-flat' : 'neu-light-flat', inset: isDark ? 'neu-dark-inset' : 'neu-light-inset',
        pressed: isDark ? 'neu-dark-pressed' : 'neu-light-pressed',
        text: isDark ? 'text-white' : 'text-gray-900', secondary: isDark ? 'text-gray-300' : 'text-gray-600',
        tertiary: isDark ? 'text-gray-500' : 'text-gray-400', strong: isDark ? 'text-white' : 'text-black',
        label: isDark ? 'text-blue-400' : 'text-blue-600', link: isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500',
        badge: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
        input: isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border-gray-300 text-gray-900',
        modal: isDark ? 'bg-[#111111] border-gray-800' : 'bg-[#f0f0f0] border-gray-300',
        modalHead: isDark ? 'bg-[#111111]' : 'bg-[#f0f0f0]',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white', btnSecondary: isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        btnDanger: 'bg-red-600 hover:bg-red-500 text-white', divider: isDark ? 'border-gray-800' : 'border-gray-200',
        edgeHover: isDark ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]' : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
        edgeHoverFlat: isDark ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]' : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]',
        barBg: isDark ? 'bg-gray-800' : 'bg-gray-200',
    };

    const { role: userRole, email: currentEmail, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin'; const isConsultant = userRole === 'consultant'; const isClient = userRole === 'client';
    const canLog = isAdmin || isConsultant; const canDelete = isAdmin;

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);

    // UI state
    const [tab, setTab] = useState<'hours' | 'appointments'>('hours');
    const [showLogModal, setShowLogModal] = useState(false);
    const [showApptModal, setShowApptModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showDeleteAppt, setShowDeleteAppt] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('all');
    const [filterConsultant, setFilterConsultant] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Week nav
    const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); return d.toISOString().split('T')[0]; });

    // Timer
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSecs, setTimerSecs] = useState(0);
    const [timerProject, setTimerProject] = useState('');
    const [timerDesc, setTimerDesc] = useState('');

    // Forms
    const [logForm, setLogForm] = useState({ projectId: '', consultantId: '', date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });
    const [apptForm, setApptForm] = useState({ consultantId: '', projectId: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', durationMinutes: 60, title: '', notes: '', recurring: 'none' as string, recurringEndDate: '' });

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => { loadAllData(); }, []);
    useEffect(() => { let iv: NodeJS.Timeout; if (timerRunning) iv = setInterval(() => setTimerSecs(s => s + 1), 1000); return () => clearInterval(iv); }, [timerRunning]);
    useEffect(() => { if (isConsultant && userConsultantId) setLogForm(f => ({ ...f, consultantId: userConsultantId })); }, [isConsultant, userConsultantId]);

    const loadAllData = async () => { setRefreshing(true); await Promise.all([loadHours(), loadProjects(), loadConsultants()]); loadLocalHours(); loadAppointments(); setRefreshing(false); };
    const loadHours = async () => { const d = await safeFetch(`${API_BASE}/hours-logs`); if (d?.data) setHoursLogs(d.data); };
    const loadLocalHours = () => { try { const s = localStorage.getItem('timely_hours_logs'); if (s) { const local = JSON.parse(s); setHoursLogs(prev => { const ids = prev.map(l => l.logId); return [...prev, ...local.filter((l: HoursLog) => !ids.includes(l.logId))]; }); } } catch {} };
    const loadProjects = async () => { const d = await safeFetch(`${API_BASE}/projects`); const local = JSON.parse(localStorage.getItem('timely_projects') || '[]'); if (d?.data) setProjects([...d.data, ...local.filter((l: Project) => !d.data.find((a: Project) => a.projectId === l.projectId))]); else setProjects(local); };
    const loadConsultants = async () => { const d = await safeFetch(`${API_BASE}/consultants`); if (d?.data) setConsultants(d.data); };
    const loadAppointments = () => { try { const s = localStorage.getItem(APPT_STORAGE); if (s) setAppointments(JSON.parse(s)); } catch {} };
    const saveAppointments = (data: Appointment[]) => { localStorage.setItem(APPT_STORAGE, JSON.stringify(data)); setAppointments(data); };

    // Helpers
    const getMyId = () => userConsultantId || consultants.find(c => c.email.toLowerCase() === currentEmail.toLowerCase())?.consultantId || '';
    const getProjectName = (pid: string) => projects.find(p => p.projectId === pid)?.projectName || 'Unknown';
    const getConsultantName = (cid: string) => { const c = consultants.find(c => c.consultantId === cid); return c ? `${c.firstName} ${c.lastName}` : 'Unknown'; };
    const getConsultantFromLog = (log: HoursLog) => { if (log.consultantId) { const c = consultants.find(c => c.consultantId === log.consultantId); if (c) return `${c.firstName} ${c.lastName}`; } if (log.consultantEmail) { const c = consultants.find(c => c.email.toLowerCase() === (log.consultantEmail || '').toLowerCase()); if (c) return `${c.firstName} ${c.lastName}`; return log.consultantEmail; } return 'Unknown'; };
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtHours = (h: number) => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`; };
    const fmtTimer = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const fmtDuration = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim() : `${mins}m`;
    const getWeekDates = (start: string) => { const dates = []; const s = new Date(start); for (let i = 0; i < 7; i++) { const d = new Date(s); d.setDate(s.getDate() + i); dates.push(d.toISOString().split('T')[0]); } return dates; };
    const navWeek = (dir: 'prev' | 'next') => { const d = new Date(weekStart); d.setDate(d.getDate() + (dir === 'next' ? 7 : -7)); setWeekStart(d.toISOString().split('T')[0]); setSelectedDate(null); };

    const apptStatusColor = (s: string) => ({ scheduled: 'bg-blue-500/20 text-blue-300', in_progress: 'bg-amber-500/20 text-amber-300', completed: 'bg-emerald-500/20 text-emerald-300', cancelled: 'bg-red-500/20 text-red-300' }[s] || 'bg-gray-500/20 text-gray-300');
    const apptStatusLabel = (s: string) => ({ scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[s] || s);

    // Timer
    const startTimer = () => { if (!canLog || !timerProject) { showToast('Select a project', 'error'); return; } setTimerRunning(true); showToast('Timer started', 'info'); };
    const pauseTimer = () => { setTimerRunning(false); };
    const stopTimer = () => { if (timerSecs > 0) { const h = Math.floor(timerSecs / 3600); const m = Math.floor((timerSecs % 3600) / 60); setLogForm({ ...logForm, projectId: timerProject, consultantId: isConsultant ? getMyId() : '', hours: String(h), minutes: String(m), description: timerDesc, date: today }); setShowLogModal(true); } setTimerRunning(false); setTimerSecs(0); setTimerDesc(''); };
    const resetTimer = () => { setTimerRunning(false); setTimerSecs(0); setTimerProject(''); setTimerDesc(''); };

    // Hours CRUD
    const createLog = async () => {
        if (!canLog || !logForm.projectId || !logForm.consultantId || !logForm.date) { showToast('Fill required fields', 'error'); return; }
        const totalH = parseFloat(logForm.hours || '0') + parseFloat(logForm.minutes || '0') / 60;
        if (totalH <= 0) { showToast('Enter valid hours', 'error'); return; }
        setLoading(true);
        const consultant = consultants.find(c => c.consultantId === logForm.consultantId);
        try {
            const r = await fetch(`${API_BASE}/hours-logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: logForm.projectId, consultantId: logForm.consultantId, consultantEmail: consultant?.email || currentEmail, date: logForm.date, hours: totalH.toFixed(2), description: logForm.description, performedBy: isAdmin ? 'admin' : 'consultant' }) });
            if (!r.ok) throw new Error();
        } catch {
            const existing = JSON.parse(localStorage.getItem('timely_hours_logs') || '[]');
            existing.push({ logId: `log_${Date.now()}`, projectId: logForm.projectId, consultantId: logForm.consultantId, consultantEmail: consultant?.email || currentEmail, date: logForm.date, hours: totalH, description: logForm.description, createdAt: new Date().toISOString() });
            localStorage.setItem('timely_hours_logs', JSON.stringify(existing));
        }
        setShowLogModal(false); resetLogForm(); loadAllData(); setLoading(false); showToast('Hours logged', 'success');
    };

    const deleteLog = async (logId: string) => {
        if (!canDelete) return;
        try { const r = await fetch(`${API_BASE}/hours-logs-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logId, performedBy: 'admin' }) }); if (!r.ok) throw new Error(); } catch { const existing = JSON.parse(localStorage.getItem('timely_hours_logs') || '[]'); localStorage.setItem('timely_hours_logs', JSON.stringify(existing.filter((l: HoursLog) => l.logId !== logId))); }
        setShowDeleteConfirm(null); loadAllData(); showToast('Deleted', 'success');
    };

    const resetLogForm = () => setLogForm({ projectId: '', consultantId: isConsultant ? getMyId() : '', date: today, hours: '', minutes: '', description: '' });

    // Appointments CRUD
    const generateRecurring = (base: Omit<Appointment, 'id' | 'createdAt' | 'parentId'>): Appointment[] => {
        const appts: Appointment[] = [];
        const parentId = `appt_${Date.now()}`;
        const startDate = new Date(base.date);
        const endDate = base.recurringEndDate ? new Date(base.recurringEndDate) : new Date(startDate); endDate.setMonth(endDate.getMonth() + 3);
        let current = new Date(startDate);
        let count = 0;
        const maxCount = 52;

        while (current <= endDate && count < maxCount) {
            appts.push({ ...base, id: count === 0 ? parentId : `appt_${Date.now()}_${count}`, parentId: count === 0 ? undefined : parentId, date: current.toISOString().split('T')[0], createdAt: new Date().toISOString(), status: 'scheduled' });
            count++;
            if (base.recurring === 'daily') current.setDate(current.getDate() + 1);
            else if (base.recurring === 'weekly') current.setDate(current.getDate() + 7);
            else if (base.recurring === 'biweekly') current.setDate(current.getDate() + 14);
            else if (base.recurring === 'monthly') current.setMonth(current.getMonth() + 1);
            else break;
        }
        return appts;
    };

    const createAppointment = () => {
        if (!isAdmin) return;
        if (!apptForm.consultantId || !apptForm.projectId || !apptForm.date || !apptForm.title) { showToast('Fill required fields', 'error'); return; }
        const base = { consultantId: apptForm.consultantId, projectId: apptForm.projectId, date: apptForm.date, startTime: apptForm.startTime, durationMinutes: apptForm.durationMinutes, title: apptForm.title, notes: apptForm.notes, recurring: apptForm.recurring as Appointment['recurring'], recurringEndDate: apptForm.recurringEndDate, status: 'scheduled' as const };

        let newAppts: Appointment[];
        if (apptForm.recurring !== 'none') {
            newAppts = generateRecurring(base);
            showToast(`${newAppts.length} appointments created`, 'success');
        } else {
            newAppts = [{ ...base, id: `appt_${Date.now()}`, createdAt: new Date().toISOString() }];
            showToast('Appointment scheduled', 'success');
        }
        saveAppointments([...appointments, ...newAppts]);
        setShowApptModal(false);
        setApptForm({ consultantId: '', projectId: '', date: today, startTime: '09:00', durationMinutes: 60, title: '', notes: '', recurring: 'none', recurringEndDate: '' });
    };

    const updateApptStatus = (id: string, newStatus: Appointment['status']) => {
        if (!isAdmin) return;
        const appt = appointments.find(a => a.id === id);
        if (!appt) return;

        const updated = appointments.map(a => a.id === id ? { ...a, status: newStatus } : a);

        // Auto-log hours when completed
        if (newStatus === 'completed' && appt.status !== 'completed') {
            const totalH = appt.durationMinutes / 60;
            const consultant = consultants.find(c => c.consultantId === appt.consultantId);
            const newLog: HoursLog = { logId: `log_appt_${Date.now()}`, projectId: appt.projectId, consultantId: appt.consultantId, consultantEmail: consultant?.email || '', date: appt.date, hours: totalH, description: `Appointment: ${appt.title}`, createdAt: new Date().toISOString() };

            // Try API first
            fetch(`${API_BASE}/hours-logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newLog, hours: totalH.toFixed(2), performedBy: 'admin' }) }).catch(() => {
                const existing = JSON.parse(localStorage.getItem('timely_hours_logs') || '[]');
                existing.push(newLog);
                localStorage.setItem('timely_hours_logs', JSON.stringify(existing));
            });
            loadAllData();
            showToast(`Completed — ${fmtDuration(appt.durationMinutes)} auto-logged`, 'success');
        } else {
            showToast(`Status → ${apptStatusLabel(newStatus)}`, 'success');
        }
        saveAppointments(updated);
    };

    const deleteAppointment = (id: string) => {
        if (!isAdmin) return;
        saveAppointments(appointments.filter(a => a.id !== id));
        setShowDeleteAppt(null);
        showToast('Appointment deleted', 'success');
    };

    const deleteRecurringSeries = (parentId: string) => {
        if (!isAdmin) return;
        saveAppointments(appointments.filter(a => a.id !== parentId && a.parentId !== parentId));
        setShowDeleteAppt(null);
        showToast('Series deleted', 'success');
    };

    // Export
    const exportCSV = (data: HoursLog[], filename: string) => {
        if (!data.length) { showToast('No data', 'error'); return; }
        const rows = data.map(l => `"${fmtDate(l.date)}","${getProjectName(l.projectId)}","${getConsultantFromLog(l)}","${l.hours.toFixed(2)}","${l.description || ''}"`);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['Date,Project,Consultant,Hours,Description', ...rows].join('\n')], { type: 'text/csv' })); a.download = `${filename}.csv`; a.click();
        showToast('Exported', 'success');
    };

    // Filtered data
    const filteredLogs = useMemo(() => {
        let logs = hoursLogs;
        if (isConsultant) { const myId = getMyId(); logs = logs.filter(l => l.consultantId === myId || (l.consultantEmail?.toLowerCase() === currentEmail.toLowerCase())); }
        return logs.filter(l => {
            const matchSearch = l.description.toLowerCase().includes(searchTerm.toLowerCase()) || getProjectName(l.projectId).toLowerCase().includes(searchTerm.toLowerCase());
            const matchProject = filterProject === 'all' || l.projectId === filterProject;
            const matchConsultant = filterConsultant === 'all' || l.consultantId === filterConsultant;
            const matchDate = !selectedDate || l.date === selectedDate;
            return matchSearch && matchProject && matchConsultant && matchDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [hoursLogs, searchTerm, filterProject, filterConsultant, selectedDate, isConsultant, currentEmail, userConsultantId]);

    const filteredAppts = useMemo(() => {
        return appointments.filter(a => {
            const matchProject = filterProject === 'all' || a.projectId === filterProject;
            const matchConsultant = filterConsultant === 'all' || a.consultantId === filterConsultant;
            const matchDate = !selectedDate || a.date === selectedDate;
            return matchProject && matchConsultant && matchDate;
        }).sort((a, b) => { const d = a.date.localeCompare(b.date); return d !== 0 ? d : a.startTime.localeCompare(b.startTime); });
    }, [appointments, filterProject, filterConsultant, selectedDate]);

    // Stats
    const stats = useMemo(() => {
        const relevant = isConsultant ? filteredLogs : hoursLogs;
        const weekDates = getWeekDates(weekStart);
        const upcomingAppts = appointments.filter(a => a.date >= today && a.status === 'scheduled').length;
        return { today: relevant.filter(l => l.date === today).reduce((s, l) => s + l.hours, 0), week: relevant.filter(l => weekDates.includes(l.date)).reduce((s, l) => s + l.hours, 0), total: relevant.reduce((s, l) => s + l.hours, 0), upcoming: upcomingAppts };
    }, [hoursLogs, filteredLogs, weekStart, isConsultant, appointments]);

    // Week bars
    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
    const weekBarData = useMemo(() => {
        const relevant = isConsultant ? hoursLogs.filter(l => { const myId = getMyId(); return l.consultantId === myId || (l.consultantEmail?.toLowerCase() === currentEmail.toLowerCase()); }) : hoursLogs;
        return weekDates.map(date => ({ date, hours: relevant.filter(l => l.date === date).reduce((s, l) => s + l.hours, 0), appts: appointments.filter(a => a.date === date && a.status !== 'cancelled').length, isToday: date === today }));
    }, [weekDates, hoursLogs, appointments, isConsultant, currentEmail, userConsultantId]);
    const maxWeekH = Math.max(...weekBarData.map(d => d.hours), 1);

    // Project breakdown
    const projectBreakdown = useMemo(() => {
        const map = new Map<string, number>(); filteredLogs.forEach(l => map.set(l.projectId, (map.get(l.projectId) || 0) + l.hours));
        return Array.from(map.entries()).map(([pid, hours]) => ({ name: getProjectName(pid), hours })).sort((a, b) => b.hours - a.hours).slice(0, 5);
    }, [filteredLogs]);
    const totalBH = projectBreakdown.reduce((s, p) => s + p.hours, 0);

    if (isClient) {
        return (<div className={`${n.bg} min-h-screen ${n.text}`}><div className="max-w-3xl mx-auto px-6 py-12"><div className={`${n.card} p-6`}><div className="flex items-center gap-3 mb-3"><AlertCircle className="w-5 h-5 text-amber-500" /><h1 className={`text-lg font-semibold ${n.text}`}>Hours Tracking for Staff</h1></div><p className={n.secondary}>Your team tracks work time for your projects.</p></div></div></div>);
    }

    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            {/* Delete Modals */}
            {showDeleteConfirm && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"><div className={`${n.modal} border rounded-2xl max-w-md w-full p-6`}><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div><h3 className={`text-lg font-semibold ${n.text}`}>Delete Entry?</h3></div><div className="flex gap-3"><button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={() => deleteLog(showDeleteConfirm)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button></div></div></div>)}
            {showDeleteAppt && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"><div className={`${n.modal} border rounded-2xl max-w-md w-full p-6`}><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div><h3 className={`text-lg font-semibold ${n.text}`}>Delete Appointment?</h3></div>{appointments.find(a => a.id === showDeleteAppt)?.parentId || appointments.some(a => a.parentId === showDeleteAppt) ? (<div className="flex flex-col gap-2"><button onClick={() => deleteAppointment(showDeleteAppt)} className={`px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete This One</button><button onClick={() => deleteRecurringSeries(appointments.find(a => a.id === showDeleteAppt)?.parentId || showDeleteAppt)} className={`px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete Entire Series</button><button onClick={() => setShowDeleteAppt(null)} className={`px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button></div>) : (<div className="flex gap-3"><button onClick={() => setShowDeleteAppt(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={() => deleteAppointment(showDeleteAppt)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button></div>)}</div></div>)}

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Hours & Schedule</h1>
                        <p className={`text-sm ${n.secondary}`}>{isAdmin ? 'Track hours, schedule consultants, manage appointments' : 'Track and log your work time'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadAllData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                        {canLog && <button onClick={() => { resetLogForm(); setShowLogModal(true); }} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm`}><Plus className="w-4 h-4" />Log Hours</button>}
                        {isAdmin && <button onClick={() => setShowApptModal(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm`}><CalendarPlus className="w-4 h-4" />Schedule</button>}
                    </div>
                </div>

                {/* Tab Toggle */}
                <div className={`${n.card} p-0.5 flex rounded-xl mb-8 w-fit`}>
                    <button onClick={() => setTab('hours')} className={`px-5 py-2.5 text-sm rounded-xl transition-all ${tab === 'hours' ? n.btnPrimary : n.secondary}`}>Hours</button>
                    <button onClick={() => setTab('appointments')} className={`px-5 py-2.5 text-sm rounded-xl transition-all flex items-center gap-2 ${tab === 'appointments' ? n.btnPrimary : n.secondary}`}>Appointments {stats.upcoming > 0 && <span className="w-5 h-5 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">{stats.upcoming}</span>}</button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: isConsultant ? 'Your Today' : 'Today', value: fmtHours(stats.today), icon: Clock },
                        { label: isConsultant ? 'Your Week' : 'This Week', value: fmtHours(stats.week), icon: Calendar },
                        { label: isConsultant ? 'Your Total' : 'Total', value: fmtHours(stats.total), icon: TrendingUp },
                        { label: 'Upcoming', value: stats.upcoming, icon: CalendarCheck },
                    ].map((st, i) => (
                        <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                            <div className="flex items-center justify-between mb-1"><span className={`${n.label} text-[11px] uppercase tracking-wider`}>{st.label}</span><st.icon className={`w-4 h-4 ${n.label}`} /></div>
                            <div className={`text-2xl font-semibold ${n.strong}`}>{st.value}</div>
                        </div>
                    ))}
                </div>

                {/* Timer (hours tab only) */}
                {tab === 'hours' && canLog && (
                    <div className={`${n.card} ${n.edgeHover} p-5 mb-8 transition-all duration-200`}>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-5">
                                <div className="text-center"><div className={`text-3xl font-mono font-bold ${timerRunning ? n.label : n.text}`}>{fmtTimer(timerSecs)}</div><p className={`text-[11px] ${n.tertiary} mt-1`}>Timer</p></div>
                                <div className={`h-10 w-px ${n.divider}`} />
                                <div className="space-y-2 flex-1 max-w-sm">
                                    <select value={timerProject} onChange={e => setTimerProject(e.target.value)} disabled={timerRunning} className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm disabled:opacity-50`}><option value="">Select Project</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select>
                                    <input type="text" value={timerDesc} onChange={e => setTimerDesc(e.target.value)} placeholder="What are you working on?" className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm`} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!timerRunning ? <button onClick={startTimer} className={`w-10 h-10 ${n.flat} flex items-center justify-center text-emerald-400`}><Play className="w-5 h-5" /></button> : <button onClick={pauseTimer} className={`w-10 h-10 ${n.flat} flex items-center justify-center text-amber-400`}><Pause className="w-5 h-5" /></button>}
                                <button onClick={stopTimer} disabled={timerSecs === 0} className={`w-10 h-10 ${n.flat} flex items-center justify-center text-red-400 disabled:opacity-30`}><Square className="w-5 h-5" /></button>
                                <button onClick={resetTimer} className={`w-10 h-10 ${n.flat} flex items-center justify-center ${n.tertiary}`}><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Week Bar + Breakdown */}
                <div className="grid lg:grid-cols-3 gap-6 mb-8">
                    <div className={`lg:col-span-2 ${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => navWeek('prev')} className={`w-8 h-8 ${n.flat} flex items-center justify-center`}><ChevronLeft className="w-4 h-4" /></button>
                            <div className="text-center"><h3 className={`text-sm font-semibold ${n.text}`}>{fmtDate(weekDates[0])} — {fmtDate(weekDates[6])}</h3><p className={`text-[11px] ${n.tertiary}`}>{fmtHours(weekBarData.reduce((s, d) => s + d.hours, 0))} total</p></div>
                            <button onClick={() => navWeek('next')} className={`w-8 h-8 ${n.flat} flex items-center justify-center`}><ChevronRight className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-end gap-2 h-32">
                            {weekBarData.map((d, i) => (
                                <div key={i} onClick={() => setSelectedDate(selectedDate === d.date ? null : d.date)} className="flex-1 flex flex-col items-center gap-1 cursor-pointer group">
                                    {d.hours > 0 && <span className={`text-[10px] ${n.text} font-medium`}>{fmtHours(d.hours)}</span>}
                                    <div className={`w-full ${n.barBg} rounded-t flex-1 relative`} style={{ minHeight: '4px' }}>
                                        <div className={`absolute bottom-0 w-full rounded-t transition-all duration-300 ${selectedDate === d.date ? 'bg-blue-400' : d.isToday ? 'bg-blue-500' : 'bg-blue-500/60'} group-hover:bg-blue-400`} style={{ height: `${(d.hours / maxWeekH) * 100}%` }} />
                                    </div>
                                    <div className="text-center">
                                        <span className={`text-[10px] ${d.isToday ? n.label : selectedDate === d.date ? n.label : n.tertiary} font-medium`}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
                                        {d.appts > 0 && <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mx-auto mt-0.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {selectedDate && <p className={`text-center mt-3 text-xs ${n.label}`}>Showing: {fmtDate(selectedDate)} <button onClick={() => setSelectedDate(null)} className="ml-1 underline">Clear</button></p>}
                    </div>
                    <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                        <h3 className={`text-sm font-semibold ${n.text} mb-4 flex items-center gap-2`}><FolderOpen className={`w-4 h-4 ${n.label}`} />Breakdown</h3>
                        {projectBreakdown.length === 0 ? <p className={`text-sm ${n.tertiary} text-center py-6`}>No hours</p> : (
                            <div className="space-y-3">{projectBreakdown.map((p, i) => (<div key={i}><div className="flex items-center justify-between mb-1"><span className={`text-xs ${n.secondary} truncate flex-1`}>{p.name}</span><span className={`text-xs ${n.label} font-medium ml-2`}>{fmtHours(p.hours)}</span></div><div className={`h-1.5 ${n.barBg} rounded-full overflow-hidden`}><div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(p.hours / totalBH) * 100}%` }} /></div></div>))}</div>
                        )}
                    </div>
                </div>

                {/* Search + Filters */}
                <div className="flex gap-3 items-center mb-6">
                    <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}><Search className={`w-4 h-4 ${n.tertiary}`} /><input type="text" placeholder={tab === 'hours' ? 'Search hours...' : 'Search appointments...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} /></div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.pressed : n.flat} flex items-center justify-center`}><Filter className={`w-4 h-4 ${n.secondary}`} /></button>
                    {tab === 'hours' && <button onClick={() => exportCSV(filteredLogs, `hours_${today}`)} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><Download className={`w-4 h-4 ${n.secondary}`} /></button>}
                </div>
                {showFilters && (<div className={`${n.card} p-4 mb-6 grid grid-cols-2 gap-3`}><div><label className={`${n.label} text-[11px] block mb-1`}>Project</label><select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>{isAdmin && <div><label className={`${n.label} text-[11px] block mb-1`}>Consultant</label><select value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)} className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option>{consultants.map(c => <option key={c.consultantId} value={c.consultantId}>{c.firstName} {c.lastName}</option>)}</select></div>}</div>)}

                {/* HOURS TAB */}
                {tab === 'hours' && (
                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                        <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                            <div className={`col-span-2 text-xs ${n.label}`}>Date</div>
                            <div className={`col-span-3 text-xs ${n.label}`}>Project</div>
                            {isAdmin && <div className={`col-span-2 text-xs ${n.label}`}>Consultant</div>}
                            <div className={`${isAdmin ? 'col-span-1' : 'col-span-2'} text-xs ${n.label}`}>Hours</div>
                            <div className={`${isAdmin ? 'col-span-3' : 'col-span-4'} text-xs ${n.label}`}>Description</div>
                            <div className={`col-span-1 text-xs ${n.label} text-right`}>→</div>
                        </div>
                        {filteredLogs.length === 0 ? (
                            <div className={`${n.flat} text-center py-16`}><Clock className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`text-sm ${n.secondary}`}>{selectedDate ? `No entries for ${fmtDate(selectedDate)}` : 'No hours found'}</p></div>
                        ) : filteredLogs.map(log => (
                            <div key={log.logId} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                                <div className="col-span-2"><p className={`${n.text} text-sm font-medium`}>{fmtDate(log.date)}</p></div>
                                <div className="col-span-3 flex items-center gap-2"><FolderOpen className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.text} text-sm truncate`}>{getProjectName(log.projectId)}</span></div>
                                {isAdmin && <div className="col-span-2 flex items-center gap-2"><User className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.secondary} text-sm truncate`}>{getConsultantFromLog(log)}</span></div>}
                                <div className={`${isAdmin ? 'col-span-1' : 'col-span-2'} flex items-center`}><span className={`${n.label} font-semibold text-sm`}>{fmtHours(log.hours)}</span></div>
                                <div className={`${isAdmin ? 'col-span-3' : 'col-span-4'} flex items-center`}><p className={`${n.secondary} text-sm truncate`}>{log.description || '—'}</p></div>
                                <div className="col-span-1 flex items-center justify-end">{canDelete && <button onClick={() => setShowDeleteConfirm(log.logId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* APPOINTMENTS TAB */}
                {tab === 'appointments' && (
                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                        <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                            <div className={`col-span-2 text-xs ${n.label}`}>Date</div>
                            <div className={`col-span-1 text-xs ${n.label}`}>Time</div>
                            <div className={`col-span-2 text-xs ${n.label}`}>Consultant</div>
                            <div className={`col-span-2 text-xs ${n.label}`}>Project</div>
                            <div className={`col-span-2 text-xs ${n.label}`}>Title</div>
                            <div className={`col-span-1 text-xs ${n.label}`}>Duration</div>
                            <div className={`col-span-1 text-xs ${n.label}`}>Status</div>
                            <div className={`col-span-1 text-xs ${n.label} text-right`}>→</div>
                        </div>
                        {filteredAppts.length === 0 ? (
                            <div className={`${n.flat} text-center py-16`}><CalendarCheck className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`text-sm ${n.secondary}`}>No appointments {selectedDate ? `for ${fmtDate(selectedDate)}` : ''}</p></div>
                        ) : filteredAppts.map(appt => (
                            <div key={appt.id} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                                <div className="col-span-2 flex items-center gap-1">
                                    <p className={`${n.text} text-sm font-medium`}>{fmtDate(appt.date)}</p>
                                    {appt.recurring !== 'none' && <Repeat className="w-3 h-3 text-amber-400" />}
                                </div>
                                <div className="col-span-1"><span className={`${n.secondary} text-sm`}>{appt.startTime}</span></div>
                                <div className="col-span-2 flex items-center gap-2"><div className={`w-6 h-6 ${n.inset} rounded-full flex items-center justify-center text-[9px] font-semibold ${n.secondary}`}>{getConsultantName(appt.consultantId).split(' ').map(w => w[0]).join('')}</div><span className={`${n.text} text-sm truncate`}>{getConsultantName(appt.consultantId)}</span></div>
                                <div className="col-span-2 flex items-center gap-1"><FolderOpen className={`w-3 h-3 ${n.tertiary}`} /><span className={`${n.secondary} text-sm truncate`}>{getProjectName(appt.projectId)}</span></div>
                                <div className="col-span-2"><span className={`${n.text} text-sm truncate`}>{appt.title}</span></div>
                                <div className="col-span-1"><span className={`${n.secondary} text-sm`}>{fmtDuration(appt.durationMinutes)}</span></div>
                                <div className="col-span-1">
                                    {isAdmin && appt.status === 'scheduled' ? (
                                        <select value={appt.status} onChange={e => updateApptStatus(appt.id, e.target.value as Appointment['status'])} className={`text-[10px] px-1.5 py-0.5 rounded-lg ${apptStatusColor(appt.status)} bg-transparent border-0 focus:outline-none cursor-pointer`}>
                                            <option value="scheduled">Scheduled</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    ) : isAdmin && appt.status === 'in_progress' ? (
                                        <select value={appt.status} onChange={e => updateApptStatus(appt.id, e.target.value as Appointment['status'])} className={`text-[10px] px-1.5 py-0.5 rounded-lg ${apptStatusColor(appt.status)} bg-transparent border-0 focus:outline-none cursor-pointer`}>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    ) : (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-lg ${apptStatusColor(appt.status)}`}>{apptStatusLabel(appt.status)}</span>
                                    )}
                                </div>
                                <div className="col-span-1 flex items-center justify-end">{isAdmin && <button onClick={() => setShowDeleteAppt(appt.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Log Hours Modal */}
            {showLogModal && canLog && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}><h2 className={`text-lg font-semibold ${n.text}`}>Log Hours</h2><button onClick={() => setShowLogModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Project *</label><select value={logForm.projectId} onChange={e => setLogForm({ ...logForm, projectId: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                            {isAdmin ? (<div><label className={`${n.label} text-[11px] block mb-1`}>Consultant *</label><select value={logForm.consultantId} onChange={e => setLogForm({ ...logForm, consultantId: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option>{consultants.map(c => <option key={c.consultantId} value={c.consultantId}>{c.firstName} {c.lastName}</option>)}</select></div>) : (<div><label className={`${n.label} text-[11px] block mb-1`}>Consultant</label><div className={`px-3 py-2.5 ${n.inset} rounded-xl ${n.secondary} text-sm`}>{consultants.find(c => c.consultantId === logForm.consultantId)?.firstName || 'You'} {consultants.find(c => c.consultantId === logForm.consultantId)?.lastName || ''}</div></div>)}
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Date *</label><input type="date" value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                            <div className="grid grid-cols-2 gap-3"><div><label className={`${n.label} text-[11px] block mb-1`}>Hours</label><input type="number" min="0" max="24" value={logForm.hours} onChange={e => setLogForm({ ...logForm, hours: e.target.value })} placeholder="0" className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div><div><label className={`${n.label} text-[11px] block mb-1`}>Minutes</label><input type="number" min="0" max="59" value={logForm.minutes} onChange={e => setLogForm({ ...logForm, minutes: e.target.value })} placeholder="0" className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={3} value={logForm.description} onChange={e => setLogForm({ ...logForm, description: e.target.value })} placeholder="What did you work on?" className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none`} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => setShowLogModal(false)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={createLog} disabled={loading} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>{loading ? 'Saving...' : 'Log Hours'}</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Appointment Modal (Admin Only) */}
            {showApptModal && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}><h2 className={`text-lg font-semibold ${n.text} flex items-center gap-2`}><CalendarPlus className={`w-5 h-5 ${n.label}`} />Schedule Appointment</h2><button onClick={() => setShowApptModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Title *</label><input type="text" value={apptForm.title} onChange={e => setApptForm({ ...apptForm, title: e.target.value })} placeholder="e.g. Property Showing, Client Meeting" className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Consultant *</label><select value={apptForm.consultantId} onChange={e => setApptForm({ ...apptForm, consultantId: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option>{consultants.map(c => <option key={c.consultantId} value={c.consultantId}>{c.firstName} {c.lastName}</option>)}</select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Project *</label><select value={apptForm.projectId} onChange={e => setApptForm({ ...apptForm, projectId: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Date *</label><input type="date" value={apptForm.date} onChange={e => setApptForm({ ...apptForm, date: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Start Time</label><input type="time" value={apptForm.startTime} onChange={e => setApptForm({ ...apptForm, startTime: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Duration</label><select value={apptForm.durationMinutes} onChange={e => setApptForm({ ...apptForm, durationMinutes: parseInt(e.target.value) })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option><option value={180}>3 hours</option><option value={240}>4 hours</option><option value={480}>Full day</option></select></div>
                            </div>
                            {/* Recurring */}
                            <div className={`${n.card} p-4`}>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><Repeat className="w-3.5 h-3.5" />Recurring</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Repeat</label><select value={apptForm.recurring} onChange={e => setApptForm({ ...apptForm, recurring: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="none">No Repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Bi-Weekly</option><option value="monthly">Monthly</option></select></div>
                                    {apptForm.recurring !== 'none' && <div><label className={`${n.label} text-[11px] block mb-1`}>Until</label><input type="date" value={apptForm.recurringEndDate} onChange={e => setApptForm({ ...apptForm, recurringEndDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>}
                                </div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea rows={2} value={apptForm.notes} onChange={e => setApptForm({ ...apptForm, notes: e.target.value })} placeholder="Additional details..." className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowApptModal(false)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={createAppointment} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}><CalendarPlus className="w-4 h-4" />Schedule</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HoursPage;