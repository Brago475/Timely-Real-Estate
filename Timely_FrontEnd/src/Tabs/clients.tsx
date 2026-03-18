// src/Tabs/clients.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Search, Plus, Filter, ChevronRight, Phone, Users, Building2, Home, DollarSign, Calendar, X, Edit2, Trash2, User, Briefcase, TrendingUp, CheckCircle2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, StickyNote, FolderOpen, Link2, Unlink, UserMinus, FolderPlus, RefreshCw, AlertCircle, CheckCircle, Info, Mail } from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

const API_BASE = '/api';
const STORAGE_KEYS = { clientsExtended: 'timely_clients_extended' };

type UserRole = 'admin' | 'consultant' | 'client';

const getCurrentUserRole = (): { role: UserRole; email: string; customerId: string; name: string; consultantId: string } => {
    try {
        const raw = sessionStorage.getItem('timely_user') || localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
        const parsed = JSON.parse(raw);
        const r = (parsed.role || '').toLowerCase();
        const role: UserRole = (r === 'owner' || r === 'admin') ? 'admin' : (r === 'consultant') ? 'consultant' : (r === 'client') ? 'client' : 'admin';
        return { role, email: parsed.email || '', customerId: parsed.customerId || '', name: parsed.name || '', consultantId: parsed.consultantId || '' };
    } catch { return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' }; }
};

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch { return null; } };

const flattenMember = (m: any, ext: Record<string, any> = {}) => { const u = m.user || m; const cid = String(m.userId || u.id || m.customerId || ''); return { customerId: cid, clientCode: u.code || m.clientCode || '', firstName: u.firstName || '', middleName: u.middleName || '', lastName: u.lastName || '', email: u.email || '', tempPassword: '', role: m.role || 'client', ...ext[cid] }; };

const fmtStatus = (s: string): string => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'New Lead';

interface Client { customerId: string; clientCode: string; firstName: string; middleName: string; lastName: string; email: string; tempPassword: string; phone?: string; clientType?: string; propertyType?: string; budgetMin?: string; budgetMax?: string; preferredLocations?: string; status?: string; lastContactDate?: string; nextFollowUp?: string; notes?: string; }
interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; role: string; }
interface Project { projectId: string; projectCode: string; projectName: string; status: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const ClientsPage = () => {
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

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const [clients, setClients] = useState<Client[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showConsultantsModal, setShowConsultantsModal] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sortConfig, setSortConfig] = useState({ field: 'customerId', direction: 'desc' as 'asc' | 'desc' });

    const [clientForm, setClientForm] = useState({ firstName: '', middleName: '', lastName: '', phone: '', clientType: 'buyer' as string, propertyType: '', budgetMin: '', budgetMax: '', preferredLocations: '', status: 'new_lead' as string, lastContactDate: new Date().toISOString().split('T')[0], nextFollowUp: '', notes: '' });
    const [tempPassword, setTempPassword] = useState('');

    useEffect(() => {
        const unsub = AssignmentService.subscribe(() => setAssignmentRefreshKey(k => k + 1));
        const handle = () => setAssignmentRefreshKey(k => k + 1);
        window.addEventListener('assignment-change', handle);
        return () => { unsub(); window.removeEventListener('assignment-change', handle); };
    }, []);

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => { setRefreshing(true); await Promise.all([loadClients(), loadConsultants(), loadProjects()]); AssignmentService.syncClientConsultantsFromAPI(); setRefreshing(false); };
    const loadClients = async () => { const d = await safeFetch(`${API_BASE}/orgs/me`); if (d?.data?.members) { const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientsExtended) || '{}'); setClients(d.data.members.map((m: any) => flattenMember(m, ext))); } };
    const loadConsultants = async () => { const d = await safeFetch(`${API_BASE}/consultants`); if (d?.data) setConsultants(d.data); };
    const loadProjects = async () => { const d = await safeFetch(`${API_BASE}/projects`); if (d?.data) setProjects(d.data); };

    const companyEmail = useMemo(() => { const f = clientForm.firstName.trim(), l = clientForm.lastName.trim(); if (!f || !l) return ''; return `${l.replace(/\s+/g, '').toLowerCase()}${f[0].toLowerCase()}@timely.com`; }, [clientForm.firstName, clientForm.lastName]);
    const generatePassword = () => { const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lo = 'abcdefghijkmnopqrstuvwxyz', d = '23456789', s = '!@$%^&*?'; const pick = (x: string) => x[Math.floor(Math.random() * x.length)]; let p = pick(u) + pick(lo) + pick(d) + pick(s); while (p.length < 12) p += pick(u + lo + d + s); setTempPassword(p.split('').sort(() => Math.random() - 0.5).join('')); };

    const createClient = async () => {
        if (!canCreate) { showToast('No permission', 'error'); return; }
        if (!clientForm.firstName || !clientForm.lastName) { showToast('Name required', 'error'); return; }
        if (!tempPassword) { showToast('Generate password first', 'error'); return; }
        setLoading(true);
        try {
            const r = await fetch(`${API_BASE}/users-csv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: clientForm.firstName.trim(), middleName: clientForm.middleName.trim(), lastName: clientForm.lastName.trim(), email: companyEmail, tempPassword, performedBy: 'admin' }) });
            if (!r.ok) throw new Error('Failed');
            const res = await r.json();
            const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientsExtended) || '{}');
            ext[res.customerId] = { phone: clientForm.phone, clientType: clientForm.clientType, propertyType: clientForm.propertyType, budgetMin: clientForm.budgetMin, budgetMax: clientForm.budgetMax, preferredLocations: clientForm.preferredLocations, status: clientForm.status, lastContactDate: clientForm.lastContactDate, nextFollowUp: clientForm.nextFollowUp, notes: clientForm.notes };
            localStorage.setItem(STORAGE_KEYS.clientsExtended, JSON.stringify(ext));
            showToast(`Client created (${res.clientCode})`, 'success');
            setShowCreateModal(false); resetForm(); loadClients();
        } catch { showToast('Failed to create', 'error'); }
        finally { setLoading(false); }
    };

    const updateClient = () => {
        if (!canEdit || !selectedClient) return;
        const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientsExtended) || '{}');
        ext[selectedClient.customerId] = { phone: clientForm.phone, clientType: clientForm.clientType, propertyType: clientForm.propertyType, budgetMin: clientForm.budgetMin, budgetMax: clientForm.budgetMax, preferredLocations: clientForm.preferredLocations, status: clientForm.status, lastContactDate: clientForm.lastContactDate, nextFollowUp: clientForm.nextFollowUp, notes: clientForm.notes };
        localStorage.setItem(STORAGE_KEYS.clientsExtended, JSON.stringify(ext));
        setShowEditModal(false); setShowDetailsModal(true); loadClients();
        showToast('Client updated', 'success');
    };

    const deleteClient = async (cid: string) => {
        if (!canDelete) return;
        try {
            await fetch(`${API_BASE}/users-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: cid, performedBy: 'admin' }) });
            const ext = JSON.parse(localStorage.getItem(STORAGE_KEYS.clientsExtended) || '{}'); delete ext[cid]; localStorage.setItem(STORAGE_KEYS.clientsExtended, JSON.stringify(ext));
            AssignmentService.cleanupClientAssignments(cid);
            setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedClient(null); loadAllData();
            showToast('Client deleted', 'success');
        } catch { showToast('Failed to delete', 'error'); }
    };

    const assignConsultant = async (cid: string) => { if (!canAssign || !selectedClient) return; const r = await AssignmentService.assignConsultantToClientViaAPI(selectedClient.customerId, cid); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeConsultant = (cid: string) => { if (!canAssign || !selectedClient) return; AssignmentService.removeConsultantFromClient(selectedClient.customerId, cid); showToast('Removed', 'success'); };
    const assignProject = (pid: string) => { if (!canAssign || !selectedClient) return; const r = AssignmentService.assignClientToProject(pid, selectedClient.customerId); showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info'); };
    const removeProject = (pid: string) => { if (!canAssign || !selectedClient) return; AssignmentService.removeClientFromProject(pid, selectedClient.customerId); showToast('Removed', 'success'); };

    const getClientConsultants = (cid: string) => { const ids = AssignmentService.getConsultantsForClient(cid); return consultants.filter(c => ids.includes(c.consultantId)); };
    const getAvailableConsultants = (cid: string) => { const ids = AssignmentService.getConsultantsForClient(cid); return consultants.filter(c => !ids.includes(c.consultantId)); };
    const getClientProjects = (cid: string) => { const ids = AssignmentService.getProjectsForClient(cid); return projects.filter(p => ids.includes(p.projectId)); };
    const getAvailableProjects = (cid: string) => { const ids = AssignmentService.getProjectsForClient(cid); return projects.filter(p => !ids.includes(p.projectId)); };

    const resetForm = () => { setClientForm({ firstName: '', middleName: '', lastName: '', phone: '', clientType: 'buyer', propertyType: '', budgetMin: '', budgetMax: '', preferredLocations: '', status: 'new_lead', lastContactDate: new Date().toISOString().split('T')[0], nextFollowUp: '', notes: '' }); setTempPassword(''); };
    const openDetails = (c: Client) => { setSelectedClient(c); setClientForm({ firstName: c.firstName, middleName: c.middleName || '', lastName: c.lastName, phone: c.phone || '', clientType: c.clientType || 'buyer', propertyType: c.propertyType || '', budgetMin: c.budgetMin || '', budgetMax: c.budgetMax || '', preferredLocations: c.preferredLocations || '', status: c.status || 'new_lead', lastContactDate: c.lastContactDate || new Date().toISOString().split('T')[0], nextFollowUp: c.nextFollowUp || '', notes: c.notes || '' }); setShowDetailsModal(true); };

    const filteredClients = useMemo(() => {
        let filtered = clients;
        if (isConsultant && userConsultantId) { const ids = AssignmentService.getClientsForConsultant(String(userConsultantId)); filtered = filtered.filter(c => ids.includes(String(c.customerId))); }
        filtered = filtered.filter(c => {
            const search = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()) || (c.clientCode || '').toLowerCase().includes(searchTerm.toLowerCase());
            const status = statusFilter === 'all' || c.status === statusFilter;
            const type = typeFilter === 'all' || c.clientType === typeFilter;
            return search && status && type;
        });
        filtered.sort((a, b) => {
            let aV: any, bV: any;
            switch (sortConfig.field) { case 'name': aV = `${a.firstName} ${a.lastName}`.toLowerCase(); bV = `${b.firstName} ${b.lastName}`.toLowerCase(); break; case 'status': aV = a.status || ''; bV = b.status || ''; break; default: aV = Number(a.customerId) || 0; bV = Number(b.customerId) || 0; }
            return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
        });
        return filtered;
    }, [clients, userConsultantId, isConsultant, searchTerm, statusFilter, typeFilter, sortConfig, assignmentRefreshKey]);

    const stats = useMemo(() => {
        const rel = isConsultant && userConsultantId ? clients.filter(c => AssignmentService.getClientsForConsultant(String(userConsultantId)).includes(String(c.customerId))) : clients;
        return { total: rel.length, newLeads: rel.filter(c => c.status === 'new_lead').length, active: rel.filter(c => ['contacted', 'tour_scheduled', 'offer_made'].includes(c.status || '')).length, closed: rel.filter(c => c.status === 'closed').length };
    }, [clients, userConsultantId, isConsultant, assignmentRefreshKey]);

    const getStatusColor = (s: string) => ({ new_lead: 'bg-blue-600', contacted: 'bg-cyan-600', tour_scheduled: 'bg-amber-600', offer_made: 'bg-purple-600', closed: 'bg-emerald-600', lost: 'bg-gray-600' }[s] || 'bg-gray-600');
    const getTypeIcon = (t: string) => { switch (t) { case 'buyer': return <Home className="w-3.5 h-3.5" />; case 'renter': return <Building2 className="w-3.5 h-3.5" />; case 'seller': return <DollarSign className="w-3.5 h-3.5" />; case 'investor': return <TrendingUp className="w-3.5 h-3.5" />; default: return <User className="w-3.5 h-3.5" />; } };
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
    const formatBudget = (min: string, max: string) => { if (!min && !max) return '—'; if (min && max) return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`; if (min) return `From $${Number(min).toLocaleString()}`; return `Up to $${Number(max).toLocaleString()}`; };
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
                            <h3 className={`text-lg font-semibold ${n.text}`}>Delete Client?</h3>
                        </div>
                        <p className={`${n.secondary} text-sm mb-6`}>This permanently removes the client and all assignments.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                            <button onClick={() => deleteClient(showDeleteConfirm)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Clients</h1>
                            <p className={`text-sm ${n.secondary}`}>{isAdmin ? 'Manage all clients and assignments' : isConsultant ? 'View your assigned clients' : 'Client directory'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={loadAllData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                            {canCreate && <button onClick={() => setShowCreateModal(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm`}><Plus className="w-4 h-4" />Add Client</button>}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex gap-3 items-center mb-6">
                        <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                            <Search className={`w-4 h-4 ${n.tertiary}`} />
                            <input type="text" placeholder="Search clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.pressed : n.flat} flex items-center justify-center`}><Filter className={`w-4 h-4 ${n.secondary}`} /></button>
                    </div>

                    {showFilters && (
                        <div className={`${n.card} p-4 mb-6 grid grid-cols-2 gap-3`}>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option><option value="new_lead">New Lead</option><option value="contacted">Contacted</option><option value="tour_scheduled">Tour Scheduled</option><option value="offer_made">Offer Made</option><option value="closed">Closed</option><option value="lost">Lost</option></select></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Type</label><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`w-full px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option><option value="buyer">Buyer</option><option value="renter">Renter</option><option value="seller">Seller</option><option value="investor">Investor</option></select></div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total', value: stats.total, icon: Users },
                            { label: 'New Leads', value: stats.newLeads, icon: UserPlus },
                            { label: 'Active', value: stats.active, icon: TrendingUp },
                            { label: 'Closed', value: stats.closed, icon: CheckCircle2 },
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

                {/* Client List */}
                <div className={`${n.card} p-1.5 space-y-1.5`}>
                    {/* Table Header */}
                    <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                        <div className={`col-span-3 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('name')}>Client {getSortIcon('name')}</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Consultants</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Projects</div>
                        <div className={`col-span-2 flex items-center gap-1 cursor-pointer text-xs ${n.label}`} onClick={() => toggleSort('status')}>Status {getSortIcon('status')}</div>
                        <div className={`col-span-2 text-xs ${n.label}`}>Type</div>
                        <div className={`col-span-1 text-xs ${n.label} text-right`}>→</div>
                    </div>

                    {filteredClients.length === 0 ? (
                        <div className={`${n.flat} text-center py-16`}>
                            <Users className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} />
                            <p className={`text-sm ${n.secondary}`}>{isConsultant ? 'No clients assigned to you' : 'No clients found'}</p>
                        </div>
                    ) : filteredClients.map(c => {
                        const cCons = getClientConsultants(c.customerId);
                        const cProj = getClientProjects(c.customerId);
                        return (
                            <div key={c.customerId} onClick={() => openDetails(c)} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 cursor-pointer transition-all duration-200`}>
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full ${n.inset} flex items-center justify-center text-[10px] font-semibold ${n.secondary} flex-shrink-0`}>{(c.firstName||'?')[0]}{(c.lastName||'?')[0]}</div>
                                    <div className="min-w-0"><p className={`${n.text} text-sm font-medium truncate`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.clientCode}</p></div>
                                </div>
                                <div className="col-span-2 flex items-center gap-1"><Users className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.secondary} text-sm`}>{cCons.length}</span></div>
                                <div className="col-span-2 flex items-center gap-1"><FolderOpen className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`${n.secondary} text-sm`}>{cProj.length}</span></div>
                                <div className="col-span-2 flex items-center"><span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>{fmtStatus(c.status || 'new_lead')}</span></div>
                                <div className={`col-span-2 flex items-center gap-1.5 ${n.secondary}`}>{getTypeIcon(c.clientType || 'buyer')}<span className="text-sm">{fmtStatus(c.clientType || 'buyer')}</span></div>
                                <div className="col-span-1 flex items-center justify-end"><ChevronRight className={`w-4 h-4 ${n.tertiary}`} /></div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══ MODALS ═══ */}

            {/* Create Modal */}
            {showCreateModal && canCreate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Add Client</h2>
                            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Personal */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><User className="w-3.5 h-3.5" />Personal</span>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>First *</label><input type="text" value={clientForm.firstName} onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Middle</label><input type="text" value={clientForm.middleName} onChange={(e) => setClientForm({ ...clientForm, middleName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Last *</label><input type="text" value={clientForm.lastName} onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                </div>
                                <div className="mt-3"><label className={`${n.label} text-[11px] block mb-1`}>Email (auto)</label><div className={`px-3 py-2.5 ${n.inset} rounded-xl ${n.secondary} text-sm`}>{companyEmail || 'Enter names...'}</div></div>
                                <div className="mt-3"><label className={`${n.label} text-[11px] block mb-1`}>Phone</label><input type="tel" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
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
                            {/* Status & Type */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><TrendingUp className="w-3.5 h-3.5" />Status & Type</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={clientForm.status} onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="new_lead">New Lead</option><option value="contacted">Contacted</option><option value="tour_scheduled">Tour Scheduled</option><option value="offer_made">Offer Made</option><option value="closed">Closed</option><option value="lost">Lost</option></select></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Type</label><select value={clientForm.clientType} onChange={(e) => setClientForm({ ...clientForm, clientType: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="buyer">Buyer</option><option value="renter">Renter</option><option value="seller">Seller</option><option value="investor">Investor</option></select></div>
                                </div>
                            </div>
                            {/* Requirements */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><Home className="w-3.5 h-3.5" />Requirements</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Property</label><select value={clientForm.propertyType} onChange={(e) => setClientForm({ ...clientForm, propertyType: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option><option value="apartment">Apartment</option><option value="house">House</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option><option value="commercial">Commercial</option><option value="land">Land</option></select></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Locations</label><input type="text" value={clientForm.preferredLocations} onChange={(e) => setClientForm({ ...clientForm, preferredLocations: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="Downtown..." /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Budget Min</label><input type="number" value={clientForm.budgetMin} onChange={(e) => setClientForm({ ...clientForm, budgetMin: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Budget Max</label><input type="number" value={clientForm.budgetMax} onChange={(e) => setClientForm({ ...clientForm, budgetMax: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                </div>
                            </div>
                            {/* Follow-up */}
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-3`}><Calendar className="w-3.5 h-3.5" />Follow-up</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Last Contact</label><input type="date" value={clientForm.lastContactDate} onChange={(e) => setClientForm({ ...clientForm, lastContactDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Next Follow-up</label><input type="date" value={clientForm.nextFollowUp} onChange={(e) => setClientForm({ ...clientForm, nextFollowUp: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                </div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea rows={3} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="Additional notes..." /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={createClient} disabled={loading} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>{loading ? 'Creating...' : 'Create'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedClient && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${n.inset} rounded-full flex items-center justify-center text-sm font-semibold ${n.secondary}`}>{(selectedClient.firstName||'?')[0]}{(selectedClient.lastName||'?')[0]}</div>
                                <div><h2 className={`text-lg font-semibold ${n.text}`}>{selectedClient.firstName} {selectedClient.lastName}</h2><p className={`text-xs ${n.tertiary}`}>{selectedClient.clientCode} · {selectedClient.email}</p></div>
                            </div>
                            <div className="flex items-center gap-1">
                                {canDelete && <button onClick={() => setShowDeleteConfirm(selectedClient.customerId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>}
                                <button onClick={() => { setShowDetailsModal(false); setSelectedClient(null); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Status + Type */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>{fmtStatus(selectedClient.status || 'new_lead')}</span>
                                <span className={`${n.secondary} flex items-center gap-1.5 text-sm`}>{getTypeIcon(selectedClient.clientType || 'buyer')}{fmtStatus(selectedClient.clientType || 'buyer')}</span>
                                {selectedClient.phone && <span className={`${n.secondary} flex items-center gap-1.5 text-sm`}><Phone className="w-3.5 h-3.5" />{selectedClient.phone}</span>}
                            </div>
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2">
                                {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Edit2 className="w-3.5 h-3.5" />Edit</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Users className="w-3.5 h-3.5" />Consultants</button>}
                                {canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><FolderOpen className="w-3.5 h-3.5" />Projects</button>}
                                {isConsultant && selectedClient.email && <a href={`mailto:${selectedClient.email}`} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}><Mail className="w-3.5 h-3.5" />Email</a>}
                                {isConsultant && selectedClient.phone && <a href={`tel:${selectedClient.phone}`} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Phone className="w-3.5 h-3.5" />Call</a>}
                            </div>
                            {/* Requirements */}
                            <div className={`${n.card} p-4`}>
                                <span className={`${n.label} text-[11px]`}>Requirements</span>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div><p className={`${n.tertiary} text-[10px]`}>Property</p><p className={`${n.text} text-sm capitalize`}>{selectedClient.propertyType || '—'}</p></div>
                                    <div><p className={`${n.tertiary} text-[10px]`}>Budget</p><p className={`${n.text} text-sm`}>{formatBudget(selectedClient.budgetMin || '', selectedClient.budgetMax || '')}</p></div>
                                    <div className="col-span-2"><p className={`${n.tertiary} text-[10px]`}>Locations</p><p className={`${n.text} text-sm`}>{selectedClient.preferredLocations || '—'}</p></div>
                                </div>
                            </div>
                            {/* Consultants */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Consultants</span>{canAssign && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getClientConsultants(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : <div className="flex flex-wrap gap-1.5">{getClientConsultants(selectedClient.customerId).map(c => <span key={c.consultantId} className={`px-2.5 py-1 ${n.flat} ${n.text} text-xs rounded-lg`}>{c.firstName} {c.lastName}</span>)}</div>}
                            </div>
                            {/* Projects */}
                            <div className={`${n.card} p-4`}>
                                <div className="flex items-center justify-between mb-2"><span className={`${n.label} text-[11px]`}>Projects</span>{canAssign && <button onClick={() => { setShowDetailsModal(false); setShowProjectsModal(true); }} className={`${n.link} text-xs`}>Manage</button>}</div>
                                {getClientProjects(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-xs`}>None assigned</p> : <div className="space-y-1.5">{getClientProjects(selectedClient.customerId).map(p => <div key={p.projectId} className={`px-3 py-2 ${n.flat} ${n.text} text-sm rounded-lg`}>{p.projectName}</div>)}</div>}
                            </div>
                            {/* Notes */}
                            {selectedClient.notes && <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Notes</span><p className={`${n.text} text-sm mt-1 leading-relaxed`}>{selectedClient.notes}</p></div>}
                            {/* Timeline */}
                            <div className={`${n.card} p-4`}>
                                <span className={`${n.label} text-[11px]`}>Timeline</span>
                                <div className="flex gap-6 mt-2">
                                    <div><p className={`${n.tertiary} text-[10px]`}>Last Contact</p><p className={`${n.text} text-sm`}>{formatDate(selectedClient.lastContactDate || '')}</p></div>
                                    <div><p className={`${n.tertiary} text-[10px]`}>Next Follow-up</p><p className={`${n.text} text-sm`}>{formatDate(selectedClient.nextFollowUp || '')}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedClient && canEdit && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Edit Client</h2>
                            <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className={`${n.card} p-4`}><span className={`${n.label} text-[11px]`}>Account (Read-only)</span><div className="flex gap-6 mt-2"><div><p className={`${n.tertiary} text-[10px]`}>Name</p><p className={`${n.text} text-sm`}>{selectedClient.firstName} {selectedClient.lastName}</p></div><div><p className={`${n.tertiary} text-[10px]`}>Email</p><p className={`${n.text} text-sm`}>{selectedClient.email}</p></div></div></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Phone</label><input type="tel" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={clientForm.status} onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="new_lead">New Lead</option><option value="contacted">Contacted</option><option value="tour_scheduled">Tour Scheduled</option><option value="offer_made">Offer Made</option><option value="closed">Closed</option><option value="lost">Lost</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Type</label><select value={clientForm.clientType} onChange={(e) => setClientForm({ ...clientForm, clientType: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="buyer">Buyer</option><option value="renter">Renter</option><option value="seller">Seller</option><option value="investor">Investor</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Property</label><select value={clientForm.propertyType} onChange={(e) => setClientForm({ ...clientForm, propertyType: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select</option><option value="apartment">Apartment</option><option value="house">House</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option><option value="commercial">Commercial</option><option value="land">Land</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Budget Min</label><input type="number" value={clientForm.budgetMin} onChange={(e) => setClientForm({ ...clientForm, budgetMin: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Budget Max</label><input type="number" value={clientForm.budgetMax} onChange={(e) => setClientForm({ ...clientForm, budgetMax: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Locations</label><input type="text" value={clientForm.preferredLocations} onChange={(e) => setClientForm({ ...clientForm, preferredLocations: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Last Contact</label><input type="date" value={clientForm.lastContactDate} onChange={(e) => setClientForm({ ...clientForm, lastContactDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Next Follow-up</label><input type="date" value={clientForm.nextFollowUp} onChange={(e) => setClientForm({ ...clientForm, nextFollowUp: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea rows={3} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={updateClient} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Consultants Modal */}
            {showConsultantsModal && selectedClient && canAssign && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Consultants</h2>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getClientConsultants(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getClientConsultants(selectedClient.customerId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                            </div>
                                            <button onClick={() => removeConsultant(c.consultantId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableConsultants(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableConsultants(selectedClient.customerId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.role || 'Consultant'}</p></div>
                                            </div>
                                            <button onClick={() => assignConsultant(c.consultantId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Projects Modal */}
            {showProjectsModal && selectedClient && canAssign && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Projects</h2>
                            <button onClick={() => { setShowProjectsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getClientProjects(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getClientProjects(selectedClient.customerId).map(p => (
                                        <div key={p.projectId} className={`${n.flat} p-3 flex items-center justify-between`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${n.inset} rounded-xl flex items-center justify-center`}><FolderOpen className={`w-4 h-4 ${n.secondary}`} /></div>
                                                <div><p className={`${n.text} text-sm font-medium`}>{p.projectName}</p><p className={`${n.tertiary} text-[11px]`}>{p.projectCode}</p></div>
                                            </div>
                                            <button onClick={() => removeProject(p.projectId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Unlink className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableProjects(selectedClient.customerId).length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p> : (
                                    <div className="space-y-1.5 mt-3">{getAvailableProjects(selectedClient.customerId).map(p => (
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
        </div>
    );
};

export default ClientsPage;