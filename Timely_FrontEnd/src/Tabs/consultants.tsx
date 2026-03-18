// src/Tabs/consultants.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Search, Plus, Filter, ChevronRight, Phone, Users, Briefcase, Clock, X, Edit2, Trash2, User, TrendingUp, CheckCircle2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, StickyNote, FolderOpen, Link2, Unlink, UserMinus, FolderPlus, RefreshCw, Timer, Play, Pause, Save, CheckCircle, AlertCircle, Info, Mail } from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

const API_BASE = '/api';
const STORAGE_KEYS = { consultantsExtended: 'timely_consultants_extended', hoursLogs: 'timely_hours_logs' };

type UserRole = 'admin' | 'consultant' | 'client';

const fmtStatus = (s: string): string => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Active';

const getCurrentUserRole = (): { role: UserRole; email: string; customerId: string; name: string; consultantId: string } => {
    try {
        const raw = localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
        const parsed = JSON.parse(raw);
        const r = (parsed.role || '').toLowerCase();
        const role: UserRole = (r === 'admin' || r === 'consultant' || r === 'client') ? r : 'admin';
        return { role, email: parsed.email || '', customerId: parsed.customerId || '', name: parsed.name || '', consultantId: parsed.consultantId || '' };
    } catch { return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' }; }
};

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch { return null; } };

interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; tempPassword: string; role: string; phone?: string; department?: string; specialization?: string; hourlyRate?: string; startDate?: string; status?: string; notes?: string; }
interface Client { customerId: string; clientCode: string; firstName: string; lastName: string; email: string; }
interface Project { projectId: string; projectCode: string; projectName: string; status: string; }
interface HoursLog { logId: string; consultantId: string; projectId: string; date: string; hours: number; description: string; createdAt: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const ConsultantsPage = () => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? 'neu-bg-dark' : 'neu-bg-light',
        card: isDark ? 'neu-dark' : 'neu-light',
        flat: isDark ? 'neu-dark-flat' : 'neu-light-flat',
        inset: isDark ? 'neu-dark-inset' : 'neu-light-inset',
        pressed: isDark ? 'neu-dark-pressed' : 'neu-light-pressed',
        text: isDark ? 'text-white' : 'text-gray-900',
        secondary: isDark ? 'text-gray-300' : 'text-gray-600',
        tertiary: isDark ? 'text-gray-500' : 'text-gray-400',
        strong: isDark ? 'text-white' : 'text-black',
        label: isDark ? 'text-blue-400' : 'text-blue-600',
        link: isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500',
        badge: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
        input: isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border-gray-300 text-gray-900',
        modal: isDark ? 'bg-[#111111] border-gray-800' : 'bg-[#f0f0f0] border-gray-300',
        modalHead: isDark ? 'bg-[#111111]' : 'bg-[#f0f0f0]',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
        btnSecondary: isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        btnDanger: 'bg-red-600 hover:bg-red-500 text-white',
        divider: isDark ? 'border-gray-800' : 'border-gray-200',
        edgeHover: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
        edgeHoverFlat: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]',
    };

    const { role: userRole, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';
    const canCreate = isAdmin;
    const canEdit = isAdmin;
    const canDelete = isAdmin;
    const canAssign = isAdmin;
    const canLogTime = isAdmin || isConsultant;

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);

    const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showClientsModal, setShowClientsModal] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [showTimeTrackingModal, setShowTimeTrackingModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sortConfig, setSortConfig] = useState({ field: 'consultantId', direction: 'desc' as 'asc' | 'desc' });
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerProjectId, setTimerProjectId] = useState('');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const [consultantForm, setConsultantForm] = useState({ firstName: '', middleName: '', lastName: '', phone: '', department: '', specialization: '', hourlyRate: '', startDate: new Date().toISOString().split('T')[0], status: 'active' as string, notes: '' });
    const [tempPassword, setTempPassword] = useState('');
    const [timeForm, setTimeForm] = useState({ projectId: '', date: new Date().toISOString().split('T')[0], hours: 0, minutes: 0, description: '' });

    useEffect(() => {
        const unsub = AssignmentService.subscribe(() => setAssignmentRefreshKey(k => k + 1));
        const handle = () => setAssignmentRefreshKey(k => k + 1);
        window.addEventListener('assignment-change', handle);
        return () => { unsub(); window.removeEventListener('assignment-change', handle); };
    }, []);

    useEffect(() => { loadAllData(); }, []);
    useEffect(() => { if (isTimerRunning) { timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000); } else if (timerRef.current) { clearInterval(timerRef.current); } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [isTimerRunning]);

    const loadAllData = async () => { setRefreshing(true); await Promise.all([loadConsultants(), loadClients(), loadProjects()]); loadHoursLogs(); AssignmentService.syncClientConsultantsFromAPI(); setRefreshing(false); };

    const loadConsultants = async () => {
        const d = await safeFetch(`${API_BASE}/consultants`);
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
        const local = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
        if (d?.data) {
            const api = d.data.map((c: Consultant) => ({ ...c, ...ext[c.consultantId] }));
            const merged = [...api];
            local.forEach((lc: Consultant) => { if (!merged.find((c: Consultant) => c.consultantId === lc.consultantId)) merged.push({ ...lc, ...ext[lc.consultantId] }); });
            setConsultants(merged);
        } else { setConsultants(local.map((c: Consultant) => ({ ...c, ...ext[c.consultantId] }))); }
    };
    const loadClients = async () => { const d = await safeFetch(`${API_BASE}/orgs/me`); if (d?.data) setClients(d.data); };
    const loadProjects = async () => { const d = await safeFetch(`${API_BASE}/projects`); if (d?.data) { const local = JSON.parse(localStorage.getItem('timely_projects') || '[]'); setProjects([...d.data, ...local.filter((l: Project) => !d.data.find((a: Project) => a.projectId === l.projectId))]); } else { setProjects(JSON.parse(localStorage.getItem('timely_projects') || '[]')); } };
    const loadHoursLogs = () => { try { const s = localStorage.getItem(STORAGE_KEYS.hoursLogs); if (s) setHoursLogs(JSON.parse(s)); } catch {} };
    const saveHoursLogs = (data: HoursLog[]) => { localStorage.setItem(STORAGE_KEYS.hoursLogs, JSON.stringify(data)); setHoursLogs(data); };

    const companyEmail = useMemo(() => { const f = consultantForm.firstName.trim(), l = consultantForm.lastName.trim(); if (!f || !l) return ''; return `${l.replace(/\s+/g, '').toLowerCase()}${f[0].toLowerCase()}@timely.com`; }, [consultantForm.firstName, consultantForm.lastName]);
    const generatePassword = () => { const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lo = 'abcdefghijkmnopqrstuvwxyz', d = '23456789', s = '!@$%^&*?'; const pick = (x: string) => x[Math.floor(Math.random() * x.length)]; let p = pick(u) + pick(lo) + pick(d) + pick(s); while (p.length < 12) p += pick(u + lo + d + s); setTempPassword(p.split('').sort(() => Math.random() - 0.5).join('')); };

    const createConsultant = async () => {
        if (!canCreate) { showToast('No permission', 'error'); return; }
        if (!consultantForm.firstName || !consultantForm.lastName) { showToast('Name required', 'error'); return; }
        if (!tempPassword) { showToast('Generate password first', 'error'); return; }
        setLoading(true);
        try {
            const r = await fetch(`${API_BASE}/consultants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: consultantForm.firstName.trim(), lastName: consultantForm.lastName.trim(), email: companyEmail, tempPassword, role: 'consultant', performedBy: 'admin' }) });
            if (r.ok) {
                const res = await r.json();
                const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
                ext[res.consultantId] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
                localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
                showToast(`Created (${res.consultantCode})`, 'success');
                setShowCreateModal(false); resetForm(); loadConsultants();
            } else { throw new Error('Failed'); }
        } catch {
            const cid = `local_${Date.now()}`, code = `CON-${Date.now().toString().slice(-6)}`;
            const local = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
            local.push({ consultantId: cid, consultantCode: code, firstName: consultantForm.firstName.trim(), lastName: consultantForm.lastName.trim(), email: companyEmail, tempPassword, role: 'consultant', ...consultantForm });
            localStorage.setItem('timely_local_consultants', JSON.stringify(local));
            const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
            ext[cid] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
            localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
            showToast(`Created locally (${code})`, 'success');
            setShowCreateModal(false); resetForm(); loadConsultants();
        } finally { setLoading(false); }
    };

    const updateConsultant = () => {
        if (!canEdit || !selectedConsultant) return;
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
        ext[selectedConsultant.consultantId] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
        localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
        setShowEditModal(false); setShowDetailsModal(true); loadConsultants();
        showToast('Updated', 'success');
    };

    const deleteConsultant = async (cid: string) => {
        if (!canDelete) return;
        try { await fetch(`${API_BASE}/consultants-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consultantId: cid, performedBy: 'admin' }) }); } catch {}
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}'); delete ext[cid]; localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
        AssignmentService.cleanupConsultantAssignments(cid);
        saveHoursLogs(hoursLogs.filter(h => h.consultantId !== cid));
        const local = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
        localStorage.setItem('timely_local_consultants', JSON.stringify(local.filter((c: Consultant) => c.consultantId !== cid)));
        setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedConsultant(null); await loadAllData();
        showToast('Deleted', 'success');
    };

    const assignClient = async (cid: string) => { if (!canAssign || !selectedConsultant) return; const r = await AssignmentService.assignConsultantToClientViaAPI(cid, selectedConsultant.consultantId); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeClient = (cid: string) => { if (!canAssign || !selectedConsultant) return; AssignmentService.removeConsultantFromClient(cid, selectedConsultant.consultantId); showToast('Removed', 'success'); };
    const assignProject = (pid: string) => { if (!canAssign || !selectedConsultant) return; const r = AssignmentService.assignConsultantToProject(pid, selectedConsultant.consultantId); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeProject = (pid: string) => { if (!canAssign || !selectedConsultant) return; AssignmentService.removeConsultantFromProject(pid, selectedConsultant.consultantId); showToast('Removed', 'success'); };

    const getConsultantClients = (cid: string) => { const ids = AssignmentService.getClientsForConsultant(cid); return clients.filter(c => ids.includes(c.customerId)); };
    const getAvailableClients = (cid: string) => { const ids = AssignmentService.getClientsForConsultant(cid); return clients.filter(c => !ids.includes(c.customerId)); };
    const getConsultantProjects = (cid: string) => { const ids = AssignmentService.getProjectsForConsultant(cid); return projects.filter(p => ids.includes(p.projectId)); };
    const getAvailableProjects = (cid: string) => { const ids = AssignmentService.getProjectsForConsultant(cid); return projects.filter(p => !ids.includes(p.projectId)); };

    const logTime = () => {
        if (!canLogTime || !selectedConsultant || !timeForm.projectId) return;
        const totalH = timeForm.hours + timeForm.minutes / 60;
        if (totalH <= 0) { showToast('Enter time', 'error'); return; }
        saveHoursLogs([...hoursLogs, { logId: `log_${Date.now()}`, consultantId: selectedConsultant.consultantId, projectId: timeForm.projectId, date: timeForm.date, hours: totalH, description: timeForm.description, createdAt: new Date().toISOString() }]);
        setTimeForm({ projectId: '', date: new Date().toISOString().split('T')[0], hours: 0, minutes: 0, description: '' });
        showToast(`Logged ${formatHours(totalH)}`, 'success');
    };

    const deleteHoursLog = (id: string) => { if (!canLogTime) return; saveHoursLogs(hoursLogs.filter(h => h.logId !== id)); showToast('Deleted', 'success'); };
    const getConsultantHours = (cid: string) => hoursLogs.filter(h => h.consultantId === cid);
    const getProjectHours = (cid: string, pid: string) => hoursLogs.filter(h => h.consultantId === cid && h.projectId === pid).reduce((s, h) => s + h.hours, 0);
    const getTotalHours = (cid: string) => hoursLogs.filter(h => h.consultantId === cid).reduce((s, h) => s + h.hours, 0);
    const getProjectName = (pid: string) => projects.find(p => p.projectId === pid)?.projectName || 'Unknown';

    const startTimer = (pid: string) => { if (!canLogTime) return; setTimerProjectId(pid); setTimerSeconds(0); setIsTimerRunning(true); showToast('Timer started', 'info'); };
    const stopTimer = () => {
        if (!selectedConsultant || !timerProjectId) return;
        setIsTimerRunning(false);
        const hours = timerSeconds / 3600;
        if (hours >= 0.01) { saveHoursLogs([...hoursLogs, { logId: `log_${Date.now()}`, consultantId: selectedConsultant.consultantId, projectId: timerProjectId, date: new Date().toISOString().split('T')[0], hours, description: 'Timer session', createdAt: new Date().toISOString() }]); showToast(`Logged ${formatHours(hours)}`, 'success'); }
        setTimerSeconds(0); setTimerProjectId('');
    };

    const resetForm = () => { setConsultantForm({ firstName: '', middleName: '', lastName: '', phone: '', department: '', specialization: '', hourlyRate: '', startDate: new Date().toISOString().split('T')[0], status: 'active', notes: '' }); setTempPassword(''); };
    const openDetails = (c: Consultant) => { setSelectedConsultant(c); setConsultantForm({ firstName: c.firstName, middleName: '', lastName: c.lastName, phone: c.phone || '', department: c.department || '', specialization: c.specialization || '', hourlyRate: c.hourlyRate || '', startDate: c.startDate || new Date().toISOString().split('T')[0], status: c.status || 'active', notes: c.notes || '' }); setShowDetailsModal(true); };

    const filteredConsultants = useMemo(() => {
        let filtered = consultants;
        if (isConsultant && userConsultantId) filtered = consultants.filter(c => c.consultantId === userConsultantId);
        filtered = filtered.filter(c => {
            const search = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()) || (c.consultantCode || '').toLowerCase().includes(searchTerm.toLowerCase());
            const status = statusFilter === 'all' || c.status === statusFilter;
            return search && status;
        });
        filtered.sort((a, b) => {
            let aV: any, bV: any;
            switch (sortConfig.field) { case 'name': aV = `${a.firstName} ${a.lastName}`.toLowerCase(); bV = `${b.firstName} ${b.lastName}`.toLowerCase(); break; case 'status': aV = a.status || ''; bV = b.status || ''; break; default: aV = Number(a.consultantId) || 0; bV = Number(b.consultantId) || 0; }
            return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
        });
        return filtered;
    }, [consultants, userConsultantId, isConsultant, searchTerm, statusFilter, sortConfig, assignmentRefreshKey]);

    const stats = useMemo(() => {
        const rel = isConsultant && userConsultantId ? consultants.filter(c => c.consultantId === userConsultantId) : consultants;
        const relH = isConsultant && userConsultantId ? hoursLogs.filter(h => h.consultantId === userConsultantId) : hoursLogs;
        return { total: rel.length, active: rel.filter(c => c.status === 'active').length, onLeave: rel.filter(c => c.status === 'on_leave').length, totalHours: relH.reduce((s, h) => s + h.hours, 0) };
    }, [consultants, hoursLogs, userConsultantId, isConsultant]);

    const getStatusColor = (s: string) => ({ active: 'bg-emerald-600', inactive: 'bg-gray-600', on_leave: 'bg-amber-600' }[s] || 'bg-gray-600');
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
    const formatHours = (h: number) => h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`;
    const formatTimer = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; };
    const toggleSort = (f: string) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }));
    const getSortIcon = (f: string) => sortConfig.field !== f ? <ArrowUpDown className={`w-3.5 h-3.5 ${n.tertiary}`} /> : sortConfig.direction === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${n.label}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${n.label}`} />;

    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>
                        {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* Delete Confirm */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-md w-full p-6`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                            <h3 className={`text-lg font-semibold ${n.text}`}>Delete Consultant?</h3>
                        </div>
                        <p className={`${n.secondary} text-sm mb-6`}>This permanently removes the consultant, assignments, and time logs.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                            <button onClick={() => deleteConsultant(showDeleteConfirm)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Consultants</h1>
                            <p className={`text-sm ${n.secondary}`}>{isAdmin ? 'Manage team and track hours' : isConsultant ? 'Your profile and time tracking' : 'Consultant directory'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={loadAllData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                            {canCreate && <button onClick={() => setShowCreateModal(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm`}><Plus className="w-4 h-4" />Add Consultant</button>}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex gap-3 items-center mb-6">
                        <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                            <Search className={`w-4 h-4 ${n.tertiary}`} />
                            <input type="text" placeholder="Search consultants..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.pressed : n.flat} flex items-center justify-center`}><Filter className={`w-4 h-4 ${n.secondary}`} /></button>
                    </div>

                    {showFilters && (
                        <div className={`${n.card} p-4 mb-6`}>
                            <label className={`${n.label} text-[11px] block mb-1`}>Status</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: isConsultant ? 'Profile' : 'Total', value: stats.total, icon: Users },
                            { label: 'Active', value: stats.active, icon: CheckCircle2 },
                            { label: 'On Leave', value: stats.onLeave, icon: Clock },
                            { label: isConsultant ? 'Your Hours' : 'Hours Logged', value: formatHours(stats.totalHours), icon: TrendingUp },
                        ].map((st, i) => (
                            <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`${n.label} text-[11px] uppercase tracking-wider`}>{st.label}</span>
                                    <st.icon className={`w-4 h-4 ${n.label}`} />
                                </div>
                                <div className={`text-2xl font-semibold ${n.strong}`}>{st.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className={`${n.card} p-1.5 space-y-1.5`}>
                    <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                        <div className={`col-span-3 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('name')}>Consultant {getSortIcon('name')}</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Projects</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Hours</div>
                        <div className={`col-span-2 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('status')}>Status {getSortIcon('status')}</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Department</div>
                        <div className={`col-span-1 text-xs ${n.label} text-right`}>→</div>
                    </div>

                    {filteredConsultants.length === 0 ? (
                        <div className={`${n.flat} text-center py-16`}>
                            <Users className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} />
                            <p className={`text-sm ${n.secondary}`}>{isConsultant ? 'Profile not found' : 'No consultants found'}</p>
                        </div>
                    ) : filteredConsultants.map(c => (
                        <div key={c.consultantId} onClick={() => openDetails(c)} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 cursor-pointer transition-all duration-200`}>
                            <div className="col-span-3 flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full ${n.inset} flex items-center justify-center text-[10px] font-semibold ${n.secondary} flex-shrink-0`}>{c.firstName[0]}{c.lastName[0]}</div>
                                <div className="min-w-0"><p className={`${n.text} text-sm font-medium truncate`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.consultantCode}</p></div>
                            </div>
                            <div className="col-span-2 flex items-center gap-1"><FolderOpen className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.secondary} text-sm`}>{getConsultantProjects(c.consultantId).length}</span></div>
                            <div className="col-span-2 flex items-center gap-1"><Clock className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.secondary} text-sm`}>{formatHours(getTotalHours(c.consultantId))}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>{fmtStatus(c.status || 'active')}</span></div>
                            <div className="col-span-2"><span className={`${n.secondary} text-sm`}>{c.department || '—'}</span></div>
                            <div className="col-span-1 flex items-center justify-end"><ChevronRight className={`w-4 h-4 ${n.tertiary}`} /></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ MODALS ═══ */}

            {/* Create Modal */}
            {showCreateModal && canCreate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Add Consultant</h2>
                            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Personal */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><User className="w-3.5 h-3.5" />Personal</span>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>First *</label><input type="text" value={consultantForm.firstName} onChange={(e) => setConsultantForm({ ...consultantForm, firstName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Middle</label><input type="text" value={consultantForm.middleName} onChange={(e) => setConsultantForm({ ...consultantForm, middleName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Last *</label><input type="text" value={consultantForm.lastName} onChange={(e) => setConsultantForm({ ...consultantForm, lastName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                </div>
                                <div className="mt-3"><label className={`${n.label} text-[11px] block mb-1`}>Email (auto)</label><div className={`px-3 py-2.5 ${n.inset} rounded-xl ${n.secondary} text-sm`}>{companyEmail || 'Enter names...'}</div></div>
                                <div className="mt-3"><label className={`${n.label} text-[11px] block mb-1`}>Phone</label><input type="tel" value={consultantForm.phone} onChange={(e) => setConsultantForm({ ...consultantForm, phone: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            </div>
                            {/* Account */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><Briefcase className="w-3.5 h-3.5" />Account</span>
                                <label className={`${n.label} text-[11px] block mb-1`}>Temp Password *</label>
                                <div className="flex gap-2">
                                    <input type="text" value={tempPassword} readOnly placeholder="Click Generate" className={`flex-1 px-3 py-2.5 ${n.input} border rounded-xl text-sm font-mono`} />
                                    <button type="button" onClick={generatePassword} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Generate</button>
                                </div>
                            </div>
                            {/* Work Info */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><TrendingUp className="w-3.5 h-3.5" />Work Info</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Department</label><input type="text" value={consultantForm.department} onChange={(e) => setConsultantForm({ ...consultantForm, department: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Specialization</label><input type="text" value={consultantForm.specialization} onChange={(e) => setConsultantForm({ ...consultantForm, specialization: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Hourly Rate ($)</label><input type="number" value={consultantForm.hourlyRate} onChange={(e) => setConsultantForm({ ...consultantForm, hourlyRate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Start Date</label><input type="date" value={consultantForm.startDate} onChange={(e) => setConsultantForm({ ...consultantForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={consultantForm.status} onChange={(e) => setConsultantForm({ ...consultantForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select></div>
                                </div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea rows={3} value={consultantForm.notes} onChange={(e) => setConsultantForm({ ...consultantForm, notes: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={createConsultant} disabled={loading} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>{loading ? 'Creating...' : 'Create'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedConsultant && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${n.inset} rounded-full flex items-center justify-center text-sm font-semibold ${n.secondary}`}>{selectedConsultant.firstName[0]}{selectedConsultant.lastName[0]}</div>
                                <div><h2 className={`text-lg font-semibold ${n.text}`}>{selectedConsultant.firstName} {selectedConsultant.lastName}</h2><p className={`text-xs ${n.tertiary}`}>{selectedConsultant.consultantCode} · {selectedConsultant.email}</p></div>
                            </div>
                            <div className="flex items-center gap-1">
                                {canDelete && <button onClick={() => setShowDeleteConfirm(selectedConsultant.consultantId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>}
                                <button onClick={() => { setShowDetailsModal(false); setSelectedConsultant(null); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Status + Info */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>{fmtStatus(selectedConsultant.status || 'active')}</span>
                                {selectedConsultant.department && <span className={`${n.secondary} flex items-center gap-1.5 text-sm`}><Briefcase className="w-3.5 h-3.5" />{selectedConsultant.department}</span>}
                                {selectedConsultant.phone && <span className={`${n.secondary} flex items-center gap-1.5 text-sm`}><Phone className="w-3.5 h-3.5" />{selectedConsultant.phone}</span>}
                            </div>
                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Edit2 className="w-3.5 h-3.5" />Edit</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Users className="w-3.5 h-3.5" />Clients</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><FolderOpen className="w-3.5 h-3.5" />Projects</button>}
                                {canLogTime && <button onClick={() => { setShowDetailsModal(false); setShowTimeTrackingModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 text-emerald-400 transition-all`}><Clock className="w-3.5 h-3.5" />Log Time</button>}
                                {isClient && selectedConsultant.email && <a href={`mailto:${selectedConsultant.email}`} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}><Mail className="w-3.5 h-3.5" />Email</a>}
                            </div>
                            {/* Performance */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Total Hours</span><p className={`text-xl font-semibold ${n.strong} mt-1`}>{formatHours(getTotalHours(selectedConsultant.consultantId))}</p></div>
                                <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Projects</span><p className={`text-xl font-semibold ${n.strong} mt-1`}>{getConsultantProjects(selectedConsultant.consultantId).length}</p></div>
                                <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Clients</span><p className={`text-xl font-semibold ${n.strong} mt-1`}>{getConsultantClients(selectedConsultant.consultantId).length}</p></div>
                            </div>
                            {/* Projects */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Projects</span>{canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getConsultantProjects(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : (
                                    <div className="space-y-1.5">{getConsultantProjects(selectedConsultant.consultantId).map(p => (
                                        <div key={p.projectId} className={`${n.flat} px-3 py-2 flex items-center justify-between`}>
                                            <span className={`${n.text} text-sm`}>{p.projectName}</span>
                                            <span className={`${n.label} text-xs`}>{formatHours(getProjectHours(selectedConsultant.consultantId, p.projectId))}</span>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            {/* Clients */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Clients</span>{canAssign && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getConsultantClients(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : <div className="flex flex-wrap gap-1.5">{getConsultantClients(selectedConsultant.consultantId).map(c => <span key={c.customerId} className={`px-2.5 py-1 ${n.flat} ${n.text} text-xs rounded-lg`}>{c.firstName} {c.lastName}</span>)}</div>}
                            </div>
                            {selectedConsultant.notes && <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Notes</span><p className={`${n.text} text-sm mt-1 leading-relaxed`}>{selectedConsultant.notes}</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedConsultant && canEdit && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Edit Consultant</h2>
                            <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Account (Read-only)</span><div className="flex gap-6 mt-2"><div><p className={`${n.tertiary} text-[10px]`}>Name</p><p className={`${n.text} text-sm`}>{selectedConsultant.firstName} {selectedConsultant.lastName}</p></div><div><p className={`${n.tertiary} text-[10px]`}>Email</p><p className={`${n.text} text-sm`}>{selectedConsultant.email}</p></div></div></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Phone</label><input type="tel" value={consultantForm.phone} onChange={(e) => setConsultantForm({ ...consultantForm, phone: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={consultantForm.status} onChange={(e) => setConsultantForm({ ...consultantForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Department</label><input type="text" value={consultantForm.department} onChange={(e) => setConsultantForm({ ...consultantForm, department: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Specialization</label><input type="text" value={consultantForm.specialization} onChange={(e) => setConsultantForm({ ...consultantForm, specialization: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Hourly Rate ($)</label><input type="number" value={consultantForm.hourlyRate} onChange={(e) => setConsultantForm({ ...consultantForm, hourlyRate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Start Date</label><input type="date" value={consultantForm.startDate} onChange={(e) => setConsultantForm({ ...consultantForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea rows={3} value={consultantForm.notes} onChange={(e) => setConsultantForm({ ...consultantForm, notes: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={updateConsultant} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Clients Modal */}
            {showClientsModal && selectedConsultant && canAssign && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Clients</h2>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getConsultantClients(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getConsultantClients(selectedConsultant.consultantId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                            </div>
                                            <button onClick={() => removeClient(c.customerId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableClients(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableClients(selectedConsultant.consultantId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.clientCode}</p></div>
                                            </div>
                                            <button onClick={() => assignClient(c.customerId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Projects Modal */}
            {showProjectsModal && selectedConsultant && canAssign && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Projects</h2>
                            <button onClick={() => { setShowProjectsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getConsultantProjects(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getConsultantProjects(selectedConsultant.consultantId).map(p => (
                                        <div key={p.projectId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-xl flex items-center justify-center`}><FolderOpen className={`w-4 h-4 ${n.secondary}`} /></div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{p.projectName}</p><p className={`${n.label} text-[11px]`}>{formatHours(getProjectHours(selectedConsultant.consultantId, p.projectId))} logged</p></div>
                                            </div>
                                            <button onClick={() => removeProject(p.projectId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Unlink className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableProjects(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableProjects(selectedConsultant.consultantId).map(p => (
                                        <div key={p.projectId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-xl flex items-center justify-center`}><FolderOpen className={`w-4 h-4 ${n.tertiary}`} /></div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{p.projectName}</p><p className={`${n.tertiary} text-[11px]`}>{fmtStatus(p.status)}</p></div>
                                            </div>
                                            <button onClick={() => assignProject(p.projectId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowProjectsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Time Tracking Modal */}
            {showTimeTrackingModal && selectedConsultant && canLogTime && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <div className="flex items-center gap-3"><Timer className="w-5 h-5 text-emerald-400" /><h2 className={`text-lg font-semibold ${n.text}`}>Log Time</h2></div>
                            <button onClick={() => { setShowTimeTrackingModal(false); setShowDetailsModal(true); setIsTimerRunning(false); setTimerSeconds(0); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Timer */}
                            <div className={`${n.card} p-5 text-center`}>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Live Timer</span>
                                <div className={`text-4xl font-mono font-bold ${n.strong} my-4`}>{formatTimer(timerSeconds)}</div>
                                {!isTimerRunning ? (
                                    <div className="space-y-3">
                                        <select value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select Project</option>{getConsultantProjects(selectedConsultant.consultantId).map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select>
                                        <button onClick={() => timerProjectId && startTimer(timerProjectId)} disabled={!timerProjectId} className={`w-full px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2`}><Play className="w-4 h-4" />Start</button>
                                    </div>
                                ) : (
                                    <button onClick={stopTimer} className={`w-full px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm flex items-center justify-center gap-2`}><Pause className="w-4 h-4" />Stop & Log</button>
                                )}
                            </div>
                            {/* Manual Entry */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><Clock className="w-3.5 h-3.5" />Manual Entry</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Project *</label><select value={timeForm.projectId} onChange={(e) => setTimeForm({ ...timeForm, projectId: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select project</option>{getConsultantProjects(selectedConsultant.consultantId).map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Date</label><input type="date" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><label className={`${n.label} text-[11px] block mb-1`}>Hours</label><input type="number" min="0" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                        <div className="flex-1"><label className={`${n.label} text-[11px] block mb-1`}>Min</label><select value={timeForm.minutes} onChange={(e) => setTimeForm({ ...timeForm, minutes: parseInt(e.target.value) })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value={0}>0</option><option value={15}>15</option><option value={30}>30</option><option value={45}>45</option></select></div>
                                    </div>
                                    <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={2} value={timeForm.description} onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="What did you work on?" /></div>
                                </div>
                                <button onClick={logTime} disabled={!timeForm.projectId} className={`w-full mt-3 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2`}><Save className="w-4 h-4" />Log Time</button>
                            </div>
                            {/* Recent Entries */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Recent Entries</span>
                                {getConsultantHours(selectedConsultant.consultantId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>No entries yet</p> : (
                                    <div className="space-y-1.5 mt-3 max-h-48 overflow-y-auto">{getConsultantHours(selectedConsultant.consultantId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(l => (
                                        <div key={l.logId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex-1 min-w-0">
                                                <p className={`${n.text} text-sm font-medium truncate`}>{getProjectName(l.projectId)}</p>
                                                <p className={`${n.tertiary} text-[11px]`}>{formatDate(l.date)} · {l.description || 'No description'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-3">
                                                <span className={`${n.label} text-sm font-medium`}>{formatHours(l.hours)}</span>
                                                <button onClick={() => deleteHoursLog(l.logId)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                            </div>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowTimeTrackingModal(false); setShowDetailsModal(true); setIsTimerRunning(false); setTimerSeconds(0); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultantsPage;