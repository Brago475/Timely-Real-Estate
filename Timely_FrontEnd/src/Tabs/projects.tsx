// src/Tabs/projects.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Calendar, Plus, Search, Filter, ChevronRight, ChevronLeft, Clock, Users, FileText, CheckCircle2, AlertCircle, Target, TrendingUp, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, UserMinus, FolderOpen, Link2, RefreshCw, Edit2, CheckCircle, Info, List, LayoutGrid, Timer, Play, Pause, Save } from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

const API_BASE = 'http://localhost:4000/api';
const generateId = () => `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateProjectCode = () => `PRJ-${Date.now().toString().slice(-6)}`;

const STORAGE_KEYS = {
    projects: 'timely_projects',
    timeEntries: 'timely_time_entries'
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
    const s = {
        bg: isDark ? 'bg-slate-950' : 'bg-gray-50', text: isDark ? 'text-white' : 'text-gray-900', textMuted: isDark ? 'text-slate-400' : 'text-gray-600',
        textSubtle: isDark ? 'text-slate-500' : 'text-gray-400', card: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        cardHover: isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50', cardInner: isDark ? 'bg-slate-800' : 'bg-gray-100',
        input: isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900',
        button: isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white', divider: isDark ? 'border-slate-700' : 'border-gray-200',
        modal: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        tableHeader: isDark ? 'bg-slate-800' : 'bg-gray-100', tableRow: isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-50',
        accent: isDark ? 'text-blue-400' : 'text-blue-600',
        warning: isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800',
        success: isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
    };

    const { role: userRole, email: userEmail, customerId: userCustomerId, name: userName, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';
    const canEdit = isAdmin || isConsultant;

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };
    const ToastIcon = ({ type }: { type: string }) => type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : type === 'error' ? <AlertCircle className="w-5 h-5 text-red-400" /> : <Info className="w-5 h-5 text-blue-400" />;

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
                const hours = Math.floor(elapsed / 3600);
                const minutes = Math.floor((elapsed % 3600) / 60);
                const seconds = elapsed % 60;
                setTimerDisplay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
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
        const selectedClient = clients.find(c => c.customerId === projectForm.selectedClients[0]);
        if (selectedClient) return `${selectedClient.firstName} ${selectedClient.lastName}`;
        return '';
    };

    const createProject = async () => {
        if (!isAdmin) { showToast('Only admins can create projects', 'error'); return; }
        if (!projectForm.projectName) { showToast('Project name is required', 'error'); return; }
        setLoading(true);
        const clientName = getClientNameFromSelection();

        // Store selections before resetting form
        const selectedConsultantIds = [...projectForm.selectedConsultants];
        const selectedClientIds = [...projectForm.selectedClients];

        try {
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: projectForm.projectName, clientName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget, createdBy: userEmail }),
            });
            if (res.ok) {
                const data = await res.json();
                // API returns projectId as a number, convert to string for consistency
                const newProjectId = String(data.projectId || data.data?.projectId || data.id || data.data?.id);

                if (selectedConsultantIds.length > 0 || selectedClientIds.length > 0) {
                    AssignmentService.setupProjectAssignments(newProjectId, selectedConsultantIds, selectedClientIds);
                }
                showToast('Project created with team assignments!', 'success');
                setShowCreateModal(false); resetForm(); await loadProjects(); setLoading(false);
                return;
            }
        } catch (err) {
            console.error('API Error:', err);
        }

        // Fallback to local storage - use same numeric format as API for consistency
        const timestamp = Date.now();
        const newProjectId = String(timestamp);
        const newProject: Project = { projectId: newProjectId, projectCode: `PRJ-${String(timestamp).slice(-6)}`, projectName: projectForm.projectName, clientName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget, createdAt: new Date().toISOString(), createdBy: userEmail };
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([...local, newProject]));

        if (selectedConsultantIds.length > 0 || selectedClientIds.length > 0) {
            AssignmentService.setupProjectAssignments(newProjectId, selectedConsultantIds, selectedClientIds);
        }
        setShowCreateModal(false); resetForm(); loadProjects(); setLoading(false);
        showToast(`Project created (${newProject.projectCode}) with team!`, 'success');
    };

    const updateProject = () => {
        if (!selectedProject) return;
        if (!canEdit) { showToast('You do not have permission to edit projects', 'error'); return; }
        const updated = { ...selectedProject, projectName: projectForm.projectName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget };
        saveProjectToStorage(updated);
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        setShowEditModal(false); setShowDetailsModal(true);
        showToast('Project updated', 'success');
    };

    const updateProjectStatus = (projectId: string, newStatus: string) => {
        if (!canEdit) { showToast('You do not have permission to change status', 'error'); return; }
        const project = projects.find(p => p.projectId === projectId);
        if (!project) return;
        const updated = { ...project, status: newStatus };
        saveProjectToStorage(updated);
        setProjects(projects.map(p => p.projectId === projectId ? updated : p));
        if (selectedProject?.projectId === projectId) setSelectedProject(updated);
        setShowStatusMenu(null);
        showToast(`Status changed to ${statuses.find(st => st.value === newStatus)?.label}`, 'success');
    };

    const deleteProject = async (pid: string) => {
        if (!isAdmin) { showToast('Only admins can delete projects', 'error'); return; }
        try {
            const res = await fetch(`${API_BASE}/projects/${pid}`, { method: 'DELETE' });
            if (res.ok) {
                AssignmentService.cleanupProjectAssignments(pid);
                showToast('Project deleted', 'success');
                setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedProject(null);
                setProjects(prev => prev.filter(p => p.projectId !== pid));
                return;
            }
        } catch { }
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || '[]');
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(local.filter((p: Project) => p.projectId !== pid)));
        AssignmentService.cleanupProjectAssignments(pid);
        saveTimeEntries(timeEntries.filter(te => te.projectId !== pid));
        setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedProject(null); loadProjects();
        showToast('Project deleted', 'success');
    };

    const startTimer = (projectId: string) => {
        if (!isConsultant && !isAdmin) { showToast('Only consultants can track time', 'error'); return; }
        setActiveTimer({ projectId, startTime: Date.now() });
        showToast('Timer started', 'info');
    };

    const stopTimer = () => {
        if (!activeTimer) return;
        const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        setTimeForm({ hours, minutes, description: '', date: new Date().toISOString().split('T')[0] });
        setSelectedProject(projects.find(p => p.projectId === activeTimer.projectId) || null);
        setActiveTimer(null); setTimerDisplay('00:00:00'); setShowTimeModal(true);
    };

    const addTimeEntry = () => {
        if (!selectedProject) return;
        if (!isConsultant && !isAdmin) { showToast('Only consultants can log time', 'error'); return; }
        if (timeForm.hours === 0 && timeForm.minutes === 0) { showToast('Please enter time worked', 'error'); return; }
        const newEntry: TimeEntry = { id: `time_${Date.now()}`, projectId: selectedProject.projectId, consultantId: userConsultantId || userEmail, consultantName: userName || userEmail, date: timeForm.date, hours: timeForm.hours, minutes: timeForm.minutes, description: timeForm.description, createdAt: new Date().toISOString() };
        saveTimeEntries([...timeEntries, newEntry]);
        setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });
        setShowTimeModal(false);
        showToast(`Logged ${timeForm.hours}h ${timeForm.minutes}m`, 'success');
    };

    const deleteTimeEntry = (entryId: string) => {
        const entry = timeEntries.find(e => e.id === entryId);
        if (!entry) return;
        if (!isAdmin && entry.consultantId !== (userConsultantId || userEmail)) { showToast('You can only delete your own time entries', 'error'); return; }
        saveTimeEntries(timeEntries.filter(e => e.id !== entryId));
        showToast('Time entry deleted', 'success');
    };

    const getProjectTimeEntries = (projectId: string) => timeEntries.filter(te => te.projectId === projectId);
    const getProjectTotalTime = (projectId: string) => { const entries = getProjectTimeEntries(projectId); const totalMinutes = entries.reduce((sum, e) => sum + (e.hours * 60) + e.minutes, 0); return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }; };

    const assignConsultantToProject = (consultantId: string) => {
        if (!isAdmin) { showToast('Only admins can assign consultants', 'error'); return; }
        if (!selectedProject) return;
        const result = AssignmentService.assignConsultantToProject(selectedProject.projectId, consultantId);
        if (result) showToast('Consultant assigned', 'success');
        else showToast('Already assigned', 'info');
    };

    const removeConsultantFromProject = (consultantId: string) => {
        if (!isAdmin) { showToast('Only admins can remove consultants', 'error'); return; }
        if (!selectedProject) return;
        AssignmentService.removeConsultantFromProject(selectedProject.projectId, consultantId);
        showToast('Consultant removed', 'success');
    };

    const assignClientToProject = (clientId: string) => {
        if (!isAdmin) { showToast('Only admins can assign clients', 'error'); return; }
        if (!selectedProject) return;
        const result = AssignmentService.assignClientToProject(selectedProject.projectId, clientId);
        if (result) showToast('Client assigned', 'success');
        else showToast('Already assigned', 'info');
    };

    const removeClientFromProject = (clientId: string) => {
        if (!isAdmin) { showToast('Only admins can remove clients', 'error'); return; }
        if (!selectedProject) return;
        AssignmentService.removeClientFromProject(selectedProject.projectId, clientId);
        showToast('Client removed', 'success');
    };

    const getProjectConsultants = (pid: string) => {
        const ids = AssignmentService.getConsultantsForProject(String(pid));
        return consultants.filter(c => ids.includes(c.consultantId));
    };
    const getProjectClients = (pid: string) => {
        const ids = AssignmentService.getClientsForProject(String(pid));
        return clients.filter(c => ids.includes(c.customerId));
    };
    const getAvailableConsultants = (pid: string) => { const ids = AssignmentService.getConsultantsForProject(pid); return consultants.filter(c => !ids.includes(c.consultantId)); };
    const getAvailableClients = (pid: string) => { const ids = AssignmentService.getClientsForProject(pid); return clients.filter(c => !ids.includes(c.customerId)); };

    const resetForm = () => setProjectForm(emptyForm);
    const openProjectDetails = (p: Project) => { setSelectedProject(p); setProjectForm({ projectName: p.projectName, description: p.description || '', status: p.status, priority: p.priority || 'medium', startDate: p.startDate || '', endDate: p.endDate || '', budget: p.budget || '', selectedConsultants: [], selectedClients: [] }); setShowDetailsModal(true); };

    const filteredProjects = useMemo(() => {
        let filtered = projects;

        // Filter by role - clients only see their assigned projects
        if (isClient && userCustomerId) {
            const ids = AssignmentService.getProjectsForClient(userCustomerId);
            filtered = filtered.filter(p => ids.includes(String(p.projectId)));
        }

        // Filter by role - consultants only see their assigned projects
        if (isConsultant && userConsultantId) {
            const ids = AssignmentService.getProjectsForConsultant(userConsultantId);
            filtered = filtered.filter(p => ids.includes(String(p.projectId)));
        }

        // Apply search and status filters
        filtered = filtered.filter(p => {
            const matchSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || (p.projectCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchSearch && matchStatus;
        });

        // Sort
        filtered.sort((a, b) => {
            let aV: any, bV: any;
            switch (sortConfig.field) { case 'name': aV = a.projectName.toLowerCase(); bV = b.projectName.toLowerCase(); break; case 'status': aV = a.status; bV = b.status; break; default: aV = new Date(a.createdAt || 0).getTime(); bV = new Date(b.createdAt || 0).getTime(); }
            return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
        });
        return filtered;
    }, [projects, searchTerm, statusFilter, sortConfig, isClient, isConsultant, userCustomerId, userConsultantId, assignmentRefreshKey]);

    const stats = useMemo(() => ({ total: filteredProjects.length, planning: filteredProjects.filter(p => p.status === 'planning').length, active: filteredProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length, completed: filteredProjects.filter(p => p.status === 'completed').length }), [filteredProjects]);

    const getStatusColor = (st: string) => statuses.find(stat => stat.value === st)?.color || 'bg-gray-600';
    const getStatusLabel = (st: string) => statuses.find(stat => stat.value === st)?.label || st;
    const getPriorityColor = (p: string) => ({ low: 'text-gray-500', medium: 'text-amber-500', high: 'text-orange-500', urgent: 'text-red-500' }[p] || 'text-gray-500');
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : 'N/A';
    const formatBudget = (b: string) => b ? `$${Number(b).toLocaleString()}` : 'N/A';
    const formatTime = (hours: number, minutes: number) => `${hours}h ${minutes}m`;
    const toggleSort = (f: string) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }));
    const getSortIcon = (f: string) => sortConfig.field !== f ? <ArrowUpDown className={`w-4 h-4 ${s.textSubtle}`} /> : sortConfig.direction === 'asc' ? <ArrowUp className={`w-4 h-4 ${s.accent}`} /> : <ArrowDown className={`w-4 h-4 ${s.accent}`} />;

    const ganttDays = useMemo(() => { const days = []; const start = new Date(ganttStartDate); for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); } return days; }, [ganttStartDate]);
    const getProjectBarStyle = (project: Project) => { if (!project.startDate) return null; const start = new Date(project.startDate); const end = project.endDate ? new Date(project.endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); const ganttStart = ganttDays[0]; const ganttEnd = ganttDays[ganttDays.length - 1]; if (end < ganttStart || start > ganttEnd) return null; const totalDays = 42; const startOffset = Math.max(0, Math.floor((start.getTime() - ganttStart.getTime()) / (24 * 60 * 60 * 1000))); const duration = Math.min(totalDays - startOffset, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1); return { left: `${(startOffset / totalDays) * 100}%`, width: `${(Math.max(duration, 1) / totalDays) * 100}%` }; };
    const navigateGantt = (direction: 'prev' | 'next') => { const d = new Date(ganttStartDate); d.setDate(d.getDate() + (direction === 'next' ? 14 : -14)); setGanttStartDate(d); };
    const updateProjectDates = (projectId: string, newStartDate: Date) => { if (!canEdit) { showToast('You do not have permission to update dates', 'error'); return; } const project = projects.find(p => p.projectId === projectId); if (!project) return; const duration = project.startDate && project.endDate ? Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (24 * 60 * 60 * 1000)) : 7; const newEndDate = new Date(newStartDate); newEndDate.setDate(newEndDate.getDate() + duration); const updated = { ...project, startDate: newStartDate.toISOString().split('T')[0], endDate: newEndDate.toISOString().split('T')[0] }; saveProjectToStorage(updated); setProjects(projects.map(p => p.projectId === projectId ? updated : p)); showToast('Project dates updated', 'success'); };

    return (
        <div className={`min-h-screen ${s.bg}`}>
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(toast => (<div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${s.card}`}><ToastIcon type={toast.type} /><span className={s.text}>{toast.message}</span><button onClick={() => setToasts(p => p.filter(t => t.id !== toast.id))} className={s.textMuted}><X className="w-4 h-4" /></button></div>))}</div>

            {activeTimer && (<div className="fixed bottom-4 right-4 z-[9998]"><div className={`${s.card} border rounded-xl p-4 shadow-lg flex items-center gap-4`}><div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /><Timer className="w-5 h-5 text-red-500" /></div><div><p className={`${s.text} font-mono text-xl`}>{timerDisplay}</p><p className={`${s.textMuted} text-xs`}>{projects.find(p => p.projectId === activeTimer.projectId)?.projectName}</p></div><button onClick={stopTimer} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"><Pause className="w-4 h-4" />Stop</button></div></div>)}

            {showDeleteConfirm && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"><div className={`${s.modal} border rounded-lg max-w-md w-full p-6`}><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div><h3 className={`text-lg font-semibold ${s.text}`}>Delete Project?</h3></div><p className={`${s.textMuted} mb-6`}>This will permanently delete the project, all assignments, and time entries.</p><div className="flex gap-3"><button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${s.button} rounded-lg`}>Cancel</button><button onClick={() => deleteProject(showDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button></div></div></div>)}

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div><h1 className={`text-3xl font-bold ${s.text} mb-2`}>Projects</h1><p className={s.textMuted}>{isAdmin ? 'Manage all projects and assignments' : isConsultant ? 'Manage projects, track time, and update status' : 'View your assigned projects'}</p></div>
                        <div className="flex items-center gap-3">
                            <span className={`text-xs px-3 py-1.5 rounded-full ${s.cardInner} ${s.textMuted}`}>Role: <span className="font-semibold capitalize">{userRole}</span></span>
                            {canEdit && (<div className={`flex rounded-lg border ${s.divider} overflow-hidden`}><button onClick={() => setViewMode('list')} className={`px-3 py-2 flex items-center gap-2 text-sm ${viewMode === 'list' ? s.buttonPrimary : s.button}`}><List className="w-4 h-4" />List</button><button onClick={() => setViewMode('gantt')} className={`px-3 py-2 flex items-center gap-2 text-sm ${viewMode === 'gantt' ? s.buttonPrimary : s.button}`}><LayoutGrid className="w-4 h-4" />Gantt</button></div>)}
                            <button onClick={loadAllData} disabled={refreshing} className={`p-2.5 rounded-lg border ${s.divider} ${s.cardHover} ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-5 h-5 ${s.textMuted}`} /></button>
                            {isAdmin && (<button onClick={() => setShowCreateModal(true)} className={`${s.buttonPrimary} px-5 py-2.5 rounded-lg flex items-center gap-2`}><Plus className="w-5 h-5" />New Project</button>)}
                        </div>
                    </div>
                    {isClient && (<div className={`mb-4 p-4 ${s.warning} border rounded-lg flex items-center gap-3`}><Info className="w-5 h-5" /><p className="text-sm">You can only view projects assigned to you.</p></div>)}
                    {isConsultant && (<div className={`mb-4 p-4 ${s.success} border rounded-lg flex items-center gap-3`}><Timer className="w-5 h-5" /><p className="text-sm">You can only see projects assigned to you. You can edit status and <strong>log time worked</strong>.</p></div>)}
                    <div className="flex gap-4 items-center"><div className="relative flex-1"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${s.textMuted} w-5 h-5`} /><input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 ${s.input} border rounded-lg focus:outline-none focus:border-blue-500`} /></div><button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${showFilters ? s.buttonPrimary : s.button}`}><Filter className="w-5 h-5" />Filters</button></div>
                    {showFilters && (<div className={`mt-4 p-4 ${s.card} border rounded-lg`}><label className={`${s.textMuted} text-sm block mb-1`}>Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`w-full max-w-xs px-4 py-2 ${s.input} border rounded-lg`}><option value="all">All</option>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>)}
                    <div className="grid grid-cols-4 gap-4 mt-6">{[{ label: 'Total', value: stats.total, icon: FolderOpen }, { label: 'Planning', value: stats.planning, icon: Target }, { label: 'Active', value: stats.active, icon: TrendingUp }, { label: 'Completed', value: stats.completed, icon: CheckCircle2 }].map((stat, i) => (<div key={i} className={`${s.card} border rounded-lg p-4`}><div className="flex items-center justify-between mb-1"><span className={`${s.textMuted} text-sm`}>{stat.label}</span><stat.icon className={`w-5 h-5 ${s.accent}`} /></div><div className={`text-2xl font-bold ${s.text}`}>{stat.value}</div></div>))}</div>
                </div>

                {viewMode === 'list' && (
                    <div className={`${s.card} border rounded-lg overflow-hidden`}>
                        <div className={`grid grid-cols-12 gap-4 p-4 border-b ${s.divider} ${s.tableHeader}`}>
                            <div className={`col-span-3 flex items-center gap-2 cursor-pointer ${s.textMuted} text-sm`} onClick={() => toggleSort('name')}>Project {getSortIcon('name')}</div>
                            <div className={`col-span-2 ${s.textMuted} text-sm`}>Client / Team</div>
                            <div className={`col-span-2 ${s.textMuted} text-sm`}>Timeline</div>
                            <div className={`col-span-1 ${s.textMuted} text-sm`}>Time</div>
                            <div className={`col-span-2 flex items-center gap-2 cursor-pointer ${s.textMuted} text-sm`} onClick={() => toggleSort('status')}>Status {getSortIcon('status')}</div>
                            <div className={`col-span-2 ${s.textMuted} text-sm text-right`}>Actions</div>
                        </div>
                        {filteredProjects.length === 0 ? (
                            <div className="text-center py-16"><FolderOpen className={`w-12 h-12 ${s.textSubtle} mx-auto mb-3`} /><p className={s.textMuted}>{isClient ? 'No projects assigned to you yet' : isConsultant ? 'No projects assigned to you yet' : 'No projects found'}</p></div>
                        ) : filteredProjects.map(p => {
                            const totalTime = getProjectTotalTime(p.projectId);
                            const pClients = getProjectClients(p.projectId);
                            const pConsultants = getProjectConsultants(p.projectId);
                            return (
                                <div key={p.projectId} className={`grid grid-cols-12 gap-4 p-4 border-b ${s.tableRow}`}>
                                    <div className="col-span-3 flex items-center gap-3 cursor-pointer" onClick={() => openProjectDetails(p)}>
                                        <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center text-white"><FolderOpen className="w-5 h-5" /></div>
                                        <div><p className={`${s.text} font-medium`}>{p.projectName}</p><p className={`${s.textSubtle} text-xs`}>{p.projectCode}</p></div>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                        {pClients.length > 0 ? (<span className={`${s.textMuted} text-sm`}>{pClients[0].firstName} {pClients[0].lastName}{pClients.length > 1 ? ` +${pClients.length - 1}` : ''}</span>) : p.clientName ? (<span className={`${s.textMuted} text-sm`}>{p.clientName}</span>) : (<><Users className={`w-4 h-4 ${s.textSubtle}`} /><span className={`${s.textMuted} text-sm`}>{pConsultants.length + pClients.length}</span></>)}
                                    </div>
                                    <div className="col-span-2 flex items-center"><span className={`${s.textMuted} text-sm`}>{p.startDate ? formatDate(p.startDate) : 'No date'}</span></div>
                                    <div className="col-span-1 flex items-center"><span className={`${s.textMuted} text-sm flex items-center gap-1`}><Clock className="w-3 h-3" />{formatTime(totalTime.hours, totalTime.minutes)}</span></div>
                                    <div className="col-span-2 relative">
                                        <button onClick={(e) => { e.stopPropagation(); if (canEdit) setShowStatusMenu(showStatusMenu === p.projectId ? null : p.projectId); }} className={`${getStatusColor(p.status)} px-3 py-1 rounded-full text-white text-xs flex items-center gap-1 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`} disabled={!canEdit}>{getStatusLabel(p.status)}{canEdit && <ChevronRight className={`w-3 h-3 transition-transform ${showStatusMenu === p.projectId ? 'rotate-90' : ''}`} />}</button>
                                        {showStatusMenu === p.projectId && canEdit && (<div className={`absolute top-full left-0 mt-1 ${s.modal} border rounded-lg shadow-lg z-50 py-1 min-w-[140px]`}>{statuses.map(st => (<button key={st.value} onClick={(e) => { e.stopPropagation(); updateProjectStatus(p.projectId, st.value); }} className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${s.cardHover} ${p.status === st.value ? s.accent : s.textMuted}`}><div className={`w-2 h-2 rounded-full ${st.color}`} />{st.label}</button>))}</div>)}
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {(isConsultant || isAdmin) && !activeTimer && (<button onClick={(e) => { e.stopPropagation(); startTimer(p.projectId); }} className={`p-2 ${s.cardHover} rounded-lg`} title="Start Timer"><Play className="w-4 h-4 text-emerald-500" /></button>)}
                                        {(isConsultant || isAdmin) && (<button onClick={(e) => { e.stopPropagation(); setSelectedProject(p); setShowTimeModal(true); }} className={`p-2 ${s.cardHover} rounded-lg`} title="Log Time"><Timer className={`w-4 h-4 ${s.textMuted}`} /></button>)}
                                        <button onClick={() => openProjectDetails(p)} className={`p-2 ${s.cardHover} rounded-lg`}><Edit2 className={`w-4 h-4 ${s.textMuted}`} /></button>
                                        {isAdmin && <button onClick={() => setShowDeleteConfirm(p.projectId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {viewMode === 'gantt' && canEdit && (
                    <div className={`${s.card} border rounded-lg overflow-hidden`}>
                        <div className={`p-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => navigateGantt('prev')} className={`p-2 ${s.button} rounded-lg`}><ChevronLeft className="w-5 h-5" /></button>
                                <span className={`${s.text} font-medium`}>{ganttDays[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {ganttDays[ganttDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <button onClick={() => navigateGantt('next')} className={`p-2 ${s.button} rounded-lg`}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                            <button onClick={() => setGanttStartDate(() => { const d = new Date(); d.setDate(1); return d; })} className={`px-3 py-1.5 ${s.button} rounded-lg text-sm`}>Today</button>
                        </div>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1200px]">
                                <div className={`flex border-b ${s.divider}`}>
                                    <div className={`w-48 flex-shrink-0 p-3 ${s.tableHeader} border-r ${s.divider}`}><span className={`${s.textMuted} text-sm`}>Project</span></div>
                                    <div className="flex-1 flex">{ganttDays.map((day, i) => (<div key={i} className={`flex-1 min-w-[24px] p-1 text-center border-r ${s.divider} ${s.tableHeader} ${day.getDay() === 0 || day.getDay() === 6 ? (isDark ? 'bg-slate-700' : 'bg-gray-200') : ''}`}><div className={`text-[10px] ${s.textSubtle}`}>{day.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</div><div className={`text-xs ${s.textMuted} ${day.toDateString() === new Date().toDateString() ? 'text-blue-500 font-bold' : ''}`}>{day.getDate()}</div></div>))}</div>
                                </div>
                                {filteredProjects.length === 0 ? (<div className="text-center py-16"><FolderOpen className={`w-12 h-12 ${s.textSubtle} mx-auto mb-3`} /><p className={s.textMuted}>No projects found</p></div>) : filteredProjects.map(p => {
                                    const barStyle = getProjectBarStyle(p);
                                    return (
                                        <div key={p.projectId} className={`flex border-b ${s.tableRow}`}>
                                            <div className={`w-48 flex-shrink-0 p-3 border-r ${s.divider} flex items-center gap-2 cursor-pointer`} onClick={() => openProjectDetails(p)}><div className={`w-3 h-3 rounded-full ${getStatusColor(p.status)}`} /><span className={`${s.text} text-sm truncate`}>{p.projectName}</span></div>
                                            <div className="flex-1 relative h-12 flex items-center">
                                                <div className="absolute inset-0 flex">{ganttDays.map((day, i) => (<div key={i} onClick={() => updateProjectDates(p.projectId, day)} className={`flex-1 min-w-[24px] border-r ${s.divider} cursor-pointer hover:bg-blue-500/10 ${day.getDay() === 0 || day.getDay() === 6 ? (isDark ? 'bg-slate-800/50' : 'bg-gray-100') : ''} ${day.toDateString() === new Date().toDateString() ? 'bg-blue-500/10' : ''}`} />))}</div>
                                                {barStyle && (<div className={`absolute h-6 ${getStatusColor(p.status)} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2 shadow-sm`} style={{ left: barStyle.left, width: barStyle.width, minWidth: '60px' }} onClick={() => openProjectDetails(p)}><span className="text-white text-xs truncate">{p.projectName}</span></div>)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={`p-4 border-t ${s.divider} flex items-center gap-6 flex-wrap`}>{statuses.map(st => (<div key={st.value} className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${st.color}`} /><span className={`${s.textMuted} text-sm`}>{st.label}</span></div>))}<span className={`${s.textSubtle} text-xs ml-auto`}>Click on timeline to set project start date</span></div>
                    </div>
                )}
            </div>

            {showTimeModal && selectedProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            <div className="flex items-center gap-3"><Timer className="w-6 h-6 text-emerald-500" /><div><h2 className={`text-xl font-bold ${s.text}`}>Log Time</h2><p className={s.textMuted}>{selectedProject.projectName}</p></div></div>
                            <button onClick={() => { setShowTimeModal(false); setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] }); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className={`p-4 ${s.cardInner} rounded-lg space-y-4`}>
                                <h3 className={`${s.text} font-semibold`}>Add Time Entry</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className={`${s.textMuted} text-sm block mb-1`}>Hours</label><input type="number" min="0" max="24" value={timeForm.hours} onChange={e => setTimeForm({ ...timeForm, hours: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                    <div><label className={`${s.textMuted} text-sm block mb-1`}>Minutes</label><input type="number" min="0" max="59" value={timeForm.minutes} onChange={e => setTimeForm({ ...timeForm, minutes: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                    <div><label className={`${s.textMuted} text-sm block mb-1`}>Date</label><input type="date" value={timeForm.date} onChange={e => setTimeForm({ ...timeForm, date: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                </div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Description (optional)</label><textarea rows={2} value={timeForm.description} onChange={e => setTimeForm({ ...timeForm, description: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg resize-none`} placeholder="What did you work on?" /></div>
                                <button onClick={addTimeEntry} className={`w-full px-5 py-2.5 ${s.buttonPrimary} rounded-lg flex items-center justify-center gap-2`}><Save className="w-4 h-4" />Log Time</button>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-3"><h3 className={`${s.text} font-semibold`}>Time Entries</h3><span className={`${s.textMuted} text-sm`}>Total: {formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</span></div>
                                {getProjectTimeEntries(selectedProject.projectId).length === 0 ? (<p className={`${s.textSubtle} text-center py-4`}>No time logged yet</p>) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">{getProjectTimeEntries(selectedProject.projectId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                                        <div key={entry.id} className={`p-3 ${s.cardInner} rounded-lg flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">{entry.consultantName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                                                <div><p className={`${s.text} font-medium`}>{formatTime(entry.hours, entry.minutes)}</p><p className={`${s.textSubtle} text-xs`}>{entry.consultantName} • {new Date(entry.date).toLocaleDateString()}</p>{entry.description && <p className={`${s.textMuted} text-sm mt-1`}>{entry.description}</p>}</div>
                                            </div>
                                            {(isAdmin || entry.consultantId === (userConsultantId || userEmail)) && (<button onClick={() => deleteTimeEntry(entry.id)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>)}
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && isAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${s.text}`}>New Project</h2><button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`p-3 rounded-lg border ${s.success} text-sm flex items-center gap-2`}><CheckCircle className="w-4 h-4" /><span>Team assignments will automatically sync to Clients & Consultants pages</span></div>
                            <div><label className={`${s.textMuted} text-sm block mb-1`}>Project Name *</label><input type="text" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} placeholder="Enter project name" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Status</label><select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`}>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Priority</label><select value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Start Date</label><input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>End Date</label><input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                <div className="col-span-2"><label className={`${s.textMuted} text-sm block mb-1`}>Budget</label><input type="number" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} placeholder="Enter budget" /></div>
                            </div>
                            <div>
                                <label className={`${s.textMuted} text-sm block mb-2 flex items-center gap-2`}><Users className="w-4 h-4" />Assign Clients {projectForm.selectedClients.length > 0 && <span className={`px-2 py-0.5 rounded-full text-xs ${s.buttonPrimary}`}>{projectForm.selectedClients.length} selected</span>}</label>
                                <div className={`max-h-40 overflow-y-auto ${s.cardInner} rounded-lg p-3 space-y-2 border ${s.divider}`}>
                                    {clients.length === 0 ? (<p className={s.textSubtle}>No clients available</p>) : clients.map(c => (
                                        <label key={c.customerId} className={`flex items-center gap-3 p-2 ${s.cardHover} rounded cursor-pointer ${projectForm.selectedClients.includes(c.customerId) ? (isDark ? 'bg-emerald-900/30' : 'bg-emerald-50') : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedClients.includes(c.customerId)} onChange={(e) => setProjectForm({ ...projectForm, selectedClients: e.target.checked ? [...projectForm.selectedClients, c.customerId] : projectForm.selectedClients.filter(id => id !== c.customerId) })} className="w-4 h-4 accent-emerald-600" />
                                            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={s.text}>{c.firstName} {c.lastName}</span><span className={`${s.textSubtle} text-xs block`}>{c.clientCode}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={`${s.textMuted} text-sm block mb-2 flex items-center gap-2`}><Users className="w-4 h-4" />Assign Consultants {projectForm.selectedConsultants.length > 0 && <span className={`px-2 py-0.5 rounded-full text-xs ${s.buttonPrimary}`}>{projectForm.selectedConsultants.length} selected</span>}</label>
                                <div className={`max-h-40 overflow-y-auto ${s.cardInner} rounded-lg p-3 space-y-2 border ${s.divider}`}>
                                    {consultants.length === 0 ? (<p className={s.textSubtle}>No consultants available</p>) : consultants.map(c => (
                                        <label key={c.consultantId} className={`flex items-center gap-3 p-2 ${s.cardHover} rounded cursor-pointer ${projectForm.selectedConsultants.includes(c.consultantId) ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedConsultants.includes(c.consultantId)} onChange={(e) => setProjectForm({ ...projectForm, selectedConsultants: e.target.checked ? [...projectForm.selectedConsultants, c.consultantId] : projectForm.selectedConsultants.filter(id => id !== c.consultantId) })} className="w-4 h-4 accent-blue-600" />
                                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={s.text}>{c.firstName} {c.lastName}</span><span className={`${s.textSubtle} text-xs block`}>{c.consultantCode}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div><label className={`${s.textMuted} text-sm block mb-1`}>Description</label><textarea rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg resize-none`} placeholder="Project description..." /></div>
                            {(projectForm.selectedClients.length > 0 || projectForm.selectedConsultants.length > 0) && (<div className={`p-3 rounded-lg border ${s.warning} text-sm`}><strong>Team Summary:</strong><ul className="mt-1 space-y-1">{projectForm.selectedClients.length > 0 && <li>• {projectForm.selectedClients.length} client(s) will be assigned</li>}{projectForm.selectedConsultants.length > 0 && <li>• {projectForm.selectedConsultants.length} consultant(s) will be assigned</li>}<li className={s.textSubtle}>• All team members will be automatically linked together</li></ul></div>)}
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`flex-1 px-5 py-2.5 ${s.button} rounded-lg`}>Cancel</button><button onClick={createProject} disabled={loading} className={`flex-1 px-5 py-2.5 ${s.buttonPrimary} rounded-lg disabled:opacity-50 flex items-center justify-center gap-2`}>{loading ? 'Creating...' : <><Plus className="w-4 h-4" />Create Project</>}</button></div>
                        </div>
                    </div>
                </div>
            )}

            {showDetailsModal && selectedProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center text-white"><FolderOpen className="w-6 h-6" /></div><div><h2 className={`text-xl font-bold ${s.text}`}>{selectedProject.projectName}</h2><p className={s.textMuted}>{selectedProject.projectCode}</p></div></div>
                            <div className="flex items-center gap-2">{isAdmin && <button onClick={() => setShowDeleteConfirm(selectedProject.projectId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-5 h-5 text-red-500" /></button>}<button onClick={() => { setShowDetailsModal(false); setSelectedProject(null); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button></div>
                        </div>
                        <div className="p-5 space-y-5">
                            <div><label className={`${s.textMuted} text-sm block mb-2`}>Status</label><div className="flex flex-wrap gap-2">{statuses.map(st => (<button key={st.value} onClick={() => canEdit && updateProjectStatus(selectedProject.projectId, st.value)} disabled={!canEdit} className={`px-4 py-2 rounded-lg flex items-center gap-2 border transition-all ${selectedProject.status === st.value ? `${st.color} text-white border-transparent` : `${s.button} ${s.divider}`} ${!canEdit ? 'cursor-default opacity-60' : ''}`}><st.icon className="w-4 h-4" />{st.label}</button>))}</div></div>
                            <div className="flex items-center gap-4 flex-wrap"><span className={`${getPriorityColor(selectedProject.priority || 'medium')} font-medium`}>{(selectedProject.priority || 'medium').charAt(0).toUpperCase() + (selectedProject.priority || 'medium').slice(1)} Priority</span></div>
                            <div className="grid grid-cols-4 gap-4">
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${s.button} rounded-lg`}><Edit2 className="w-4 h-4" />Edit</button>}
                                {(isConsultant || isAdmin) && <button onClick={() => { setShowDetailsModal(false); setShowTimeModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"><Timer className="w-4 h-4" />Log Time</button>}
                                {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${s.button} rounded-lg`}><Users className="w-4 h-4" />Consultants</button>}
                                {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 ${s.button} rounded-lg`}><Users className="w-4 h-4" />Clients</button>}
                            </div>
                            <div className={`${s.cardInner} rounded-lg p-4`}><h3 className={`${s.textMuted} text-sm mb-2 flex items-center gap-2`}><Timer className="w-4 h-4" />Time Tracked</h3><div className="flex items-center justify-between"><div className={`text-2xl font-bold ${s.text}`}>{formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</div><span className={`${s.textSubtle} text-sm`}>{getProjectTimeEntries(selectedProject.projectId).length} entries</span></div></div>
                            <div className={`${s.cardInner} rounded-lg p-4`}><h3 className={`${s.textMuted} text-sm mb-2 flex items-center gap-2`}><Calendar className="w-4 h-4" />Timeline & Budget</h3><div className="grid grid-cols-3 gap-4"><div><p className={`${s.textSubtle} text-xs`}>Start</p><p className={s.text}>{formatDate(selectedProject.startDate)}</p></div><div><p className={`${s.textSubtle} text-xs`}>End</p><p className={s.text}>{formatDate(selectedProject.endDate)}</p></div><div><p className={`${s.textSubtle} text-xs`}>Budget</p><p className={s.text}>{formatBudget(selectedProject.budget)}</p></div></div></div>
                            <div className={`${s.cardInner} rounded-lg p-4`}><div className="flex items-center justify-between mb-2"><h3 className={`${s.textMuted} text-sm flex items-center gap-2`}><Users className="w-4 h-4" />Consultants</h3>{isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`${s.accent} text-sm`}>Manage</button>}</div>{getProjectConsultants(selectedProject.projectId).length === 0 ? <p className={s.textSubtle}>No consultants assigned</p> : <div className="flex flex-wrap gap-2">{getProjectConsultants(selectedProject.projectId).map(c => <span key={c.consultantId} className={`px-3 py-1 ${s.cardInner} border ${s.divider} rounded-full ${s.text} text-sm`}>{c.firstName} {c.lastName}</span>)}</div>}</div>
                            <div className={`${s.cardInner} rounded-lg p-4`}><div className="flex items-center justify-between mb-2"><h3 className={`${s.textMuted} text-sm flex items-center gap-2`}><Users className="w-4 h-4" />Clients</h3>{isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`${s.accent} text-sm`}>Manage</button>}</div>{getProjectClients(selectedProject.projectId).length === 0 ? <p className={s.textSubtle}>No clients assigned</p> : <div className="flex flex-wrap gap-2">{getProjectClients(selectedProject.projectId).map(c => <span key={c.customerId} className={`px-3 py-1 ${s.cardInner} border ${s.divider} rounded-full ${s.text} text-sm`}>{c.firstName} {c.lastName}</span>)}</div>}</div>
                            {selectedProject.description && <div className={`${s.cardInner} rounded-lg p-4`}><h3 className={`${s.textMuted} text-sm mb-2 flex items-center gap-2`}><FileText className="w-4 h-4" />Description</h3><p className={`${s.text} text-sm`}>{selectedProject.description}</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && selectedProject && canEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${s.text}`}>Edit Project</h2><button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div><label className={`${s.textMuted} text-sm block mb-1`}>Project Name</label><input type="text" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Status</label><select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`}>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Priority</label><select value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>Start Date</label><input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                <div><label className={`${s.textMuted} text-sm block mb-1`}>End Date</label><input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                                <div className="col-span-2"><label className={`${s.textMuted} text-sm block mb-1`}>Budget</label><input type="number" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg`} /></div>
                            </div>
                            <div><label className={`${s.textMuted} text-sm block mb-1`}>Description</label><textarea rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-4 py-2.5 ${s.input} border rounded-lg resize-none`} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-5 py-2.5 ${s.button} rounded-lg`}>Cancel</button><button onClick={updateProject} className={`flex-1 px-5 py-2.5 ${s.buttonPrimary} rounded-lg`}>Save Changes</button></div>
                        </div>
                    </div>
                </div>
            )}

            {showConsultantsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${s.text}`}>Manage Consultants</h2><button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`p-3 rounded-lg border ${s.warning} text-sm`}><strong>Auto-sync:</strong> Consultants will be linked to all clients on this project</div>
                            <div><h3 className={`${s.text} font-semibold mb-3 flex items-center gap-2`}><Users className={`w-5 h-5 ${s.accent}`} />Assigned</h3>{getProjectConsultants(selectedProject.projectId).length === 0 ? <p className={`${s.textSubtle} text-center py-4`}>No consultants assigned</p> : <div className="space-y-2">{getProjectConsultants(selectedProject.projectId).map(c => (<div key={c.consultantId} className={`flex items-center justify-between p-3 ${s.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${s.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${s.textMuted} text-sm`}>{c.email}</p></div></div><button onClick={() => removeConsultantFromProject(c.consultantId)} className="p-2 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-5 h-5 text-red-500" /></button></div>))}</div>}</div>
                            <div><h3 className={`${s.text} font-semibold mb-3 flex items-center gap-2`}><UserPlus className={`w-5 h-5 ${s.accent}`} />Available</h3>{getAvailableConsultants(selectedProject.projectId).length === 0 ? <p className={`${s.textSubtle} text-center py-4`}>All consultants assigned</p> : <div className="space-y-2">{getAvailableConsultants(selectedProject.projectId).map(c => (<div key={c.consultantId} className={`flex items-center justify-between p-3 ${s.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${s.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${s.textMuted} text-sm`}>{c.consultantCode}</p></div></div><button onClick={() => assignConsultantToProject(c.consultantId)} className={`px-4 py-2 ${s.buttonPrimary} rounded-lg flex items-center gap-2`}><Link2 className="w-4 h-4" />Assign</button></div>))}</div>}</div>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`w-full px-5 py-2.5 ${s.button} rounded-lg`}>Back to Project</button>
                        </div>
                    </div>
                </div>
            )}

            {showClientsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.modal} border rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${s.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><h2 className={`text-xl font-bold ${s.text}`}>Manage Clients</h2><button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`p-2 ${s.cardHover} rounded-lg`}><X className={`w-5 h-5 ${s.textMuted}`} /></button></div>
                        <div className="p-5 space-y-5">
                            <div className={`p-3 rounded-lg border ${s.warning} text-sm`}><strong>Auto-sync:</strong> Clients will be linked to all consultants on this project</div>
                            <div><h3 className={`${s.text} font-semibold mb-3 flex items-center gap-2`}><Users className={`w-5 h-5 ${s.accent}`} />Assigned</h3>{getProjectClients(selectedProject.projectId).length === 0 ? <p className={`${s.textSubtle} text-center py-4`}>No clients assigned</p> : <div className="space-y-2">{getProjectClients(selectedProject.projectId).map(c => (<div key={c.customerId} className={`flex items-center justify-between p-3 ${s.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${s.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${s.textMuted} text-sm`}>{c.email}</p></div></div><button onClick={() => removeClientFromProject(c.customerId)} className="p-2 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-5 h-5 text-red-500" /></button></div>))}</div>}</div>
                            <div><h3 className={`${s.text} font-semibold mb-3 flex items-center gap-2`}><UserPlus className={`w-5 h-5 ${s.accent}`} />Available</h3>{getAvailableClients(selectedProject.projectId).length === 0 ? <p className={`${s.textSubtle} text-center py-4`}>All clients assigned</p> : <div className="space-y-2">{getAvailableClients(selectedProject.projectId).map(c => (<div key={c.customerId} className={`flex items-center justify-between p-3 ${s.cardInner} rounded-lg`}><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${s.text} font-medium`}>{c.firstName} {c.lastName}</p><p className={`${s.textMuted} text-sm`}>{c.clientCode}</p></div></div><button onClick={() => assignClientToProject(c.customerId)} className={`px-4 py-2 ${s.buttonPrimary} rounded-lg flex items-center gap-2`}><Link2 className="w-4 h-4" />Assign</button></div>))}</div>}</div>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`w-full px-5 py-2.5 ${s.button} rounded-lg`}>Back to Project</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RealEstateProjects;