import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Search, Plus, Filter, ChevronRight, Phone, Users, Briefcase, Clock, X, Edit2, Trash2, User, TrendingUp, CheckCircle2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, StickyNote, FolderOpen, Link2, Unlink, UserMinus, FolderPlus, RefreshCw, Timer, Play, Pause, Save, CheckCircle, AlertCircle, Info, Mail } from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

const API_BASE = 'http://localhost:4000/api';

const STORAGE_KEYS = {
    consultantsExtended: 'timely_consultants_extended',
    hoursLogs: 'timely_hours_logs',
};

type UserRole = 'admin' | 'consultant' | 'client';

type CurrentUser = {
    customerId: string;
    email: string;
    name: string;
    role?: UserRole | string;
    consultantId?: string;
};

const getCurrentUserRole = (): { role: UserRole; email: string; customerId: string; name: string; consultantId: string } => {
    try {
        const raw = localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
        const parsed: CurrentUser = JSON.parse(raw);
        const r = parsed.role;
        const role: UserRole = (r === 'admin' || r === 'consultant' || r === 'client') ? r : 'admin';
        return {
            role,
            email: parsed.email || '',
            customerId: parsed.customerId || '',
            name: parsed.name || '',
            consultantId: (parsed as any).consultantId || '',
        };
    } catch {
        return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
    }
};

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch (e) { return null; } };

interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; tempPassword: string; role: string; phone?: string; department?: string; specialization?: string; hourlyRate?: string; startDate?: string; status?: 'active' | 'inactive' | 'on_leave'; notes?: string; }
interface Client { customerId: string; clientCode: string; firstName: string; lastName: string; email: string; }
interface Project { projectId: string; projectCode: string; projectName: string; status: string; }
interface HoursLog { logId: string; consultantId: string; projectId: string; date: string; hours: number; description: string; createdAt: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const ConsultantsPage = () => {
    const { isDark } = useTheme();
    const styles = {
        bg: isDark ? 'bg-slate-950' : 'bg-gray-50',
        text: isDark ? 'text-white' : 'text-gray-900',
        textMuted: isDark ? 'text-slate-400' : 'text-gray-600',
        textSubtle: isDark ? 'text-slate-500' : 'text-gray-400',
        card: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        cardHover: isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50',
        cardInner: isDark ? 'bg-slate-800' : 'bg-gray-50',
        input: isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900',
        inputFocus: isDark ? 'focus:border-blue-500' : 'focus:border-blue-500',
        button: isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        divider: isDark ? 'border-slate-700' : 'border-gray-200',
        modal: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        tableHeader: isDark ? 'bg-slate-800' : 'bg-gray-100',
        tableRow: isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-50',
        accent: isDark ? 'text-blue-400' : 'text-blue-600',
        warning: isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800',
    };

    // Get current user role
    const { role: userRole, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';

    // Permission checks
    const canCreate = isAdmin;
    const canEdit = isAdmin;
    const canDelete = isAdmin;
    const canAssign = isAdmin;
    const canLogTime = isAdmin || isConsultant;

    // Toast notification system
    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };
    const ToastIcon = ({ type }: { type: string }) => {
        if (type === 'success') return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        if (type === 'error') return <AlertCircle className="w-5 h-5 text-red-400" />;
        return <Info className="w-5 h-5 text-blue-400" />;
    };

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
    const [sortConfig, setSortConfig] = useState({ field: 'consultantId', direction: 'desc' });
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerProjectId, setTimerProjectId] = useState('');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const [consultantForm, setConsultantForm] = useState({ firstName: '', middleName: '', lastName: '', phone: '', department: '', specialization: '', hourlyRate: '', startDate: new Date().toISOString().split('T')[0], status: 'active' as const, notes: '' });
    const [tempPassword, setTempPassword] = useState('');
    const [timeForm, setTimeForm] = useState({ projectId: '', date: new Date().toISOString().split('T')[0], hours: 0, minutes: 0, description: '' });

    // Subscribe to AssignmentService changes
    useEffect(() => {
        const unsubscribe = AssignmentService.subscribe(() => {
            setAssignmentRefreshKey(k => k + 1);
        });

        const handleCustomEvent = () => setAssignmentRefreshKey(k => k + 1);
        window.addEventListener('assignment-change', handleCustomEvent);

        return () => {
            unsubscribe();
            window.removeEventListener('assignment-change', handleCustomEvent);
        };
    }, []);

    useEffect(() => { loadAllData(); }, []);
    useEffect(() => { if (isTimerRunning) { timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000); } else if (timerRef.current) { clearInterval(timerRef.current); } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [isTimerRunning]);

    const loadAllData = async () => {
        setRefreshing(true);
        await Promise.all([loadConsultants(), loadClients(), loadProjects()]);
        loadHoursLogs();
        // Sync client-consultant relationships from API
        AssignmentService.syncClientConsultantsFromAPI();
        setRefreshing(false);
    };

    const loadConsultants = async () => {
        const d = await safeFetch(`${API_BASE}/consultants`);
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
        const localConsultants = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
        if (d?.data) {
            const apiConsultants = d.data.map((c: Consultant) => ({ ...c, ...ext[c.consultantId] }));
            const merged = [...apiConsultants];
            localConsultants.forEach((lc: Consultant) => {
                if (!merged.find((c: Consultant) => c.consultantId === lc.consultantId)) {
                    merged.push({ ...lc, ...ext[lc.consultantId] });
                }
            });
            setConsultants(merged);
        } else {
            setConsultants(localConsultants.map((c: Consultant) => ({ ...c, ...ext[c.consultantId] })));
        }
    };
    const loadClients = async () => { const d = await safeFetch(`${API_BASE}/users-report`); if (d?.data) setClients(d.data); };
    const loadProjects = async () => { const d = await safeFetch(`${API_BASE}/projects`); if (d?.data) { const local = JSON.parse(localStorage.getItem('timely_projects') || '[]'); setProjects([...d.data, ...local.filter((l: Project) => !d.data.find((a: Project) => a.projectId === l.projectId))]); } else { setProjects(JSON.parse(localStorage.getItem('timely_projects') || '[]')); } };
    const loadHoursLogs = () => { try { const s = localStorage.getItem(STORAGE_KEYS.hoursLogs); if (s) setHoursLogs(JSON.parse(s)); } catch (e) { console.error(e); } };
    const saveHoursLogs = (data: HoursLog[]) => { localStorage.setItem(STORAGE_KEYS.hoursLogs, JSON.stringify(data)); setHoursLogs(data); };

    const companyEmail = useMemo(() => { const f = consultantForm.firstName.trim(), l = consultantForm.lastName.trim(); if (!f || !l) return ''; return `${l.replace(/\s+/g, '').toLowerCase()}${f[0].toLowerCase()}@timely.com`; }, [consultantForm.firstName, consultantForm.lastName]);
    const generateStrongPassword = () => { const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lo = 'abcdefghijkmnopqrstuvwxyz', d = '23456789', s = '!@$%^&*?'; const pick = (x: string) => x[Math.floor(Math.random() * x.length)]; let p = pick(u) + pick(lo) + pick(d) + pick(s); while (p.length < 12) p += pick(u + lo + d + s); setTempPassword(p.split('').sort(() => Math.random() - 0.5).join('')); };

    const createConsultant = async () => {
        if (!canCreate) { showToast('You do not have permission to create consultants', 'error'); return; }
        if (!consultantForm.firstName || !consultantForm.lastName) { showToast('Please fill required fields', 'error'); return; }
        if (!tempPassword) { showToast('Generate a password first', 'error'); return; }
        setLoading(true);
        try {
            const r = await fetch(`${API_BASE}/consultants`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: consultantForm.firstName.trim(), lastName: consultantForm.lastName.trim(), email: companyEmail, tempPassword, role: 'consultant', performedBy: 'admin' })
            });
            if (r.ok) {
                const res = await r.json();
                const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
                ext[res.consultantId] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
                localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
                showToast(`Consultant created (${res.consultantCode})`, 'success');
                setShowCreateModal(false); resetForm(); loadConsultants();
            } else { throw new Error('API failed'); }
        } catch (e: any) {
            console.log('API not available, creating consultant locally');
            const consultantId = `local_${Date.now()}`;
            const consultantCode = `CON-${Date.now().toString().slice(-6)}`;
            const localConsultants = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
            const newConsultant: Consultant = { consultantId, consultantCode, firstName: consultantForm.firstName.trim(), lastName: consultantForm.lastName.trim(), email: companyEmail, tempPassword, role: 'consultant', phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
            localConsultants.push(newConsultant);
            localStorage.setItem('timely_local_consultants', JSON.stringify(localConsultants));
            const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
            ext[consultantId] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
            localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
            showToast(`Consultant created locally (${consultantCode})`, 'success');
            setShowCreateModal(false); resetForm(); loadConsultants();
        } finally { setLoading(false); }
    };

    const updateConsultant = () => {
        if (!canEdit) { showToast('You do not have permission to edit consultants', 'error'); return; }
        if (!selectedConsultant) return;
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
        ext[selectedConsultant.consultantId] = { phone: consultantForm.phone, department: consultantForm.department, specialization: consultantForm.specialization, hourlyRate: consultantForm.hourlyRate, startDate: consultantForm.startDate, status: consultantForm.status, notes: consultantForm.notes };
        localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));
        setShowEditModal(false); setShowDetailsModal(true); loadConsultants();
        showToast('Consultant updated', 'success');
    };

    const deleteConsultant = async (cid: string) => {
        if (!canDelete) { showToast('You do not have permission to delete consultants', 'error'); return; }
        try {
            const response = await fetch(`${API_BASE}/consultants-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consultantId: cid, performedBy: 'admin' })
            });
            if (!response.ok) {
                console.log('API deletion failed, cleaning up local data only');
            }
        } catch (e) {
            console.log('API not available, cleaning up local data only');
        }
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.consultantsExtended) || '{}');
        delete ext[cid];
        localStorage.setItem(STORAGE_KEYS.consultantsExtended, JSON.stringify(ext));

        // Use AssignmentService for cleanup - removes from all projects and clients
        AssignmentService.cleanupConsultantAssignments(cid);

        saveHoursLogs(hoursLogs.filter(h => h.consultantId !== cid));
        // Remove from local consultants
        const localConsultants = JSON.parse(localStorage.getItem('timely_local_consultants') || '[]');
        localStorage.setItem('timely_local_consultants', JSON.stringify(localConsultants.filter((c: Consultant) => c.consultantId !== cid)));
        setShowDeleteConfirm(null);
        setShowDetailsModal(false);
        setSelectedConsultant(null);
        await loadAllData();
        showToast('Consultant deleted (assignments cleaned up)', 'success');
    };

    // Use AssignmentService for client assignments
    const assignClient = async (clientId: string) => {
        if (!canAssign) { showToast('You do not have permission to assign clients', 'error'); return; }
        if (!selectedConsultant) return;

        const result = await AssignmentService.assignConsultantToClientViaAPI(clientId, selectedConsultant.consultantId);
        if (result) {
            showToast('Client assigned (synced to Projects & Clients pages)', 'success');
        } else {
            showToast('Already assigned or failed', 'info');
        }
    };

    const removeClient = (clientId: string) => {
        if (!canAssign) { showToast('You do not have permission to remove clients', 'error'); return; }
        if (!selectedConsultant) return;
        AssignmentService.removeConsultantFromClient(clientId, selectedConsultant.consultantId);
        showToast('Client removed', 'success');
    };

    // Get clients using AssignmentService
    const getConsultantClients = (cid: string) => {
        const clientIds = AssignmentService.getClientsForConsultant(cid);
        return clients.filter(c => clientIds.includes(c.customerId));
    };

    const getAvailableClients = (cid: string) => {
        const assignedIds = AssignmentService.getClientsForConsultant(cid);
        return clients.filter(c => !assignedIds.includes(c.customerId));
    };

    // Use AssignmentService for project assignments
    const assignProject = (pid: string) => {
        if (!canAssign) { showToast('You do not have permission to assign projects', 'error'); return; }
        if (!selectedConsultant) return;

        const result = AssignmentService.assignConsultantToProject(pid, selectedConsultant.consultantId);
        if (result) {
            showToast('Project assigned (synced to Projects & Clients pages)', 'success');
        } else {
            showToast('Already assigned to this project', 'info');
        }
    };

    const removeProject = (pid: string) => {
        if (!canAssign) { showToast('You do not have permission to remove projects', 'error'); return; }
        if (!selectedConsultant) return;
        AssignmentService.removeConsultantFromProject(pid, selectedConsultant.consultantId);
        showToast('Project removed', 'success');
    };

    // Get projects using AssignmentService
    const getConsultantProjects = (cid: string) => {
        const projectIds = AssignmentService.getProjectsForConsultant(cid);
        return projects.filter(p => projectIds.includes(p.projectId));
    };

    const getAvailableProjects = (cid: string) => {
        const assignedIds = AssignmentService.getProjectsForConsultant(cid);
        return projects.filter(p => !assignedIds.includes(p.projectId));
    };

    const logTime = () => {
        if (!canLogTime) { showToast('You do not have permission to log time', 'error'); return; }
        if (!selectedConsultant || !timeForm.projectId) return;
        const totalHours = timeForm.hours + timeForm.minutes / 60;
        if (totalHours <= 0) { showToast('Please enter time', 'error'); return; }
        const newLog: HoursLog = { logId: `log_${Date.now()}`, consultantId: selectedConsultant.consultantId, projectId: timeForm.projectId, date: timeForm.date, hours: totalHours, description: timeForm.description, createdAt: new Date().toISOString() };
        saveHoursLogs([...hoursLogs, newLog]);
        setTimeForm({ projectId: '', date: new Date().toISOString().split('T')[0], hours: 0, minutes: 0, description: '' });
        showToast(`Logged ${formatHours(totalHours)}`, 'success');
    };

    const deleteHoursLog = (logId: string) => {
        if (!canLogTime) { showToast('You do not have permission to delete time entries', 'error'); return; }
        saveHoursLogs(hoursLogs.filter(h => h.logId !== logId));
        showToast('Entry deleted', 'success');
    };

    const getConsultantHours = (cid: string) => hoursLogs.filter(h => h.consultantId === cid);
    const getProjectHours = (cid: string, pid: string) => hoursLogs.filter(h => h.consultantId === cid && h.projectId === pid).reduce((sum, h) => sum + h.hours, 0);
    const getTotalHours = (cid: string) => hoursLogs.filter(h => h.consultantId === cid).reduce((sum, h) => sum + h.hours, 0);
    const getProjectName = (pid: string) => projects.find(p => p.projectId === pid)?.projectName || 'Unknown';

    const startTimer = (pid: string) => {
        if (!canLogTime) { showToast('You do not have permission to use the timer', 'error'); return; }
        setTimerProjectId(pid); setTimerSeconds(0); setIsTimerRunning(true); showToast('Timer started', 'info');
    };
    const stopTimer = () => {
        if (!selectedConsultant || !timerProjectId) return;
        setIsTimerRunning(false);
        const hours = timerSeconds / 3600;
        if (hours >= 0.01) {
            const newLog: HoursLog = { logId: `log_${Date.now()}`, consultantId: selectedConsultant.consultantId, projectId: timerProjectId, date: new Date().toISOString().split('T')[0], hours, description: 'Timer session', createdAt: new Date().toISOString() };
            saveHoursLogs([...hoursLogs, newLog]);
            showToast(`Logged ${formatHours(hours)}`, 'success');
        }
        setTimerSeconds(0); setTimerProjectId('');
    };

    const resetForm = () => { setConsultantForm({ firstName: '', middleName: '', lastName: '', phone: '', department: '', specialization: '', hourlyRate: '', startDate: new Date().toISOString().split('T')[0], status: 'active', notes: '' }); setTempPassword(''); };
    const openConsultantDetails = (c: Consultant) => { setSelectedConsultant(c); setConsultantForm({ firstName: c.firstName, middleName: '', lastName: c.lastName, phone: c.phone || '', department: c.department || '', specialization: c.specialization || '', hourlyRate: c.hourlyRate || '', startDate: c.startDate || new Date().toISOString().split('T')[0], status: c.status || 'active', notes: c.notes || '' }); setShowDetailsModal(true); };

    // Filter consultants based on role (now with assignmentRefreshKey dependency)
    const filteredConsultants = useMemo(() => {
        let filtered = consultants;

        // Consultants only see themselves
        if (isConsultant && userConsultantId) {
            filtered = consultants.filter(c => c.consultantId === userConsultantId);
        }

        // Apply search and filters
        filtered = filtered.filter(c => {
            const search = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()) || (c.consultantCode || '').toLowerCase().includes(searchTerm.toLowerCase());
            const status = statusFilter === 'all' || c.status === statusFilter;
            return search && status;
        });

        // Sort
        filtered.sort((a, b) => {
            let aV: any, bV: any;
            switch (sortConfig.field) {
                case 'name': aV = `${a.firstName} ${a.lastName}`.toLowerCase(); bV = `${b.firstName} ${b.lastName}`.toLowerCase(); break;
                case 'status': aV = a.status || ''; bV = b.status || ''; break;
                default: aV = Number(a.consultantId) || 0; bV = Number(b.consultantId) || 0;
            }
            return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
        });
        return filtered;
    }, [consultants, userConsultantId, isConsultant, searchTerm, statusFilter, sortConfig, assignmentRefreshKey]);

    // Stats based on role
    const stats = useMemo(() => {
        const relevantConsultants = isConsultant && userConsultantId
            ? consultants.filter(c => c.consultantId === userConsultantId)
            : consultants;
        const relevantHoursLogs = isConsultant && userConsultantId
            ? hoursLogs.filter(h => h.consultantId === userConsultantId)
            : hoursLogs;
        return {
            total: relevantConsultants.length,
            active: relevantConsultants.filter(c => c.status === 'active').length,
            onLeave: relevantConsultants.filter(c => c.status === 'on_leave').length,
            totalHours: relevantHoursLogs.reduce((sum, h) => sum + h.hours, 0)
        };
    }, [consultants, hoursLogs, userConsultantId, isConsultant]);

    const getStatusColor = (s: string) => ({ active: 'bg-emerald-600', inactive: 'bg-gray-600', on_leave: 'bg-amber-600' }[s] || 'bg-gray-600');
    const getStatusLabel = (s: string) => ({ active: 'Active', inactive: 'Inactive', on_leave: 'On Leave' }[s] || s || 'Active');
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : 'N/A';
    const formatHours = (h: number) => h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`;
    const formatTimerDisplay = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`; };
    const toggleSort = (f: string) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }));
    const getSortIcon = (f: string) => sortConfig.field !== f ? <ArrowUpDown className={`w-4 h-4 ${styles.textSubtle}`} /> : sortConfig.direction === 'asc' ? <ArrowUp className={`w-4 h-4 ${styles.accent}`} /> : <ArrowDown className={`w-4 h-4 ${styles.accent}`} />;

    // Check if current user can view/edit a specific consultant
    const canViewConsultant = (consultantId: string) => {
        if (isAdmin) return true;
        if (isConsultant && consultantId === userConsultantId) return true;
        return false;
    };

    return (
        <div className={`min-h-screen ${styles.bg}`}>
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} animate-in slide-in-from-right duration-300`}>
                        <ToastIcon type={toast.type} />
                        <span className={styles.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={`ml-2 ${styles.textMuted} hover:${styles.text}`}><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-md w-full p-6`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                            <h3 className={`text-lg font-semibold ${styles.text}`}>Delete Consultant?</h3>
                        </div>
                        <p className={`${styles.textMuted} mb-6`}>This will permanently delete the consultant and remove all assignments from Projects & Clients pages. Time logs will also be deleted.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${styles.button} rounded-lg`}>Cancel</button>
                            <button onClick={() => deleteConsultant(showDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className={`text-4xl font-bold ${styles.text} mb-2`}>Consultants</h1>
                            <p className={styles.textMuted}>
                                {isAdmin ? 'Manage team and track hours' :
                                    isConsultant ? 'View your profile and log time' :
                                        'View the consultant team'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`text-xs px-3 py-1.5 rounded-full ${styles.cardInner} ${styles.textMuted}`}>
                                Role: <span className="font-semibold capitalize">{userRole}</span>
                            </div>
                            <button onClick={loadAllData} disabled={refreshing} className={`p-2.5 rounded-lg border ${styles.divider} ${styles.cardHover} ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-5 h-5 ${styles.textMuted}`} /></button>
                            {canCreate && (
                                <button onClick={() => setShowCreateModal(true)} className={`${styles.buttonPrimary} px-5 py-2.5 rounded-lg flex items-center gap-2`}><Plus className="w-5 h-5" />Add Consultant</button>
                            )}
                        </div>
                    </div>

                    {/* Role-based info banners */}
                    {isConsultant && (
                        <div className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${styles.warning}`}>
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-sm">You can view your profile and log time on assigned projects. Consultant management is handled by admins.</p>
                        </div>
                    )}
                    {isClient && (
                        <div className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${styles.warning}`}>
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-sm">This page shows the consultant team. Contact your assigned consultant for assistance.</p>
                        </div>
                    )}

                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${styles.textMuted} w-5 h-5`} /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${showFilters ? styles.buttonPrimary : styles.button}`}><Filter className="w-5 h-5" />Filters</button>
                    </div>
                    {showFilters && (
                        <div className={`mt-4 p-4 ${styles.card} border rounded-lg`}>
                            <label className={`${styles.textMuted} text-sm block mb-1`}>Status</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`w-full max-w-xs px-4 py-2 ${styles.input} border rounded-lg`}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select>
                        </div>
                    )}
                    <div className="grid grid-cols-4 gap-4 mt-6">
                        {[{ label: isConsultant ? 'Your Profile' : 'Total', value: stats.total, icon: Users }, { label: 'Active', value: stats.active, icon: CheckCircle2 }, { label: 'On Leave', value: stats.onLeave, icon: Clock }, { label: isConsultant ? 'Your Hours' : 'Hours Logged', value: formatHours(stats.totalHours), icon: TrendingUp }].map((s, i) => (
                            <div key={i} className={`${styles.card} border rounded-lg p-4`}><div className="flex items-center justify-between mb-1"><span className={`${styles.textMuted} text-sm`}>{s.label}</span><s.icon className={`w-5 h-5 ${styles.accent}`} /></div><div className={`text-2xl font-bold ${styles.text}`}>{s.value}</div></div>
                        ))}
                    </div>
                </div>

                <div className={`${styles.card} border rounded-lg overflow-hidden`}>
                    <div className={`grid grid-cols-12 gap-4 p-4 border-b ${styles.divider} ${styles.tableHeader}`}>
                        <div className={`col-span-3 flex items-center gap-2 cursor-pointer ${styles.textMuted} text-sm`} onClick={() => toggleSort('name')}>Consultant {getSortIcon('name')}</div>
                        <div className={`col-span-2 ${styles.textMuted} text-sm`}>Projects</div>
                        <div className={`col-span-2 ${styles.textMuted} text-sm`}>Hours</div>
                        <div className={`col-span-2 flex items-center gap-2 cursor-pointer ${styles.textMuted} text-sm`} onClick={() => toggleSort('status')}>Status {getSortIcon('status')}</div>
                        <div className={`col-span-2 ${styles.textMuted} text-sm`}>Department</div>
                        <div className={`col-span-1 ${styles.textMuted} text-sm text-right`}>Actions</div>
                    </div>
                    {filteredConsultants.length === 0 ? (
                        <div className="text-center py-16"><Users className={`w-12 h-12 ${styles.textSubtle} mx-auto mb-3`} /><p className={styles.textMuted}>{isConsultant ? 'Your profile not found' : 'No consultants found'}</p></div>
                    ) : filteredConsultants.map(c => (
                        <div key={c.consultantId} className={`grid grid-cols-12 gap-4 p-4 border-b ${styles.tableRow} cursor-pointer`} onClick={() => canViewConsultant(c.consultantId) && openConsultantDetails(c)}>
                            <div className="col-span-3 flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div>
                                <div><p className={`${styles.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${styles.textSubtle} text-xs`}>{c.consultantCode}</p></div>
                            </div>
                            <div className="col-span-2 flex items-center gap-1"><FolderOpen className={`w-4 h-4 ${styles.textSubtle}`} /><span className={`${styles.textMuted} text-sm`}>{getConsultantProjects(c.consultantId).length}</span></div>
                            <div className="col-span-2 flex items-center gap-1"><Clock className={`w-4 h-4 ${styles.textSubtle}`} /><span className={`${styles.textMuted} text-sm`}>{formatHours(getTotalHours(c.consultantId))}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`${getStatusColor(c.status || 'active')} px-3 py-1 rounded-full text-white text-xs`}>{getStatusLabel(c.status || 'active')}</span></div>
                            <div className="col-span-2"><span className={`${styles.textMuted} text-sm`}>{c.department || 'N/A'}</span></div>
                            <div className="col-span-1 flex items-center justify-end"><ChevronRight className={`w-5 h-5 ${styles.textMuted}`} /></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Modal - Admin only */}
            {showCreateModal && canCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${styles.text}`}>Add Consultant</h2><button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><User className={`w-5 h-5 ${styles.accent}`} />Personal</h3><div className="grid grid-cols-3 gap-4"><div><label className={`${styles.textMuted} text-sm block mb-1`}>First *</label><input type="text" value={consultantForm.firstName} onChange={(e) => setConsultantForm({ ...consultantForm, firstName: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Middle</label><input type="text" value={consultantForm.middleName} onChange={(e) => setConsultantForm({ ...consultantForm, middleName: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Last *</label><input type="text" value={consultantForm.lastName} onChange={(e) => setConsultantForm({ ...consultantForm, lastName: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div></div><div className="mt-3"><label className={`${styles.textMuted} text-sm block mb-1`}>Email (auto)</label><div className={`px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg ${styles.textMuted}`}>{companyEmail || 'Enter names'}</div></div><div className="mt-3"><label className={`${styles.textMuted} text-sm block mb-1`}>Phone</label><input type="tel" value={consultantForm.phone} onChange={(e) => setConsultantForm({ ...consultantForm, phone: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div></div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><Briefcase className={`w-5 h-5 ${styles.accent}`} />Account</h3><div><label className={`${styles.textMuted} text-sm block mb-1`}>Temp Password *</label><div className="flex gap-2"><input type="text" value={tempPassword} readOnly placeholder="Click Generate" className={`flex-1 px-4 py-2.5 ${styles.input} border rounded-lg font-mono`} /><button type="button" onClick={generateStrongPassword} className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg">Generate</button></div></div></div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><TrendingUp className={`w-5 h-5 ${styles.accent}`} />Work Info</h3><div className="grid grid-cols-2 gap-4"><div><label className={`${styles.textMuted} text-sm block mb-1`}>Department</label><input type="text" value={consultantForm.department} onChange={(e) => setConsultantForm({ ...consultantForm, department: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Specialization</label><input type="text" value={consultantForm.specialization} onChange={(e) => setConsultantForm({ ...consultantForm, specialization: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Hourly Rate ($)</label><input type="number" value={consultantForm.hourlyRate} onChange={(e) => setConsultantForm({ ...consultantForm, hourlyRate: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Start Date</label><input type="date" value={consultantForm.startDate} onChange={(e) => setConsultantForm({ ...consultantForm, startDate: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Status</label><select value={consultantForm.status} onChange={(e) => setConsultantForm({ ...consultantForm, status: e.target.value as any })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select></div></div></div>
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Notes</label><textarea rows={3} value={consultantForm.notes} onChange={(e) => setConsultantForm({ ...consultantForm, notes: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg resize-none`} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`flex-1 px-5 py-2.5 ${styles.button} rounded-lg`}>Cancel</button><button onClick={createConsultant} disabled={loading} className={`flex-1 px-5 py-2.5 ${styles.buttonPrimary} rounded-lg disabled:opacity-50`}>{loading ? 'Creating...' : 'Create'}</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedConsultant && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">{selectedConsultant.firstName[0]}{selectedConsultant.lastName[0]}</div><div><h2 className={`text-xl font-bold ${styles.text}`}>{selectedConsultant.firstName} {selectedConsultant.lastName}</h2><p className={styles.textMuted}>{selectedConsultant.consultantCode} - {selectedConsultant.email}</p></div></div>
                            <div className="flex items-center gap-2">
                                {canDelete && <button onClick={() => setShowDeleteConfirm(selectedConsultant.consultantId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-5 h-5 text-red-500" /></button>}
                                <button onClick={() => { setShowDetailsModal(false); setSelectedConsultant(null); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="flex items-center gap-4 flex-wrap"><span className={`${getStatusColor(selectedConsultant.status || 'active')} px-3 py-1 rounded-full text-white text-sm`}>{getStatusLabel(selectedConsultant.status || 'active')}</span>{selectedConsultant.department && <span className={`${styles.textMuted} flex items-center gap-1`}><Briefcase className="w-4 h-4" />{selectedConsultant.department}</span>}{selectedConsultant.phone && <span className={`${styles.textMuted} flex items-center gap-1`}><Phone className="w-4 h-4" />{selectedConsultant.phone}</span>}</div>

                            {/* Action buttons - based on permissions */}
                            <div className="grid grid-cols-4 gap-4">
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.button} rounded-lg`}><Edit2 className="w-4 h-4" />Edit</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.button} rounded-lg`}><Users className="w-4 h-4" />Clients</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.button} rounded-lg`}><FolderOpen className="w-4 h-4" />Projects</button>}
                                {canLogTime && <button onClick={() => { setShowDetailsModal(false); setShowTimeTrackingModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.buttonPrimary} rounded-lg`}><Clock className="w-4 h-4" />Log Time</button>}
                                {/* Contact buttons for clients */}
                                {isClient && selectedConsultant.email && (
                                    <a href={`mailto:${selectedConsultant.email}`} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.buttonPrimary} rounded-lg`}><Mail className="w-4 h-4" />Email</a>
                                )}
                                {isClient && selectedConsultant.phone && (
                                    <a href={`tel:${selectedConsultant.phone}`} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${styles.button} rounded-lg`}><Phone className="w-4 h-4" />Call</a>
                                )}
                            </div>

                            <div className={`${styles.cardInner} rounded-lg p-4`}><h3 className={`${styles.textMuted} text-sm mb-2 flex items-center gap-2`}><TrendingUp className="w-4 h-4" />Performance</h3><div className="grid grid-cols-3 gap-4"><div><p className={`${styles.textSubtle} text-xs`}>Total Hours</p><p className={`${styles.text} text-xl font-bold`}>{formatHours(getTotalHours(selectedConsultant.consultantId))}</p></div><div><p className={`${styles.textSubtle} text-xs`}>Projects</p><p className={`${styles.text} text-xl font-bold`}>{getConsultantProjects(selectedConsultant.consultantId).length}</p></div><div><p className={`${styles.textSubtle} text-xs`}>Clients</p><p className={`${styles.text} text-xl font-bold`}>{getConsultantClients(selectedConsultant.consultantId).length}</p></div></div></div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}><div className="flex items-center justify-between mb-2"><h3 className={`${styles.textMuted} text-sm flex items-center gap-2`}><FolderOpen className="w-4 h-4" />Projects</h3>{canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`${styles.accent} text-sm`}>Manage</button>}</div>{getConsultantProjects(selectedConsultant.consultantId).length === 0 ? <p className={styles.textSubtle}>No projects</p> : <div className="space-y-2">{getConsultantProjects(selectedConsultant.consultantId).map(p => <div key={p.projectId} className={`flex items-center justify-between px-3 py-2 ${isDark ? 'bg-slate-700' : 'bg-gray-200'} rounded-lg`}><span className={`${styles.text} text-sm`}>{p.projectName}</span><span className={`${styles.accent} text-sm`}>{formatHours(getProjectHours(selectedConsultant.consultantId, p.projectId))}</span></div>)}</div>}</div>
                            {selectedConsultant.notes && <div className={`${styles.cardInner} rounded-lg p-4`}><h3 className={`${styles.textMuted} text-sm mb-2 flex items-center gap-2`}><StickyNote className="w-4 h-4" />Notes</h3><p className={`${styles.text} text-sm`}>{selectedConsultant.notes}</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal - Admin only */}
            {showEditModal && selectedConsultant && canEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${styles.text}`}>Edit Consultant</h2><button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`${styles.cardInner} rounded-lg p-4`}><h3 className={`${styles.textMuted} text-sm mb-2`}>Account (Read-only)</h3><div className="grid grid-cols-2 gap-4"><div><p className={`${styles.textSubtle} text-xs`}>Name</p><p className={styles.text}>{selectedConsultant.firstName} {selectedConsultant.lastName}</p></div><div><p className={`${styles.textSubtle} text-xs`}>Email</p><p className={styles.text}>{selectedConsultant.email}</p></div></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className={`${styles.textMuted} text-sm block mb-1`}>Phone</label><input type="tel" value={consultantForm.phone} onChange={(e) => setConsultantForm({ ...consultantForm, phone: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Status</label><select value={consultantForm.status} onChange={(e) => setConsultantForm({ ...consultantForm, status: e.target.value as any })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></select></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Department</label><input type="text" value={consultantForm.department} onChange={(e) => setConsultantForm({ ...consultantForm, department: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Specialization</label><input type="text" value={consultantForm.specialization} onChange={(e) => setConsultantForm({ ...consultantForm, specialization: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Hourly Rate ($)</label><input type="number" value={consultantForm.hourlyRate} onChange={(e) => setConsultantForm({ ...consultantForm, hourlyRate: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div><label className={`${styles.textMuted} text-sm block mb-1`}>Start Date</label><input type="date" value={consultantForm.startDate} onChange={(e) => setConsultantForm({ ...consultantForm, startDate: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div className="col-span-2"><label className={`${styles.textMuted} text-sm block mb-1`}>Notes</label><textarea rows={3} value={consultantForm.notes} onChange={(e) => setConsultantForm({ ...consultantForm, notes: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg resize-none`} /></div></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-5 py-2.5 ${styles.button} rounded-lg`}>Cancel</button><button onClick={updateConsultant} className={`flex-1 px-5 py-2.5 ${styles.buttonPrimary} rounded-lg`}>Save</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Clients Modal - Admin only */}
            {showClientsModal && selectedConsultant && canAssign && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${styles.text}`}>Manage Clients</h2><button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`p-3 rounded-lg border ${styles.warning} text-sm`}>
                                <strong>Auto-sync enabled:</strong> Assignments sync to Projects & Clients pages
                            </div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><Users className={`w-5 h-5 ${styles.accent}`} />Assigned</h3>{getConsultantClients(selectedConsultant.consultantId).length === 0 ? <p className={`${styles.textSubtle} text-center py-4`}>No clients assigned</p> : <div className="space-y-2">{getConsultantClients(selectedConsultant.consultantId).map(c => <div key={c.customerId} className={`flex items-center justify-between p-3 ${styles.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${styles.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${styles.textMuted} text-sm`}>{c.email}</p></div></div><button onClick={() => removeClient(c.customerId)} className="p-2 hover:bg-red-500/20 rounded-lg" title="Remove"><UserMinus className="w-5 h-5 text-red-500" /></button></div>)}</div>}</div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><UserPlus className={`w-5 h-5 ${styles.accent}`} />Available</h3>{getAvailableClients(selectedConsultant.consultantId).length === 0 ? <p className={`${styles.textSubtle} text-center py-4`}>All clients assigned</p> : <div className="space-y-2">{getAvailableClients(selectedConsultant.consultantId).map(c => <div key={c.customerId} className={`flex items-center justify-between p-3 ${styles.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${styles.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${styles.textMuted} text-sm`}>{c.clientCode}</p></div></div><button onClick={() => assignClient(c.customerId)} className={`px-4 py-2 ${styles.buttonPrimary} rounded-lg flex items-center gap-2`}><Link2 className="w-4 h-4" />Assign</button></div>)}</div>}</div>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`w-full px-5 py-2.5 ${styles.button} rounded-lg`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Projects Modal - Admin only */}
            {showProjectsModal && selectedConsultant && canAssign && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${styles.text}`}>Manage Projects</h2><button onClick={() => { setShowProjectsModal(false); setShowDetailsModal(true); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`p-3 rounded-lg border ${styles.warning} text-sm`}>
                                <strong>Auto-sync enabled:</strong> Consultant will be linked to all clients on the project
                            </div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><FolderOpen className={`w-5 h-5 ${styles.accent}`} />Assigned</h3>{getConsultantProjects(selectedConsultant.consultantId).length === 0 ? <p className={`${styles.textSubtle} text-center py-4`}>No projects assigned</p> : <div className="space-y-2">{getConsultantProjects(selectedConsultant.consultantId).map(p => <div key={p.projectId} className={`flex items-center justify-between p-3 ${styles.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white"><FolderOpen className="w-5 h-5" /></div><div><p className={`${styles.text} font-medium`}>{p.projectName}</p><p className={`${styles.textMuted} text-sm`}>{formatHours(getProjectHours(selectedConsultant.consultantId, p.projectId))} logged</p></div></div><button onClick={() => removeProject(p.projectId)} className="p-2 hover:bg-red-500/20 rounded-lg" title="Remove"><Unlink className="w-4 h-4 text-red-500" /></button></div>)}</div>}</div>
                            <div><h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><FolderPlus className={`w-5 h-5 ${styles.accent}`} />Available</h3>{getAvailableProjects(selectedConsultant.consultantId).length === 0 ? <p className={`${styles.textSubtle} text-center py-4`}>All projects assigned</p> : <div className="space-y-2">{getAvailableProjects(selectedConsultant.consultantId).map(p => <div key={p.projectId} className={`flex items-center justify-between p-3 ${styles.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white"><FolderOpen className="w-5 h-5" /></div><div><p className={`${styles.text} font-medium`}>{p.projectName}</p><p className={`${styles.textMuted} text-sm`}>{p.status || 'No status'}</p></div></div><button onClick={() => assignProject(p.projectId)} className={`px-4 py-2 ${styles.buttonPrimary} rounded-lg flex items-center gap-2`}><Link2 className="w-4 h-4" />Assign</button></div>)}</div>}</div>
                            <button onClick={() => { setShowProjectsModal(false); setShowDetailsModal(true); }} className={`w-full px-5 py-2.5 ${styles.button} rounded-lg`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Time Tracking Modal - Admin and Consultant */}
            {showTimeTrackingModal && selectedConsultant && canLogTime && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${styles.text}`}>Log Time</h2><button onClick={() => { setShowTimeTrackingModal(false); setShowDetailsModal(true); setIsTimerRunning(false); setTimerSeconds(0); }} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`${styles.cardInner} rounded-lg p-5`}>
                                <h3 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}><Timer className={`w-5 h-5 ${styles.accent}`} />Live Timer</h3>
                                <div className="text-center">
                                    <div className={`text-5xl font-mono font-bold ${styles.text} mb-4`}>{formatTimerDisplay(timerSeconds)}</div>
                                    {!isTimerRunning ? (
                                        <div className="space-y-3">
                                            <select value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="">Select Project</option>{getConsultantProjects(selectedConsultant.consultantId).map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select>
                                            <button onClick={() => timerProjectId && startTimer(timerProjectId)} disabled={!timerProjectId} className={`w-full px-5 py-2.5 ${styles.buttonPrimary} rounded-lg disabled:opacity-50 flex items-center justify-center gap-2`}><Play className="w-5 h-5" />Start Timer</button>
                                        </div>
                                    ) : (
                                        <button onClick={stopTimer} className="w-full px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"><Pause className="w-5 h-5" />Stop & Log</button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><Clock className={`w-5 h-5 ${styles.accent}`} />Manual Entry</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2"><label className={`${styles.textMuted} text-sm block mb-1`}>Project *</label><select value={timeForm.projectId} onChange={(e) => setTimeForm({ ...timeForm, projectId: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="">Select project</option>{getConsultantProjects(selectedConsultant.consultantId).map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                                    <div><label className={`${styles.textMuted} text-sm block mb-1`}>Date</label><input type="date" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div>
                                    <div className="flex gap-2"><div className="flex-1"><label className={`${styles.textMuted} text-sm block mb-1`}>Hours</label><input type="number" min="0" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div><div className="flex-1"><label className={`${styles.textMuted} text-sm block mb-1`}>Minutes</label><select value={timeForm.minutes} onChange={(e) => setTimeForm({ ...timeForm, minutes: parseInt(e.target.value) })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value={0}>0</option><option value={15}>15</option><option value={30}>30</option><option value={45}>45</option></select></div></div>
                                    <div className="col-span-2"><label className={`${styles.textMuted} text-sm block mb-1`}>Description</label><textarea rows={2} value={timeForm.description} onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg resize-none`} placeholder="What did you work on?" /></div>
                                </div>
                                <button onClick={logTime} disabled={loading || !timeForm.projectId} className={`w-full mt-4 px-5 py-2.5 ${styles.buttonPrimary} rounded-lg disabled:opacity-50 flex items-center justify-center gap-2`}><Save className="w-5 h-5" />{loading ? 'Saving...' : 'Log Time'}</button>
                            </div>
                            <div>
                                <h3 className={`${styles.text} font-semibold mb-3 flex items-center gap-2`}><Clock className={`w-5 h-5 ${styles.accent}`} />Recent Entries</h3>
                                {getConsultantHours(selectedConsultant.consultantId).length === 0 ? <p className={`${styles.textSubtle} text-center py-4`}>No time entries yet</p> : <div className="space-y-2 max-h-48 overflow-y-auto">{getConsultantHours(selectedConsultant.consultantId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(l => <div key={l.logId} className={`flex items-center justify-between p-3 ${styles.cardInner} rounded-lg`}><div className="flex-1 min-w-0"><p className={`${styles.text} text-sm font-medium truncate`}>{getProjectName(l.projectId)}</p><p className={`${styles.textSubtle} text-xs`}>{formatDate(l.date)} - {l.description || 'No description'}</p></div><div className="flex items-center gap-2 ml-4"><span className={`${styles.accent} text-sm font-medium`}>{formatHours(l.hours)}</span><button onClick={() => deleteHoursLog(l.logId)} className="p-1 hover:bg-red-500/20 rounded" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button></div></div>)}</div>}
                            </div>
                            <button onClick={() => { setShowTimeTrackingModal(false); setShowDetailsModal(true); setIsTimerRunning(false); setTimerSeconds(0); }} className={`w-full px-5 py-2.5 ${styles.button} rounded-lg`}>Back</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultantsPage;