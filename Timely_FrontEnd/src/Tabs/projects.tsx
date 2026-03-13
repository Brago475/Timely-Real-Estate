// src/Tabs/projects.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Calendar, Plus, Search, Filter, ChevronRight, ChevronLeft, Clock, Users, FileText, CheckCircle2, AlertCircle, Target, TrendingUp, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, UserMinus, FolderOpen, Link2, RefreshCw, Edit2, CheckCircle, Info, List, LayoutGrid, Timer, Play, Pause, Save } from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

const API_BASE = '/api';

const STORAGE_KEYS = {
    projects: 'timely_projects',
    timeEntries: 'timely_time_entries'
};

const fmtStatus = (s: string): string => {
    if (!s) return "Planning";
    return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

interface Project { projectId: string; projectCode: string; projectName: string; clientName?: string; description: string; status: string; priority: string; startDate: string; endDate: string; budget: string; createdAt: string; createdBy?: string; }
interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; }
interface Client { customerId: string; clientCode: string; firstName: string; lastName: string; email: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface TimeEntry { id: string; projectId: string; consultantId: string; consultantName: string; date: string; hours: number; minutes: number; description: string; createdAt: string; }

type UserRole = 'admin' | 'consultant' | 'client';

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch { return null; } };

const getCurrentUserRole = (): { role: UserRole; email: string; customerId?: string; name?: string; consultantId?: string } => {
    try {
        const raw = localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: 'admin@timely.com' };
        const parsed = JSON.parse(raw);
        const r = (parsed.role || 'client').toLowerCase();
        if (r === 'admin' || r === 'consultant' || r === 'client') {
            return { role: r, email: parsed.email || '', customerId: parsed.customerId, name: parsed.name, consultantId: parsed.consultantId || parsed.customerId };
        }
        return { role: 'client', email: parsed.email || '' };
    } catch { return { role: 'admin', email: 'admin@timely.com' }; }
};

const RealEstateProjects: React.FC = () => {
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
        modal: isDark ? 'bg-[#111111] border-gray-800' : 'bg-[#e4e4e4] border-gray-300',
        modalHead: isDark ? 'bg-[#111111]' : 'bg-[#e4e4e4]',
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

    const { role: userRole, email: userEmail, customerId: userCustomerId, name: userName, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';
    const canEdit = isAdmin || isConsultant;

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const [projects, setProjects] = useState<Project[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);

    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showConsultantsModal, setShowConsultantsModal] = useState(false);
    const [showClientsModal, setShowClientsModal] = useState(false);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sortConfig, setSortConfig] = useState({ field: 'createdAt', direction: 'desc' as 'asc' | 'desc' });
    const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
    const [ganttStartDate, setGanttStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });

    const [timeForm, setTimeForm] = useState({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });
    const [activeTimer, setActiveTimer] = useState<{ projectId: string; startTime: number } | null>(null);
    const [timerDisplay, setTimerDisplay] = useState('00:00:00');

    const emptyForm = { projectName: '', description: '', status: 'planning', priority: 'medium', startDate: new Date().toISOString().split('T')[0], endDate: '', budget: '', selectedConsultants: [] as string[], selectedClients: [] as string[] };
    const [projectForm, setProjectForm] = useState(emptyForm);

    const statuses = [
        { value: 'planning', label: 'Planning', color: 'bg-blue-600', icon: Target },
        { value: 'in_progress', label: 'In Progress', color: 'bg-emerald-600', icon: TrendingUp },
        { value: 'active', label: 'Active', color: 'bg-emerald-600', icon: TrendingUp },
        { value: 'on_hold', label: 'On Hold', color: 'bg-amber-600', icon: Clock },
        { value: 'completed', label: 'Completed', color: 'bg-gray-600', icon: CheckCircle2 },
        { value: 'cancelled', label: 'Cancelled', color: 'bg-red-600', icon: X },
    ];

    useEffect(() => {
        const unsubscribe = AssignmentService.subscribe(() => setAssignmentRefreshKey(k => k + 1));
        const handleCustomEvent = () => setAssignmentRefreshKey(k => k + 1);
        window.addEventListener('assignment-change', handleCustomEvent);
        return () => { unsubscribe(); window.removeEventListener('assignment-change', handleCustomEvent); };
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTimer) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000);
                const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
                setTimerDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimer]);

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setRefreshing(true);
        await Promise.all([loadProjects(), loadConsultants(), loadClients()]);
        loadTimeEntries();
        AssignmentService.syncClientConsultantsFromAPI();
        setRefreshing(false);
    };

    const loadProjects = async () => {
        const d = await safeFetch(`${API_BASE}/projects`);
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        if (d?.data) {
            const all = [...d.data, ...local.filter((l: Project) => !d.data.find((a: Project) => a.projectId === l.projectId))];
            setProjects(all);
        } else { setProjects(local); }
    };

    const loadConsultants = async () => { const d = await safeFetch(`${API_BASE}/consultants`); if (d?.data) setConsultants(d.data); };
    const loadClients = async () => { const d = await safeFetch(`${API_BASE}/users-report`); if (d?.data) setClients(d.data); };
    const loadTimeEntries = () => { try { const data = localStorage.getItem(STORAGE_KEYS.timeEntries); if (data) setTimeEntries(JSON.parse(data)); } catch (e) { console.error(e); } };
    const saveTimeEntries = (data: TimeEntry[]) => { localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data)); setTimeEntries(data); };

    const saveProjectToStorage = (updatedProject: Project) => {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        const idx = local.findIndex((p: Project) => p.projectId === updatedProject.projectId);
        if (idx !== -1) { local[idx] = updatedProject; } else { local.push(updatedProject); }
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(local));
    };

    const getClientNameFromSelection = () => {
        if (projectForm.selectedClients.length === 0) return '';
        const c = clients.find(c => c.customerId === projectForm.selectedClients[0]);
        return c ? `${c.firstName} ${c.lastName}` : '';
    };

    const createProject = async () => {
        if (!isAdmin) { showToast('Only admins can create projects', 'error'); return; }
        if (!projectForm.projectName) { showToast('Project name is required', 'error'); return; }
        setLoading(true);
        const clientName = getClientNameFromSelection();
        const selectedConsultantIds = [...projectForm.selectedConsultants];
        const selectedClientIds = [...projectForm.selectedClients];

        try {
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: projectForm.projectName, clientName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget, createdBy: userEmail }),
            });
            if (res.ok) {
                const data = await res.json();
                const newProjectId = String(data.projectId || data.data?.projectId || data.id || data.data?.id);
                if (selectedConsultantIds.length > 0 || selectedClientIds.length > 0) {
                    AssignmentService.setupProjectAssignments(newProjectId, selectedConsultantIds, selectedClientIds);
                }
                showToast('Project created!', 'success');
                setShowCreateModal(false); resetForm(); await loadProjects(); setLoading(false);
                return;
            }
        } catch (err) { console.error('API Error:', err); }

        const timestamp = Date.now();
        const newProject: Project = { projectId: String(timestamp), projectCode: `PRJ-${String(timestamp).slice(-6)}`, projectName: projectForm.projectName, clientName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget, createdAt: new Date().toISOString(), createdBy: userEmail };
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([...local, newProject]));
        if (selectedConsultantIds.length > 0 || selectedClientIds.length > 0) {
            AssignmentService.setupProjectAssignments(String(timestamp), selectedConsultantIds, selectedClientIds);
        }
        setShowCreateModal(false); resetForm(); loadProjects(); setLoading(false);
        showToast('Project created!', 'success');
    };

    const updateProject = async () => {
        if (!selectedProject || !canEdit) { showToast('No permission', 'error'); return; }
        const updated = { ...selectedProject, projectName: projectForm.projectName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget };
        try { await fetch(`${API_BASE}/project-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: updated.projectId, status: updated.status, priority: updated.priority, description: updated.description }) }); } catch {}
        saveProjectToStorage(updated);
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        setShowEditModal(false); setShowDetailsModal(true);
        showToast('Project updated', 'success');
    };

    const updateProjectStatus = async (projectId: string, newStatus: string) => {
        if (!canEdit) { showToast('No permission', 'error'); return; }
        const project = projects.find(p => p.projectId === projectId);
        if (!project) return;
        const updated = { ...project, status: newStatus };
        try { await fetch(`${API_BASE}/project-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, status: newStatus }) }); } catch (err) { console.error('Failed to sync status:', err); }
        saveProjectToStorage(updated);
        setProjects(projects.map(p => p.projectId === projectId ? updated : p));
        if (selectedProject?.projectId === projectId) setSelectedProject(updated);
        setShowStatusMenu(null);
        showToast(`Status → ${fmtStatus(newStatus)}`, 'success');
    };

    const deleteProject = async (pid: string) => {
        if (!isAdmin) { showToast('Only admins can delete', 'error'); return; }
        try {
            const res = await fetch(`${API_BASE}/projects/${pid}`, { method: 'DELETE' });
            if (res.ok) { AssignmentService.cleanupProjectAssignments(pid); showToast('Project deleted', 'success'); setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedProject(null); setProjects(prev => prev.filter(p => p.projectId !== pid)); return; }
        } catch { }
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(local.filter((p: Project) => p.projectId !== pid)));
        AssignmentService.cleanupProjectAssignments(pid);
        saveTimeEntries(timeEntries.filter(te => te.projectId !== pid));
        setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedProject(null); loadProjects();
        showToast('Project deleted', 'success');
    };

    const startTimer = (projectId: string) => { if (!canEdit) { showToast('Only consultants can track time', 'error'); return; } setActiveTimer({ projectId, startTime: Date.now() }); showToast('Timer started', 'info'); };
    const stopTimer = () => { if (!activeTimer) return; const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000); setTimeForm({ hours: Math.floor(elapsed / 3600), minutes: Math.floor((elapsed % 3600) / 60), description: '', date: new Date().toISOString().split('T')[0] }); setSelectedProject(projects.find(p => p.projectId === activeTimer.projectId) || null); setActiveTimer(null); setTimerDisplay('00:00:00'); setShowTimeModal(true); };

    const addTimeEntry = () => {
        if (!selectedProject || !canEdit) return;
        if (timeForm.hours === 0 && timeForm.minutes === 0) { showToast('Enter time worked', 'error'); return; }
        const entry: TimeEntry = { id: `time_${Date.now()}`, projectId: selectedProject.projectId, consultantId: userConsultantId || userEmail, consultantName: userName || userEmail, date: timeForm.date, hours: timeForm.hours, minutes: timeForm.minutes, description: timeForm.description, createdAt: new Date().toISOString() };
        saveTimeEntries([...timeEntries, entry]);
        setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });
        setShowTimeModal(false);
        showToast(`Logged ${timeForm.hours}h ${timeForm.minutes}m`, 'success');
    };

    const deleteTimeEntry = (id: string) => {
        const entry = timeEntries.find(e => e.id === id);
        if (!entry) return;
        if (!isAdmin && entry.consultantId !== (userConsultantId || userEmail)) { showToast('Can only delete your own entries', 'error'); return; }
        saveTimeEntries(timeEntries.filter(e => e.id !== id));
        showToast('Entry deleted', 'success');
    };

    const getProjectTimeEntries = (pid: string) => timeEntries.filter(te => te.projectId === pid);
    const getProjectTotalTime = (pid: string) => { const entries = getProjectTimeEntries(pid); const totalMin = entries.reduce((s, e) => s + (e.hours * 60) + e.minutes, 0); return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 }; };

    const assignConsultantToProject = (cid: string) => { if (!isAdmin || !selectedProject) return; const r = AssignmentService.assignConsultantToProject(selectedProject.projectId, cid); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeConsultantFromProject = (cid: string) => { if (!isAdmin || !selectedProject) return; AssignmentService.removeConsultantFromProject(selectedProject.projectId, cid); showToast('Removed', 'success'); };
    const assignClientToProject = (cid: string) => { if (!isAdmin || !selectedProject) return; const r = AssignmentService.assignClientToProject(selectedProject.projectId, cid); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeClientFromProject = (cid: string) => { if (!isAdmin || !selectedProject) return; AssignmentService.removeClientFromProject(selectedProject.projectId, cid); showToast('Removed', 'success'); };

    const getProjectConsultants = (pid: string) => { const ids = AssignmentService.getConsultantsForProject(String(pid)); return consultants.filter(c => ids.includes(c.consultantId)); };
    const getProjectClients = (pid: string) => { const ids = AssignmentService.getClientsForProject(String(pid)); return clients.filter(c => ids.includes(c.customerId)); };
    const getAvailableConsultants = (pid: string) => { const ids = AssignmentService.getConsultantsForProject(pid); return consultants.filter(c => !ids.includes(c.consultantId)); };
    const getAvailableClients = (pid: string) => { const ids = AssignmentService.getClientsForProject(pid); return clients.filter(c => !ids.includes(c.customerId)); };

    const resetForm = () => setProjectForm(emptyForm);
    const openProjectDetails = (p: Project) => { setSelectedProject(p); setProjectForm({ projectName: p.projectName, description: p.description || '', status: p.status, priority: p.priority || 'medium', startDate: p.startDate || '', endDate: p.endDate || '', budget: p.budget || '', selectedConsultants: [], selectedClients: [] }); setShowDetailsModal(true); };

    const filteredProjects = useMemo(() => {
        let filtered = projects;
        if (isClient && userCustomerId) { const ids = AssignmentService.getProjectsForClient(userCustomerId); filtered = filtered.filter(p => ids.includes(String(p.projectId))); }
        if (isConsultant && userConsultantId) { const ids = AssignmentService.getProjectsForConsultant(userConsultantId); filtered = filtered.filter(p => ids.includes(String(p.projectId))); }
        filtered = filtered.filter(p => {
            const matchSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || (p.projectCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchSearch && matchStatus;
        });
        filtered.sort((a, b) => {
            let aV: any, bV: any;
            switch (sortConfig.field) { case 'name': aV = a.projectName.toLowerCase(); bV = b.projectName.toLowerCase(); break; case 'status': aV = a.status; bV = b.status; break; default: aV = new Date(a.createdAt || 0).getTime(); bV = new Date(b.createdAt || 0).getTime(); }
            return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
        });
        return filtered;
    }, [projects, searchTerm, statusFilter, sortConfig, isClient, isConsultant, userCustomerId, userConsultantId, assignmentRefreshKey]);

    const pStats = useMemo(() => ({ total: filteredProjects.length, planning: filteredProjects.filter(p => p.status === 'planning').length, active: filteredProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length, completed: filteredProjects.filter(p => p.status === 'completed').length }), [filteredProjects]);

    const getStatusColor = (st: string) => statuses.find(s => s.value === st)?.color || 'bg-gray-600';
    const getPriorityColor = (p: string) => ({ low: 'text-gray-400', medium: 'text-amber-400', high: 'text-orange-400', urgent: 'text-red-400' }[p] || 'text-gray-400');
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
    const formatBudget = (b: string) => b ? `$${Number(b).toLocaleString()}` : '—';
    const formatTime = (h: number, m: number) => `${h}h ${m}m`;
    const toggleSort = (f: string) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }));
    const getSortIcon = (f: string) => sortConfig.field !== f ? <ArrowUpDown className={`w-3.5 h-3.5 ${n.tertiary}`} /> : sortConfig.direction === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${n.label}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${n.label}`} />;

    const ganttDays = useMemo(() => { const days = []; const start = new Date(ganttStartDate); for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); } return days; }, [ganttStartDate]);
    const getProjectBarStyle = (project: Project) => { if (!project.startDate) return null; const start = new Date(project.startDate); const end = project.endDate ? new Date(project.endDate) : new Date(start.getTime() + 7 * 86400000); const gs = ganttDays[0]; const ge = ganttDays[ganttDays.length - 1]; if (end < gs || start > ge) return null; const startOff = Math.max(0, Math.floor((start.getTime() - gs.getTime()) / 86400000)); const dur = Math.min(42 - startOff, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1); return { left: `${(startOff / 42) * 100}%`, width: `${(Math.max(dur, 1) / 42) * 100}%` }; };
    const navigateGantt = (dir: 'prev' | 'next') => { const d = new Date(ganttStartDate); d.setDate(d.getDate() + (dir === 'next' ? 14 : -14)); setGanttStartDate(d); };
    const updateProjectDates = (pid: string, newStart: Date) => { if (!canEdit) return; const p = projects.find(p => p.projectId === pid); if (!p) return; const dur = p.startDate && p.endDate ? Math.ceil((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000) : 7; const newEnd = new Date(newStart); newEnd.setDate(newEnd.getDate() + dur); const updated = { ...p, startDate: newStart.toISOString().split('T')[0], endDate: newEnd.toISOString().split('T')[0] }; saveProjectToStorage(updated); setProjects(projects.map(pr => pr.projectId === pid ? updated : pr)); showToast('Dates updated', 'success'); };

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

            {/* Timer */}
            {activeTimer && (
                <div className="fixed bottom-4 right-4 z-[9998]">
                    <div className={`${n.card} p-4 flex items-center gap-4`}>
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div>
                            <p className={`${n.text} font-mono text-xl`}>{timerDisplay}</p>
                            <p className={`${n.tertiary} text-xs`}>{projects.find(p => p.projectId === activeTimer.projectId)?.projectName}</p>
                        </div>
                        <button onClick={stopTimer} className={`px-4 py-2 ${n.btnDanger} rounded-lg flex items-center gap-2 text-sm`}><Pause className="w-4 h-4" />Stop</button>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-md w-full p-6`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                            <h3 className={`text-lg font-semibold ${n.text}`}>Delete Project?</h3>
                        </div>
                        <p className={`${n.secondary} text-sm mb-6`}>This permanently removes the project, assignments, and time entries.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                            <button onClick={() => deleteProject(showDeleteConfirm)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Projects</h1>
                            <p className={`text-sm ${n.secondary}`}>{isAdmin ? 'Manage all projects and assignments' : isConsultant ? 'Track time and update status' : 'View your assigned projects'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {canEdit && (
                                <div className={`${n.card} p-0.5 flex rounded-xl`}>
                                    <button onClick={() => setViewMode('list')} className={`px-3 py-2 flex items-center gap-1.5 text-xs rounded-lg transition-all ${viewMode === 'list' ? n.btnPrimary : n.secondary}`}><List className="w-3.5 h-3.5" />List</button>
                                    <button onClick={() => setViewMode('gantt')} className={`px-3 py-2 flex items-center gap-1.5 text-xs rounded-lg transition-all ${viewMode === 'gantt' ? n.btnPrimary : n.secondary}`}><LayoutGrid className="w-3.5 h-3.5" />Gantt</button>
                                </div>
                            )}
                            <button onClick={loadAllData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                            {isAdmin && <button onClick={() => setShowCreateModal(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm`}><Plus className="w-4 h-4" />New Project</button>}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex gap-3 items-center mb-6">
                        <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                            <Search className={`w-4 h-4 ${n.tertiary}`} />
                            <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.pressed : n.flat} flex items-center justify-center`}><Filter className={`w-4 h-4 ${n.secondary}`} /></button>
                    </div>

                    {showFilters && (
                        <div className={`${n.card} p-4 mb-6`}>
                            <label className={`${n.tertiary} text-xs block mb-2`}>Status</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm focus:outline-none`}>
                                <option value="all">All</option>
                                {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total', value: pStats.total, icon: FolderOpen },
                            { label: 'Planning', value: pStats.planning, icon: Target },
                            { label: 'Active', value: pStats.active, icon: TrendingUp },
                            { label: 'Completed', value: pStats.completed, icon: CheckCircle2 },
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

                {/* List View */}
                {viewMode === 'list' && (
                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                        {/* Table Header */}
                        <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                            <div className={`col-span-3 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('name')}>Project {getSortIcon('name')}</div>
                            <div className={`col-span-2 text-xs ${n.label}`}>Client / Team</div>
                            <div className={`col-span-2 text-xs ${n.label}`}>Timeline</div>
                            <div className={`col-span-1 text-xs ${n.label}`}>Time</div>
                            <div className={`col-span-2 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('status')}>Status {getSortIcon('status')}</div>
                            <div className={`col-span-2 text-xs ${n.label} text-right`}>Actions</div>
                        </div>

                        {filteredProjects.length === 0 ? (
                            <div className={`${n.flat} text-center py-16`}>
                                <FolderOpen className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} />
                                <p className={`text-sm ${n.secondary}`}>{isClient || isConsultant ? 'No projects assigned to you yet' : 'No projects found'}</p>
                            </div>
                        ) : filteredProjects.map(p => {
                            const totalTime = getProjectTotalTime(p.projectId);
                            const pClients = getProjectClients(p.projectId);
                            const pConsultants = getProjectConsultants(p.projectId);
                            return (
                                <div key={p.projectId} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                                    <div className="col-span-3 flex items-center gap-3 cursor-pointer" onClick={() => openProjectDetails(p)}>
                                        <div className={`w-9 h-9 rounded-xl ${n.inset} flex items-center justify-center flex-shrink-0`}>
                                            <FolderOpen className={`w-4 h-4 ${n.secondary}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`${n.text} text-sm font-medium truncate`}>{p.projectName}</p>
                                            <p className={`${n.tertiary} text-[11px]`}>{p.projectCode}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center">
                                        <span className={`${n.secondary} text-sm truncate`}>
                                            {pClients.length > 0 ? `${pClients[0].firstName} ${pClients[0].lastName}${pClients.length > 1 ? ` +${pClients.length - 1}` : ''}` : p.clientName || `${pConsultants.length + pClients.length} members`}
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex items-center"><span className={`${n.secondary} text-sm`}>{p.startDate ? formatDate(p.startDate) : '—'}</span></div>
                                    <div className="col-span-1 flex items-center"><span className={`${n.secondary} text-sm flex items-center gap-1`}><Clock className="w-3 h-3" />{formatTime(totalTime.hours, totalTime.minutes)}</span></div>
                                    <div className="col-span-2 relative flex items-center">
                                        <button onClick={(e) => { e.stopPropagation(); if (canEdit) setShowStatusMenu(showStatusMenu === p.projectId ? null : p.projectId); }} className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge} ${canEdit ? 'cursor-pointer' : ''}`} disabled={!canEdit}>
                                            {fmtStatus(p.status)}{canEdit && <ChevronRight className={`w-3 h-3 inline ml-0.5 transition-transform ${showStatusMenu === p.projectId ? 'rotate-90' : ''}`} />}
                                        </button>
                                        {showStatusMenu === p.projectId && canEdit && (
                                            <div className={`absolute top-full left-0 mt-1 ${n.modal} border rounded-xl shadow-lg z-50 py-1 min-w-[150px]`}>
                                                {statuses.map(st => (
                                                    <button key={st.value} onClick={(e) => { e.stopPropagation(); updateProjectStatus(p.projectId, st.value); }} className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} ${p.status === st.value ? n.label : n.secondary}`}>
                                                        <div className={`w-2 h-2 rounded-full ${st.color}`} />{st.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-1">
                                        {canEdit && !activeTimer && <button onClick={(e) => { e.stopPropagation(); startTimer(p.projectId); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`} title="Start Timer"><Play className="w-3.5 h-3.5 text-emerald-400" /></button>}
                                        {canEdit && <button onClick={(e) => { e.stopPropagation(); setSelectedProject(p); setShowTimeModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`} title="Log Time"><Timer className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>}
                                        <button onClick={() => openProjectDetails(p)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`}><Edit2 className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>
                                        {isAdmin && <button onClick={() => setShowDeleteConfirm(p.projectId)} className={`p-2 rounded-lg hover:bg-red-500/20 transition-colors`}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* Gantt View */}
                {viewMode === 'gantt' && canEdit && (
                    <div className={`${n.card} overflow-hidden`}>
                        <div className={`p-4 border-b ${n.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => navigateGantt('prev')} className={`w-8 h-8 ${n.flat} flex items-center justify-center`}><ChevronLeft className="w-4 h-4" /></button>
                                <span className={`${n.text} text-sm font-medium`}>{ganttDays[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — {ganttDays[ganttDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <button onClick={() => navigateGantt('next')} className={`w-8 h-8 ${n.flat} flex items-center justify-center`}><ChevronRight className="w-4 h-4" /></button>
                            </div>
                            <button onClick={() => setGanttStartDate(() => { const d = new Date(); d.setDate(1); return d; })} className={`px-3 py-1.5 ${n.flat} text-xs ${n.secondary}`}>Today</button>
                        </div>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1200px]">
                                <div className={`flex border-b ${n.divider}`}>
                                    <div className={`w-48 flex-shrink-0 p-3 border-r ${n.divider}`}><span className={`${n.label} text-xs`}>Project</span></div>
                                    <div className="flex-1 flex">{ganttDays.map((day, i) => (
                                        <div key={i} className={`flex-1 min-w-[24px] p-1 text-center border-r ${n.divider} ${day.getDay() === 0 || day.getDay() === 6 ? (isDark ? 'bg-gray-900' : 'bg-gray-200') : ''}`}>
                                            <div className={`text-[9px] ${n.tertiary}`}>{day.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</div>
                                            <div className={`text-[10px] ${day.toDateString() === new Date().toDateString() ? 'text-blue-400 font-bold' : n.tertiary}`}>{day.getDate()}</div>
                                        </div>
                                    ))}</div>
                                </div>
                                {filteredProjects.length === 0 ? (
                                    <div className="text-center py-16"><FolderOpen className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`text-sm ${n.secondary}`}>No projects found</p></div>
                                ) : filteredProjects.map(p => {
                                    const barStyle = getProjectBarStyle(p);
                                    return (
                                        <div key={p.projectId} className={`flex border-b ${n.divider} ${isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-100'} transition-colors`}>
                                            <div className={`w-48 flex-shrink-0 p-3 border-r ${n.divider} flex items-center gap-2 cursor-pointer`} onClick={() => openProjectDetails(p)}>
                                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(p.status)}`} />
                                                <span className={`${n.text} text-sm truncate`}>{p.projectName}</span>
                                            </div>
                                            <div className="flex-1 relative h-12 flex items-center">
                                                <div className="absolute inset-0 flex">{ganttDays.map((day, i) => (
                                                    <div key={i} onClick={() => updateProjectDates(p.projectId, day)} className={`flex-1 min-w-[24px] border-r ${n.divider} cursor-pointer hover:bg-blue-500/10 ${day.getDay() === 0 || day.getDay() === 6 ? (isDark ? 'bg-gray-900/50' : 'bg-gray-100') : ''} ${day.toDateString() === new Date().toDateString() ? 'bg-blue-500/10' : ''}`} />
                                                ))}</div>
                                                {barStyle && (
                                                    <div className={`absolute h-6 ${getStatusColor(p.status)} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2`} style={{ left: barStyle.left, width: barStyle.width, minWidth: '60px' }} onClick={() => openProjectDetails(p)}>
                                                        <span className="text-white text-[10px] truncate">{p.projectName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={`p-4 border-t ${n.divider} flex items-center gap-5 flex-wrap`}>
                            {statuses.map(st => (<div key={st.value} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${st.color}`} /><span className={`${n.tertiary} text-xs`}>{st.label}</span></div>))}
                            <span className={`${n.tertiary} text-[10px] ml-auto`}>Click timeline to set start date</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ MODALS ═══ */}

            {/* Time Modal */}
            {showTimeModal && selectedProject && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                <Timer className="w-5 h-5 text-emerald-400" />
                                <div><h2 className={`text-lg font-semibold ${n.text}`}>Log Time</h2><p className={`text-xs ${n.tertiary}`}>{selectedProject.projectName}</p></div>
                            </div>
                            <button onClick={() => { setShowTimeModal(false); setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] }); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className={`${n.card} p-4 space-y-4`}>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Hours</label><input type="number" min="0" max="24" value={timeForm.hours} onChange={e => setTimeForm({ ...timeForm, hours: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Minutes</label><input type="number" min="0" max="59" value={timeForm.minutes} onChange={e => setTimeForm({ ...timeForm, minutes: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Date</label><input type="date" value={timeForm.date} onChange={e => setTimeForm({ ...timeForm, date: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                </div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={2} value={timeForm.description} onChange={e => setTimeForm({ ...timeForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="What did you work on?" /></div>
                                <button onClick={addTimeEntry} className={`w-full px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}><Save className="w-4 h-4" />Log Time</button>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Entries</span>
                                    <span className={`${n.secondary} text-xs`}>Total: {formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</span>
                                </div>
                                {getProjectTimeEntries(selectedProject.projectId).length === 0 ? (
                                    <p className={`${n.tertiary} text-center py-4 text-sm`}>No time logged yet</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                        {getProjectTimeEntries(selectedProject.projectId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                                            <div key={entry.id} className={`${n.flat} p-3 flex items-center justify-between`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{entry.consultantName.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                                                    <div>
                                                        <p className={`${n.text} text-sm font-medium`}>{formatTime(entry.hours, entry.minutes)}</p>
                                                        <p className={`${n.tertiary} text-[11px]`}>{entry.consultantName} · {new Date(entry.date).toLocaleDateString()}</p>
                                                        {entry.description && <p className={`${n.secondary} text-xs mt-0.5`}>{entry.description}</p>}
                                                    </div>
                                                </div>
                                                {(isAdmin || entry.consultantId === (userConsultantId || userEmail)) && <button onClick={() => deleteTimeEntry(entry.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>New Project</h2>
                            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Project Name *</label><input type="text" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="Enter project name" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Priority</label><select value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Start Date</label><input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>End Date</label><input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Budget</label><input type="number" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} placeholder="Enter budget" /></div>
                            </div>
                            {/* Assign Clients */}
                            <div>
                                <label className={`${n.label} text-[11px] block mb-2 flex items-center gap-1.5`}><Users className="w-3.5 h-3.5" />Assign Clients {projectForm.selectedClients.length > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.btnPrimary}`}>{projectForm.selectedClients.length}</span>}</label>
                                <div className={`${n.card} p-2 max-h-36 overflow-y-auto space-y-1`}>
                                    {clients.length === 0 ? <p className={`${n.tertiary} text-xs p-2`}>No clients available</p> : clients.map(c => (
                                        <label key={c.customerId} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} ${projectForm.selectedClients.includes(c.customerId) ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50') : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedClients.includes(c.customerId)} onChange={(e) => setProjectForm({ ...projectForm, selectedClients: e.target.checked ? [...projectForm.selectedClients, c.customerId] : projectForm.selectedClients.filter(id => id !== c.customerId) })} className="w-4 h-4 accent-blue-600" />
                                            <div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</span><span className={`${n.tertiary} text-[10px] block`}>{c.clientCode}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {/* Assign Consultants */}
                            <div>
                                <label className={`${n.label} text-[11px] block mb-2 flex items-center gap-1.5`}><Users className="w-3.5 h-3.5" />Assign Consultants {projectForm.selectedConsultants.length > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.btnPrimary}`}>{projectForm.selectedConsultants.length}</span>}</label>
                                <div className={`${n.card} p-2 max-h-36 overflow-y-auto space-y-1`}>
                                    {consultants.length === 0 ? <p className={`${n.tertiary} text-xs p-2`}>No consultants available</p> : consultants.map(c => (
                                        <label key={c.consultantId} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} ${projectForm.selectedConsultants.includes(c.consultantId) ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50') : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedConsultants.includes(c.consultantId)} onChange={(e) => setProjectForm({ ...projectForm, selectedConsultants: e.target.checked ? [...projectForm.selectedConsultants, c.consultantId] : projectForm.selectedConsultants.filter(id => id !== c.consultantId) })} className="w-4 h-4 accent-blue-600" />
                                            <div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</span><span className={`${n.tertiary} text-[10px] block`}>{c.consultantCode}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="Project description..." /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={createProject} disabled={loading} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2`}>{loading ? 'Creating...' : <><Plus className="w-4 h-4" />Create</>}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedProject && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${n.inset} rounded-xl flex items-center justify-center`}><FolderOpen className={`w-5 h-5 ${n.secondary}`} /></div>
                                <div><h2 className={`text-lg font-semibold ${n.text}`}>{selectedProject.projectName}</h2><p className={`text-xs ${n.tertiary}`}>{selectedProject.projectCode}</p></div>
                            </div>
                            <div className="flex items-center gap-1">
                                {isAdmin && <button onClick={() => setShowDeleteConfirm(selectedProject.projectId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>}
                                <button onClick={() => { setShowDetailsModal(false); setSelectedProject(null); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Status selector */}
                            <div>
                                <label className={`${n.label} text-[11px] block mb-2`}>Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {statuses.map(st => (
                                        <button key={st.value} onClick={() => canEdit && updateProjectStatus(selectedProject.projectId, st.value)} disabled={!canEdit} className={`px-3 py-2 rounded-xl flex items-center gap-2 text-sm transition-all ${selectedProject.status === st.value ? `${st.color} text-white` : `${n.flat} ${n.secondary}`} ${!canEdit ? 'opacity-50' : ''}`}>
                                            <st.icon className="w-3.5 h-3.5" />{st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Priority */}
                            <p className={`${getPriorityColor(selectedProject.priority || 'medium')} text-sm font-medium`}>{fmtStatus(selectedProject.priority || 'medium')} Priority</p>
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2">
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Edit2 className="w-3.5 h-3.5" />Edit</button>}
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowTimeModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 text-emerald-400 transition-all`}><Timer className="w-3.5 h-3.5" />Log Time</button>}
                                {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Users className="w-3.5 h-3.5" />Consultants</button>}
                                {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Users className="w-3.5 h-3.5" />Clients</button>}
                            </div>
                            {/* Info cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Time Tracked</span><p className={`text-xl font-semibold ${n.strong} mt-1`}>{formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</p><p className={`${n.tertiary} text-[11px]`}>{getProjectTimeEntries(selectedProject.projectId).length} entries</p></div>
                                <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Budget</span><p className={`text-xl font-semibold ${n.strong} mt-1`}>{formatBudget(selectedProject.budget)}</p></div>
                            </div>
                            <div className={`${n.card} p-4`}>
                                <span className={`${n.label} text-[11px]`}>Timeline</span>
                                <div className="flex gap-6 mt-2">
                                    <div><p className={`${n.tertiary} text-[10px]`}>Start</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.startDate)}</p></div>
                                    <div><p className={`${n.tertiary} text-[10px]`}>End</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.endDate)}</p></div>
                                </div>
                            </div>
                            {/* Consultants */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Consultants</span>{isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getProjectConsultants(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : <div className="flex flex-wrap gap-1.5">{getProjectConsultants(selectedProject.projectId).map(c => <span key={c.consultantId} className={`px-2.5 py-1 ${n.flat} ${n.text} text-xs rounded-lg`}>{c.firstName} {c.lastName}</span>)}</div>}
                            </div>
                            {/* Clients */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Clients</span>{isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getProjectClients(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : <div className="flex flex-wrap gap-1.5">{getProjectClients(selectedProject.projectId).map(c => <span key={c.customerId} className={`px-2.5 py-1 ${n.flat} ${n.text} text-xs rounded-lg`}>{c.firstName} {c.lastName}</span>)}</div>}
                            </div>
                            {selectedProject.description && <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Description</span><p className={`${n.text} text-sm mt-1 leading-relaxed`}>{selectedProject.description}</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedProject && canEdit && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Edit Project</h2>
                            <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Project Name</label><input type="text" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Priority</label><select value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Start Date</label><input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>End Date</label><input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Budget</label><input type="number" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={updateProject} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Consultants Modal */}
            {showConsultantsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Consultants</h2>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getProjectConsultants(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getProjectConsultants(selectedProject.projectId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                            </div>
                                            <button onClick={() => removeConsultantFromProject(c.consultantId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableConsultants(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableConsultants(selectedProject.projectId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.consultantCode}</p></div>
                                            </div>
                                            <button onClick={() => assignConsultantToProject(c.consultantId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clients Modal */}
            {showClientsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Clients</h2>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getProjectClients(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getProjectClients(selectedProject.projectId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                            </div>
                                            <button onClick={() => removeClientFromProject(c.customerId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableClients(selectedProject.projectId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableClients(selectedProject.projectId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.clientCode}</p></div>
                                            </div>
                                            <button onClick={() => assignClientToProject(c.customerId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RealEstateProjects;