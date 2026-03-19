// src/Tabs/projects.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import {
    Calendar, Plus, Search, Filter, ChevronRight, Clock, Users,
    CheckCircle2, AlertCircle, Target, TrendingUp, X, Trash2,
    FolderOpen, RefreshCw, CheckCircle, Info, Play, Pause,
    Home, Building2, Globe, MapPin, Image, Send, Bed, Bath, Maximize, Video
} from 'lucide-react';
import AssignmentService from '../services/AssignmentService';
import ListingService from '../services/ListingService';
import type { Project, Consultant, Client, TimeEntry, DetailTab } from './ProjectDetailModal';
import ProjectDetailModal, { AMENITIES, PROPERTY_TYPES } from './ProjectDetailModal';

const API_BASE = '/api';
const STORAGE_KEYS = { timeEntries: 'timely_time_entries' };
const MAX_PHOTOS = 34;
const MAX_VIDEOS = 3;

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtStatus = (s: string): string => {
    if (!s) return 'Planning';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null;
        return await r.json();
    } catch { return null; }
};

const getCurrentUserRole = (): { role: 'admin' | 'consultant' | 'client'; email: string; customerId?: string; name?: string; consultantId?: string } => {
    try {
        const raw = sessionStorage.getItem('timely_user') || localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: 'admin@timely.com' };
        const parsed = JSON.parse(raw);
        const r = (parsed.role || 'client').toLowerCase();
        const role = (r === 'owner' || r === 'admin') ? 'admin' : r === 'consultant' ? 'consultant' : 'client';
        return { role, email: parsed.email || '', customerId: parsed.customerId, name: parsed.name, consultantId: parsed.consultantId || parsed.customerId };
    } catch { return { role: 'admin', email: 'admin@timely.com' }; }
};

// ─── Cover helpers ────────────────────────────────────────────────────────────

const COVER_GRADIENTS = [
    ['#0d1b2e', '#1a3a5c'], ['#111827', '#1e3a52'], ['#0f1f35', '#1c3554'],
    ['#0c1a2e', '#163050'], ['#13202f', '#1b3349'], ['#0e1c30', '#1a3358'],
    ['#101e32', '#1d3a5e'], ['#0b1825', '#142e4a'],
];
const COVER_ACCENTS = [
    'radial-gradient(circle at 20% 80%, rgba(59,130,246,0.25) 0%, transparent 60%)',
    'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.2) 0%, transparent 55%)',
    'radial-gradient(circle at 50% 50%, rgba(37,99,235,0.18) 0%, transparent 65%)',
    'radial-gradient(circle at 10% 30%, rgba(96,165,250,0.2) 0%, transparent 50%)',
    'radial-gradient(circle at 75% 70%, rgba(59,130,246,0.22) 0%, transparent 58%)',
    'radial-gradient(circle at 30% 60%, rgba(37,99,235,0.2) 0%, transparent 55%)',
    'radial-gradient(circle at 60% 20%, rgba(96,165,250,0.18) 0%, transparent 52%)',
    'radial-gradient(circle at 15% 85%, rgba(59,130,246,0.24) 0%, transparent 60%)',
];

const getCoverGradient = (pid: string): React.CSSProperties => {
    const hash    = pid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const [from, to] = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
    const accent  = COVER_ACCENTS[hash % COVER_ACCENTS.length];
    return { background: `${accent}, linear-gradient(145deg, ${from} 0%, ${to} 100%)` };
};

const CoverDecoration: React.FC<{ pid: string }> = ({ pid }) => {
    const hash = pid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const Icon = hash % 3 === 0 ? Home : hash % 3 === 1 ? Building2 : FolderOpen;
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <Icon className="w-28 h-28 opacity-[0.04] text-white" strokeWidth={1} />
        </div>
    );
};

const compressImage = (file: File): Promise<string> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new window.Image();
            img.onload = () => {
                const MAX = 1200;
                const ratio  = Math.min(MAX / img.width, MAX / img.height, 1);
                const canvas = document.createElement('canvas');
                canvas.width  = img.width  * ratio;
                canvas.height = img.height * ratio;
                canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = e.target!.result as string;
        };
        reader.readAsDataURL(file);
    });

// ─── Toast interface ──────────────────────────────────────────────────────────

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

// ─── Component ────────────────────────────────────────────────────────────────

const RealEstateProjects: React.FC = () => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? 'bg-[#141414]'     : 'bg-white',
        card:         isDark ? 'bg-[#1e1e1e] shadow-[6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(50,50,50,0.12)]'
                             : 'bg-white shadow-[6px_6px_14px_rgba(0,0,0,0.06),-6px_-6px_14px_rgba(255,255,255,0.9)]',
        flat:         isDark ? 'bg-[#1a1a1a] shadow-[2px_2px_6px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(50,50,50,0.08)]'
                             : 'bg-white shadow-[2px_2px_6px_rgba(0,0,0,0.04),-2px_-2px_6px_rgba(255,255,255,0.8)]',
        inset:        isDark ? 'bg-[#111111] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-3px_-3px_6px_rgba(50,50,50,0.08)]'
                             : 'bg-[#f5f5f5] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.04),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]',
        pressed:      isDark ? 'bg-[#111111] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.7),inset_-4px_-4px_8px_rgba(50,50,50,0.1)]'
                             : 'bg-[#f0f0f0] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]',
        text:         isDark ? 'text-gray-100'    : 'text-gray-900',
        secondary:    isDark ? 'text-gray-400'    : 'text-gray-500',
        tertiary:     isDark ? 'text-gray-500'    : 'text-gray-400',
        strong:       isDark ? 'text-white'       : 'text-gray-900',
        label:        isDark ? 'text-blue-400'    : 'text-blue-600',
        link:         isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500',
        input:        isDark ? 'bg-[#111111] border-gray-700 text-white'  : 'bg-white border-gray-200 text-gray-900',
        modal:        isDark ? 'bg-[#181818] border-gray-800' : 'bg-white border-gray-200',
        modalHead:    isDark ? 'bg-[#181818]'     : 'bg-white',
        btnPrimary:   'bg-blue-600 hover:bg-blue-500 text-white',
        btnSecondary: isDark ? 'bg-[#252525] hover:bg-[#2a2a2a] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800',
        btnDanger:    'bg-red-600 hover:bg-red-500 text-white',
        divider:      isDark ? 'border-gray-800'  : 'border-gray-100',
        edgeHover: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(50,50,50,0.12)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),8px_8px_20px_rgba(0,0,0,0.08),-8px_-8px_20px_rgba(255,255,255,0.95)]',
        edgeHoverFlat: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(50,50,50,0.1)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.12),4px_4px_10px_rgba(0,0,0,0.06),-4px_-4px_10px_rgba(255,255,255,0.9)]',
    };

    const { role: userRole, email: userEmail, customerId: userCustomerId, name: userName, consultantId: userConsultantId } =
        useMemo(() => getCurrentUserRole(), []);
    const isAdmin      = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient     = userRole === 'client';
    const canEdit      = isAdmin || isConsultant;

    // ── Core state ────────────────────────────────────────────────────────────
    const [toasts, setToasts]           = useState<Toast[]>([]);
    const [projects, setProjects]       = useState<Project[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [clients, setClients]         = useState<Client[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);

    // ── Modal state ───────────────────────────────────────────────────────────
    const [selectedProject,      setSelectedProject]      = useState<Project | null>(null);
    const [showCreateModal,      setShowCreateModal]      = useState(false);
    const [showDetailsModal,     setShowDetailsModal]     = useState(false);
    const [showEditModal,        setShowEditModal]        = useState(false);
    const [showConsultantsModal, setShowConsultantsModal] = useState(false);
    const [showClientsModal,     setShowClientsModal]     = useState(false);
    const [showTimeModal,        setShowTimeModal]        = useState(false);
    const [showDeleteConfirm,    setShowDeleteConfirm]    = useState<string | null>(null);
    const [showGallery,          setShowGallery]          = useState(false);
    const [galleryIndex,         setGalleryIndex]         = useState(0);
    const [detailTab,            setDetailTab]            = useState<DetailTab>('overview');

    // ── UI state ──────────────────────────────────────────────────────────────
    const [searchTerm,   setSearchTerm]   = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters,  setShowFilters]  = useState(false);
    const [loading,      setLoading]      = useState(false);
    const [refreshing,   setRefreshing]   = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [videoUploading, setVideoUploading] = useState(false);

    // ── Timer state ───────────────────────────────────────────────────────────
    const [activeTimer,  setActiveTimer]  = useState<{ projectId: string; startTime: number } | null>(null);
    const [timerDisplay, setTimerDisplay] = useState('00:00:00');
    const [timeForm, setTimeForm] = useState({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });

    // ── Form state (lazy initializers — fresh object each mount) ──────────────
    const [projectForm,  setProjectForm]  = useState(() => ({
        projectName: '', description: '', status: 'planning', priority: 'medium',
        startDate: new Date().toISOString().split('T')[0], endDate: '', budget: '',
        selectedConsultants: [] as string[], selectedClients: [] as string[],
    }));
    const [propertyForm, setPropertyForm] = useState(() => ({
        address: '', city: '', state: '', zip: '',
        propertyType: 'house', bedrooms: '', bathrooms: '',
        sqft: '', lotSize: '', yearBuilt: '', amenities: [] as string[],
        listingPrice: '', listingStatus: 'active',
    }));

    // ── Status definitions ────────────────────────────────────────────────────
    const statuses = [
        { value: 'planning',    label: 'Planning',    color: 'bg-blue-600',    icon: Target },
        { value: 'in_progress', label: 'In Progress', color: 'bg-emerald-600', icon: TrendingUp },
        { value: 'active',      label: 'Active',      color: 'bg-emerald-600', icon: TrendingUp },
        { value: 'on_hold',     label: 'On Hold',     color: 'bg-amber-600',   icon: Clock },
        { value: 'completed',   label: 'Completed',   color: 'bg-gray-600',    icon: CheckCircle2 },
        { value: 'cancelled',   label: 'Cancelled',   color: 'bg-red-600',     icon: X },
    ];

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub   = AssignmentService.subscribe(() => setAssignmentRefreshKey(k => k + 1));
        const handler = () => setAssignmentRefreshKey(k => k + 1);
        window.addEventListener('assignment-change', handler);
        return () => { unsub(); window.removeEventListener('assignment-change', handler); };
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (activeTimer) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000);
                const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
                setTimerDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimer]);

    useEffect(() => { loadAllData(); }, []);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadAllData = async () => {
        setRefreshing(true);
        await Promise.all([loadProjects(), loadConsultants(), loadClients()]);
        loadTimeEntries();
        await AssignmentService.syncClientConsultantsFromAPI();
        setAssignmentRefreshKey(k => k + 1);
        setRefreshing(false);
    };

    const loadProjects = async () => {
        const d = await safeFetch(`${API_BASE}/projects`);
        if (d?.data) {
            setProjects(d.data);
            // Sync any assignment data embedded in the API response into localStorage
            for (const p of d.data) {
                const pid = String(p.projectId);
                if (Array.isArray(p.assignedClients)) {
                    for (const cid of p.assignedClients) AssignmentService.assignClientToProject(pid, String(cid));
                }
                if (Array.isArray(p.assignedConsultants)) {
                    for (const cid of p.assignedConsultants) AssignmentService.assignConsultantToProject(pid, String(cid));
                }
                if (p.clientId) AssignmentService.assignClientToProject(pid, String(p.clientId));
            }
        }
    };

    const loadConsultants = async () => { const d = await safeFetch(`${API_BASE}/consultants`); if (d?.data) setConsultants(d.data); };
    const loadClients = async () => { const d = await safeFetch(`${API_BASE}/orgs/me`); if (d?.data?.members) setClients(d.data.members.filter((m: any) => m.role === 'client').map((m: any) => { const u = m.user || m; return { customerId: String(m.userId || u.id || ''), firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '' }; })); };

    const loadTimeEntries = () => {
        try { const data = localStorage.getItem(STORAGE_KEYS.timeEntries); if (data) setTimeEntries(JSON.parse(data)); } catch {}
    };
    const saveTimeEntries = (data: TimeEntry[]) => {
        localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data));
        setTimeEntries(data);
    };

    // ── Form reset (fresh object every call) ──────────────────────────────────
    const resetProjectForm = useCallback(() => {
        setProjectForm({
            projectName: '', description: '', status: 'planning', priority: 'medium',
            startDate: new Date().toISOString().split('T')[0], endDate: '', budget: '',
            selectedConsultants: [], selectedClients: [],
        });
    }, []);

    const resetPropertyForm = useCallback(() => {
        setPropertyForm({
            address: '', city: '', state: '', zip: '',
            propertyType: 'house', bedrooms: '', bathrooms: '',
            sqft: '', lotSize: '', yearBuilt: '', amenities: [],
            listingPrice: '', listingStatus: 'active',
        });
    }, []);

    // ── Project CRUD ──────────────────────────────────────────────────────────
    const getClientNameFromSelection = () => {
        if (projectForm.selectedClients.length === 0) return '';
        const c = clients.find(c => c.customerId === projectForm.selectedClients[0]);
        return c ? `${c.firstName} ${c.lastName}` : '';
    };

    const createProject = async () => {
        if (!isAdmin) { showToast('Only admins can create projects', 'error'); return; }
        if (!projectForm.projectName) { showToast('Project name is required', 'error'); return; }
        setLoading(true);
        const clientName     = getClientNameFromSelection();
        const selConsultants = [...projectForm.selectedConsultants];
        const selClients     = [...projectForm.selectedClients];

        try {
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: projectForm.projectName, clientName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget, createdBy: userEmail }),
            });
            if (res.ok) {
                const data = await res.json();
                const newId = String(data.projectId || data.data?.projectId || data.id || data.data?.id);

                // Assign via API
                if (selClients.length > 0 || selConsultants.length > 0) {
                    await fetch(`${API_BASE}/projects/assign`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId: selClients[0] || undefined, projectId: newId, consultantIds: selConsultants }),
                    }).catch(() => {});
                }

                // FIX: Also mirror assignments into AssignmentService (localStorage)
                // so the project is immediately visible to the assigned client/consultant
                if (selClients.length > 0 || selConsultants.length > 0) {
                    AssignmentService.setupProjectAssignments(newId, selConsultants, selClients);
                }

                showToast('Project created!', 'success');
                window.dispatchEvent(new Event('project-change'));

                // FIX: Close modal and fully reset BOTH forms before reloading
                setShowCreateModal(false);
                resetProjectForm();
                resetPropertyForm();

                await loadProjects();
                setAssignmentRefreshKey(k => k + 1);
            } else {
                showToast('Failed to create project', 'error');
            }
        } catch {
            showToast('Failed to create project', 'error');
        }
        setLoading(false);
    };

    const updateProject = async () => {
        if (!selectedProject || !canEdit) { showToast('No permission', 'error'); return; }
        const updated: Project = { ...selectedProject, projectName: projectForm.projectName, description: projectForm.description, status: projectForm.status, priority: projectForm.priority, startDate: projectForm.startDate, endDate: projectForm.endDate, budget: projectForm.budget };
        try { await fetch(`${API_BASE}/project-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: updated.projectId, status: updated.status, priority: updated.priority, description: updated.description, name: updated.projectName }) }); } catch {}
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        setShowEditModal(false); setShowDetailsModal(true);
        showToast('Project updated', 'success');
        window.dispatchEvent(new Event('project-change'));
    };

    const updateProjectStatus = async (projectId: string, newStatus: string) => {
        if (!canEdit) { showToast('No permission', 'error'); return; }
        const project = projects.find(p => p.projectId === projectId);
        if (!project) return;
        const updated = { ...project, status: newStatus };
        try { await fetch(`${API_BASE}/project-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, status: newStatus }) }); } catch {}
        setProjects(projects.map(p => p.projectId === projectId ? updated : p));
        if (selectedProject?.projectId === projectId) setSelectedProject(updated);
        showToast(`Status → ${fmtStatus(newStatus)}`, 'success');
        window.dispatchEvent(new Event('project-change'));
    };

    const deleteProject = async (pid: string) => {
        if (!isAdmin) { showToast('Only admins can delete', 'error'); return; }
        try {
            const res = await fetch(`${API_BASE}/projects/${pid}`, { method: 'DELETE' });
            if (res.ok) {
                AssignmentService.cleanupProjectAssignments(pid);
                setProjects(prev => prev.filter(p => p.projectId !== pid));
                setShowDeleteConfirm(null); setShowDetailsModal(false); setSelectedProject(null);
                showToast('Project deleted', 'success');
                window.dispatchEvent(new Event('project-change'));
            } else { showToast('Failed to delete', 'error'); }
        } catch { showToast('Failed to delete', 'error'); }
    };

    // ── Photo handlers ────────────────────────────────────────────────────────
    const handlePhotoUpload = async (files: FileList | null) => {
        if (!files || !selectedProject) return;
        setPhotoUploading(true);
        const existing = (selectedProject.photos as string[]) || [];
        const remaining = MAX_PHOTOS - existing.length;
        const newPhotos: string[] = [];
        for (const file of Array.from(files).slice(0, remaining)) {
            if (file.type.startsWith('image/')) newPhotos.push(await compressImage(file));
        }
        const allPhotos = [...existing, ...newPhotos];
        try {
            const res = await fetch(`${API_BASE}/projects/${selectedProject.projectId}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: allPhotos, coverPhotoIndex: selectedProject.coverPhotoIndex || 0 }) });
            if (!res.ok) throw new Error('Failed');
        } catch { showToast('Failed to save photos', 'error'); setPhotoUploading(false); return; }
        const updated: Project = { ...selectedProject, photos: allPhotos };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        setPhotoUploading(false);
        showToast(`${newPhotos.length} photo${newPhotos.length !== 1 ? 's' : ''} added`, 'success');
    };

    const removePhoto = async (index: number) => {
        if (!selectedProject) return;
        const photos = ((selectedProject.photos as string[]) || []).filter((_, i) => i !== index);
        const cover = selectedProject.coverPhotoIndex || 0;
        const coverPhotoIndex = cover === index ? 0 : cover > index ? cover - 1 : cover;
        try { await fetch(`${API_BASE}/projects/${selectedProject.projectId}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos, coverPhotoIndex }) }); } catch {}
        const updated: Project = { ...selectedProject, photos, coverPhotoIndex };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
    };

    const setCoverPhoto = async (index: number) => {
        if (!selectedProject) return;
        try { await fetch(`${API_BASE}/projects/${selectedProject.projectId}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coverPhotoIndex: index }) }); } catch {}
        const updated: Project = { ...selectedProject, coverPhotoIndex: index };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        showToast('Cover photo updated', 'success');
    };

    // ── Video handlers ────────────────────────────────────────────────────────
    const handleVideoUpload = async (files: FileList | null) => {
        if (!files || !selectedProject) return;
        setVideoUploading(true);
        const existing = (selectedProject.videos as string[]) || [];
        const remaining = MAX_VIDEOS - existing.length;
        const newVideos: string[] = [];
        for (const file of Array.from(files).slice(0, remaining)) {
            if (file.type.startsWith('video/')) {
                const dataUrl = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target!.result as string);
                    reader.readAsDataURL(file);
                });
                newVideos.push(dataUrl);
            }
        }
        const allVideos = [...existing, ...newVideos];
        try { await fetch(`${API_BASE}/projects/${selectedProject.projectId}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos: allVideos }) }); } catch { showToast('Failed to save videos', 'error'); setVideoUploading(false); return; }
        const updated: Project = { ...selectedProject, videos: allVideos };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        setVideoUploading(false);
        showToast(`${newVideos.length} video${newVideos.length !== 1 ? 's' : ''} added`, 'success');
    };

    const removeVideo = async (index: number) => {
        if (!selectedProject) return;
        const videos = ((selectedProject.videos as string[]) || []).filter((_, i) => i !== index);
        try { await fetch(`${API_BASE}/projects/${selectedProject.projectId}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos }) }); } catch {}
        const updated: Project = { ...selectedProject, videos };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        showToast('Video removed', 'success');
    };

    // ── Property / Listing save ───────────────────────────────────────────────
    const savePropertyDetails = async () => {
        if (!selectedProject) return;
        try {
            const res = await fetch(`${API_BASE}/projects/${selectedProject.projectId}/property`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: propertyForm.address, city: propertyForm.city, state: propertyForm.state, zip: propertyForm.zip, propertyType: propertyForm.propertyType, bedrooms: propertyForm.bedrooms, bathrooms: propertyForm.bathrooms, sqft: propertyForm.sqft, lotSize: propertyForm.lotSize, yearBuilt: propertyForm.yearBuilt, amenities: propertyForm.amenities }) });
            if (!res.ok) throw new Error('Failed');
        } catch { showToast('Failed to save property', 'error'); return; }
        const updated: Project = { ...selectedProject, address: propertyForm.address, city: propertyForm.city, state: propertyForm.state, zip: propertyForm.zip, propertyType: propertyForm.propertyType, bedrooms: propertyForm.bedrooms, bathrooms: propertyForm.bathrooms, sqft: propertyForm.sqft, lotSize: propertyForm.lotSize, yearBuilt: propertyForm.yearBuilt, amenities: propertyForm.amenities };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        showToast('Property details saved', 'success');
        setDetailTab('overview');
    };

    const saveListingDetails = async () => {
        if (!selectedProject) return;
        try {
            const res = await fetch(`${API_BASE}/projects/${selectedProject.projectId}/listing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingPrice: propertyForm.listingPrice, listingStatus: propertyForm.listingStatus }) });
            if (!res.ok) throw new Error('Failed');
        } catch { showToast('Failed to save listing', 'error'); return; }
        const updated: Project = { ...selectedProject, listingPrice: propertyForm.listingPrice, listingStatus: propertyForm.listingStatus };
        setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
        setSelectedProject(updated);
        showToast('Listing details saved', 'success');
        setDetailTab('overview');
    };

    const togglePublish = async () => {
        if (!selectedProject || !isAdmin) return;
        try {
            const res = await fetch(`${API_BASE}/projects/${selectedProject.projectId}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            const updated: Project = { ...selectedProject, isPublished: data.isPublished, listingSlug: data.listingSlug, publishedAt: data.isPublished ? (selectedProject.publishedAt || new Date().toISOString()) : selectedProject.publishedAt };
            setProjects(projects.map(p => p.projectId === updated.projectId ? updated : p));
            setSelectedProject(updated);
            showToast(data.isPublished ? 'Listing enabled for assigned clients' : 'Listing hidden', data.isPublished ? 'success' : 'info');
            window.dispatchEvent(new Event('listing-change'));
        } catch { showToast('Failed to toggle publish', 'error'); }
    };

    const toggleAmenity = (amenity: string) =>
        setPropertyForm(f => ({ ...f, amenities: f.amenities.includes(amenity) ? f.amenities.filter(a => a !== amenity) : [...f.amenities, amenity] }));

    // ── Timer ─────────────────────────────────────────────────────────────────
    const startTimer = (projectId: string) => {
        if (!canEdit) { showToast('No permission', 'error'); return; }
        setActiveTimer({ projectId, startTime: Date.now() });
        showToast('Timer started', 'info');
    };

    const stopTimer = () => {
        if (!activeTimer) return;
        const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000);
        setTimeForm({ hours: Math.floor(elapsed / 3600), minutes: Math.floor((elapsed % 3600) / 60), description: '', date: new Date().toISOString().split('T')[0] });
        setSelectedProject(projects.find(p => p.projectId === activeTimer.projectId) || null);
        setActiveTimer(null); setTimerDisplay('00:00:00'); setShowTimeModal(true);
    };

    const addTimeEntry = () => {
        if (!selectedProject || !canEdit) return;
        if (timeForm.hours === 0 && timeForm.minutes === 0) { showToast('Enter time worked', 'error'); return; }
        const entry: TimeEntry = {
            id: `time_${Date.now()}`, projectId: selectedProject.projectId,
            consultantId: userConsultantId || userEmail, consultantName: userName || userEmail,
            date: timeForm.date, hours: timeForm.hours, minutes: timeForm.minutes,
            description: timeForm.description, createdAt: new Date().toISOString(),
        };
        saveTimeEntries([...timeEntries, entry]);
        setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });
        setShowTimeModal(false);
        showToast(`Logged ${timeForm.hours}h ${timeForm.minutes}m`, 'success');
        window.dispatchEvent(new Event('hours-change'));
    };

    const deleteTimeEntry = (id: string) => {
        const entry = timeEntries.find(e => e.id === id);
        if (!entry) return;
        if (!isAdmin && entry.consultantId !== (userConsultantId || userEmail)) { showToast('Can only delete your own entries', 'error'); return; }
        saveTimeEntries(timeEntries.filter(e => e.id !== id));
        showToast('Entry deleted', 'success');
        window.dispatchEvent(new Event('hours-change'));
    };

    // ── Assignments (FIX: all handlers now sync BOTH localStorage AND API) ───
    const getProjectTimeEntries = (pid: string) => timeEntries.filter(te => te.projectId === pid);
    const getProjectTotalTime   = (pid: string) => {
        const totalMin = getProjectTimeEntries(pid).reduce((s, e) => s + (e.hours * 60) + e.minutes, 0);
        return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
    };

    const assignConsultantToProject = async (cid: string) => {
        if (!isAdmin || !selectedProject) return;
        const r = AssignmentService.assignConsultantToProject(selectedProject.projectId, cid);
        try { await fetch(`${API_BASE}/projects/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject.projectId, consultantIds: [cid] }) }); } catch {}
        setAssignmentRefreshKey(k => k + 1);
        showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info');
    };
    const removeConsultantFromProject = async (cid: string) => {
        if (!isAdmin || !selectedProject) return;
        AssignmentService.removeConsultantFromProject(selectedProject.projectId, cid);
        try { await fetch(`${API_BASE}/projects/unassign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject.projectId, consultantId: cid }) }); } catch {}
        setAssignmentRefreshKey(k => k + 1);
        showToast('Removed', 'success');
    };
    const assignClientToProject = async (cid: string) => {
        if (!isAdmin || !selectedProject) return;
        const r = AssignmentService.assignClientToProject(selectedProject.projectId, cid);
        try { await fetch(`${API_BASE}/projects/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject.projectId, clientId: cid }) }); } catch {}
        setAssignmentRefreshKey(k => k + 1);
        showToast(r ? 'Assigned' : 'Already assigned', r ? 'success' : 'info');
    };
    const removeClientFromProject = async (cid: string) => {
        if (!isAdmin || !selectedProject) return;
        AssignmentService.removeClientFromProject(selectedProject.projectId, cid);
        try { await fetch(`${API_BASE}/projects/unassign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject.projectId, clientId: cid }) }); } catch {}
        setAssignmentRefreshKey(k => k + 1);
        showToast('Removed', 'success');
    };

    const getProjectConsultants   = (pid: string) => { const ids = AssignmentService.getConsultantsForProject(String(pid)); return consultants.filter(c => ids.includes(c.consultantId)); };
    const getProjectClients       = (pid: string) => { const ids = AssignmentService.getClientsForProject(String(pid));     return clients.filter(c => ids.includes(c.customerId)); };
    const getAvailableConsultants = (pid: string) => { const ids = AssignmentService.getConsultantsForProject(pid); return consultants.filter(c => !ids.includes(c.consultantId)); };
    const getAvailableClients     = (pid: string) => { const ids = AssignmentService.getClientsForProject(pid);     return clients.filter(c => !ids.includes(c.customerId)); };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const openProjectDetails = (p: Project) => {
        setSelectedProject(p);
        setDetailTab('overview');
        setProjectForm({ projectName: p.projectName, description: p.description || '', status: p.status, priority: p.priority || 'medium', startDate: p.startDate || '', endDate: p.endDate || '', budget: p.budget || '', selectedConsultants: [], selectedClients: [] });
        setPropertyForm({ address: p.address || '', city: p.city || '', state: p.state || '', zip: p.zip || '', propertyType: p.propertyType || 'house', bedrooms: p.bedrooms || '', bathrooms: p.bathrooms || '', sqft: p.sqft || '', lotSize: p.lotSize || '', yearBuilt: p.yearBuilt || '', amenities: p.amenities || [], listingPrice: p.listingPrice || '', listingStatus: p.listingStatus || 'active' });
        setShowDetailsModal(true);
    };

    const getPriorityColor = (p: string) => ({ low: 'text-gray-400', medium: 'text-amber-400', high: 'text-orange-400', urgent: 'text-red-400' }[p] || 'text-gray-400');
    const formatDate       = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const formatBudget     = (b: string) => b ? `$${Number(b).toLocaleString()}` : null;
    const formatTime       = (h: number, m: number) => `${h}h ${m}m`;
    const getPublicUrl     = (slug: string) => ListingService.getPublicUrl(slug);

    // ── Filtered projects ─────────────────────────────────────────────────────
    const filteredProjects = useMemo(() => {
        let filtered = projects;
        if (isClient && userCustomerId)       { const ids = AssignmentService.getProjectsForClient(userCustomerId);       filtered = filtered.filter(p => ids.includes(String(p.projectId))); }
        if (isConsultant && userConsultantId) { const ids = AssignmentService.getProjectsForConsultant(userConsultantId); filtered = filtered.filter(p => ids.includes(String(p.projectId))); }
        filtered = filtered.filter(p => {
            const matchSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || (p.projectCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchSearch && matchStatus;
        });
        return filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [projects, searchTerm, statusFilter, isClient, isConsultant, userCustomerId, userConsultantId, assignmentRefreshKey]);

    const pStats = useMemo(() => ({
        total:     filteredProjects.length,
        active:    filteredProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length,
        completed: filteredProjects.filter(p => p.status === 'completed').length,
    }), [filteredProjects]);

    // ── Cover helper ──────────────────────────────────────────────────────────
    const ProjectCover: React.FC<{ p: Project }> = ({ p }) => {
        const src = p.photos && p.photos.length > 0 ? (p.photos as string[])[p.coverPhotoIndex || 0] : null;
        return src ? (
            <img src={src} alt={p.projectName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
            <>
                <div className="absolute inset-0" style={getCoverGradient(p.projectId)} />
                <CoverDecoration pid={p.projectId} />
            </>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>
                        {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {activeTimer && (
                <div className="fixed bottom-4 right-4 z-[9998]">
                    <div className={`${n.card} p-4 flex items-center gap-4 rounded-2xl`}>
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div>
                            <p className={`${n.text} font-mono text-xl`}>{timerDisplay}</p>
                            <p className={`${n.tertiary} text-xs`}>{projects.find(p => p.projectId === activeTimer.projectId)?.projectName}</p>
                        </div>
                        <button onClick={stopTimer} className={`px-4 py-2 ${n.btnDanger} rounded-lg flex items-center gap-2 text-sm`}>
                            <Pause className="w-4 h-4" />Stop
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Projects</h1>
                        <p className={`text-sm ${n.secondary}`}>
                            {isAdmin ? 'Manage all projects and assignments' : isConsultant ? 'Track time and update project status' : 'View your assigned projects'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadAllData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                            <RefreshCw className={`w-4 h-4 ${n.secondary} ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        {isAdmin && (
                            <button onClick={() => { resetProjectForm(); resetPropertyForm(); setShowCreateModal(true); }} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium`}>
                                <Plus className="w-4 h-4" />New Project
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Total Projects', value: pStats.total, dot: 'bg-blue-500' },
                        { label: 'Active', value: pStats.active, dot: 'bg-emerald-500' },
                        { label: 'Completed', value: pStats.completed, dot: 'bg-gray-500' },
                    ].map((st, i) => (
                        <div key={i} className={`${n.card} ${n.edgeHover} p-5 transition-all rounded-2xl`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                                <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                            </div>
                            <div className={`text-3xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 items-center mb-4">
                    <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5 rounded-xl`}>
                        <Search className={`w-4 h-4 ${n.tertiary} flex-shrink-0`} />
                        <input type="text" placeholder="Search by name, code, or client…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        {searchTerm && <button onClick={() => setSearchTerm('')}><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.pressed : n.flat} flex items-center justify-center rounded-xl`}>
                        <Filter className={`w-4 h-4 ${showFilters ? n.label : n.secondary}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className={`${n.card} p-4 mb-6 rounded-2xl flex items-center gap-4`}>
                        <div>
                            <label className={`${n.tertiary} text-[11px] block mb-1.5 uppercase tracking-wider`}>Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm focus:outline-none min-w-[160px]`}>
                                <option value="all">All Statuses</option>
                                {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                            </select>
                        </div>
                        {statusFilter !== 'all' && (
                            <button onClick={() => setStatusFilter('all')} className={`mt-5 text-xs ${n.link} flex items-center gap-1`}><X className="w-3 h-3" />Clear</button>
                        )}
                    </div>
                )}

                {filteredProjects.length === 0 ? (
                    <div className={`${n.card} rounded-2xl text-center py-20`}>
                        <FolderOpen className={`w-12 h-12 ${n.tertiary} mx-auto mb-4`} strokeWidth={1.5} />
                        <p className={`${n.secondary} text-sm`}>{isClient || isConsultant ? 'No projects assigned to you yet' : 'No projects match your search'}</p>
                        {isAdmin && (
                            <button onClick={() => { resetProjectForm(); resetPropertyForm(); setShowCreateModal(true); }} className={`mt-5 px-4 py-2 ${n.btnPrimary} rounded-xl text-sm inline-flex items-center gap-2`}>
                                <Plus className="w-4 h-4" />Create your first project
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredProjects.map(p => {
                            const statusInfo = statuses.find(s => s.value === p.status);
                            const pClients = getProjectClients(p.projectId);
                            const pConsultants = getProjectConsultants(p.projectId);
                            const totalTime = getProjectTotalTime(p.projectId);
                            const teamCount = pClients.length + pConsultants.length;
                            const clientLabel = pClients.length > 0 ? `${pClients[0].firstName} ${pClients[0].lastName}${pClients.length > 1 ? ` +${pClients.length - 1}` : ''}` : p.clientName || null;
                            const hasPhotos = p.photos && (p.photos as string[]).length > 0;
                            const hasVideos = p.videos && (p.videos as string[]).length > 0;
                            const displayPrice = p.listingPrice ? `$${Number(p.listingPrice).toLocaleString()}` : formatBudget(p.budget);

                            return (
                                <div key={p.projectId} className={`${n.card} rounded-2xl overflow-hidden group transition-all duration-200 ${n.edgeHover} flex flex-col`}>
                                    <div className="relative h-44 flex-shrink-0 overflow-hidden">
                                        <ProjectCover p={p} />
                                        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1.5 ${statusInfo?.color || 'bg-gray-600'}`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/70" />{fmtStatus(p.status)}
                                        </div>
                                        {p.isPublished && (
                                            <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-600 rounded-lg text-[10px] font-semibold text-white flex items-center gap-1">
                                                <Globe className="w-2.5 h-2.5" />Listing On
                                            </div>
                                        )}
                                        {isAdmin && !p.isPublished && (
                                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(p.projectId); }} className="w-7 h-7 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-red-500/80 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5 text-white" />
                                                </button>
                                            </div>
                                        )}
                                        {displayPrice && (
                                            <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/55 backdrop-blur-sm rounded-lg text-white text-xs font-semibold">{displayPrice}</div>
                                        )}
                                        <div className="absolute bottom-3 left-3 flex gap-1.5">
                                            {teamCount > 0 && <div className="px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/80 text-[11px] flex items-center gap-1"><Users className="w-3 h-3" />{teamCount}</div>}
                                            {hasPhotos && <div className="px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/80 text-[11px] flex items-center gap-1"><Image className="w-3 h-3" />{(p.photos as string[]).length}</div>}
                                            {hasVideos && <div className="px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/80 text-[11px] flex items-center gap-1"><Video className="w-3 h-3" />{(p.videos as string[]).length}</div>}
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-6" style={{ background: isDark ? 'linear-gradient(to bottom, transparent, #1e1e1e)' : 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.9))' }} />
                                    </div>
                                    <div className="p-4 flex flex-col flex-1 gap-2.5">
                                        <div>
                                            <h3 className={`${n.strong} font-semibold text-[15px] leading-snug`}>{p.projectName}</h3>
                                            <p className={`${n.tertiary} text-[11px] mt-0.5 font-mono`}>{p.projectCode}</p>
                                        </div>
                                        {(p.city || p.address) && <div className="flex items-center gap-1.5"><MapPin className={`w-3 h-3 ${n.tertiary} flex-shrink-0`} /><span className={`${n.secondary} text-xs truncate`}>{[p.address, p.city, p.state].filter(Boolean).join(', ')}</span></div>}
                                        {(p.bedrooms || p.bathrooms || p.sqft) && (
                                            <div className={`flex items-center gap-3 text-[11px] ${n.tertiary}`}>
                                                {p.bedrooms && <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.bedrooms} bd</span>}
                                                {p.bathrooms && <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.bathrooms} ba</span>}
                                                {p.sqft && <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{Number(p.sqft).toLocaleString()} sqft</span>}
                                            </div>
                                        )}
                                        {clientLabel && <div className="flex items-center gap-1.5"><Users className={`w-3.5 h-3.5 ${n.tertiary} flex-shrink-0`} /><span className={`${n.secondary} text-xs truncate`}>{clientLabel}</span></div>}
                                        {p.description && <p className={`${n.secondary} text-xs leading-relaxed line-clamp-2`}>{p.description}</p>}
                                        {(p.startDate || p.endDate) && (
                                            <div className={`flex items-center gap-1.5 text-[11px] ${n.tertiary}`}>
                                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                                <span>{p.startDate ? formatDate(p.startDate) : '—'}{p.endDate && ` — ${formatDate(p.endDate)}`}</span>
                                            </div>
                                        )}
                                        <div className="flex-1" />
                                        <div className={`flex items-center justify-between pt-3 border-t ${n.divider}`}>
                                            <div className={`flex items-center gap-1.5 text-[11px] ${n.tertiary}`}><Clock className="w-3 h-3" />{formatTime(totalTime.hours, totalTime.minutes)}</div>
                                            <div className="flex items-center gap-1.5">
                                                {canEdit && !activeTimer && (
                                                    <button onClick={e => { e.stopPropagation(); startTimer(p.projectId); }} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center`} title="Start timer"><Play className="w-3 h-3 text-emerald-400" /></button>
                                                )}
                                                <button onClick={() => openProjectDetails(p)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-[11px] font-medium flex items-center gap-1`}>View Details<ChevronRight className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ProjectDetailModal
                isDark={isDark} n={n} isAdmin={isAdmin} isConsultant={isConsultant} canEdit={canEdit}
                userConsultantId={userConsultantId} userEmail={userEmail} userName={userName}
                selectedProject={selectedProject} consultants={consultants} clients={clients}
                timeEntries={timeEntries} statuses={statuses}
                showDetailsModal={showDetailsModal} showCreateModal={showCreateModal} showEditModal={showEditModal}
                showConsultantsModal={showConsultantsModal} showClientsModal={showClientsModal}
                showTimeModal={showTimeModal} showDeleteConfirm={showDeleteConfirm}
                showGallery={showGallery} galleryIndex={galleryIndex}
                projectForm={projectForm} propertyForm={propertyForm} detailTab={detailTab}
                loading={loading} photoUploading={photoUploading} videoUploading={videoUploading}
                timeForm={timeForm}
                setDetailTab={setDetailTab} setGalleryIndex={setGalleryIndex}
                setShowDetailsModal={setShowDetailsModal} setShowCreateModal={setShowCreateModal}
                setShowEditModal={setShowEditModal} setShowConsultantsModal={setShowConsultantsModal}
                setShowClientsModal={setShowClientsModal} setShowTimeModal={setShowTimeModal}
                setShowDeleteConfirm={setShowDeleteConfirm} setShowGallery={setShowGallery}
                setSelectedProject={setSelectedProject} setProjectForm={setProjectForm}
                setPropertyForm={setPropertyForm} setTimeForm={setTimeForm}
                createProject={createProject} updateProject={updateProject}
                deleteProject={deleteProject} updateProjectStatus={updateProjectStatus}
                handlePhotoUpload={handlePhotoUpload} removePhoto={removePhoto} setCoverPhoto={setCoverPhoto}
                handleVideoUpload={handleVideoUpload} removeVideo={removeVideo}
                savePropertyDetails={savePropertyDetails} saveListingDetails={saveListingDetails}
                togglePublish={togglePublish} toggleAmenity={toggleAmenity}
                addTimeEntry={addTimeEntry} deleteTimeEntry={deleteTimeEntry}
                assignConsultantToProject={assignConsultantToProject} removeConsultantFromProject={removeConsultantFromProject}
                assignClientToProject={assignClientToProject} removeClientFromProject={removeClientFromProject}
                getProjectConsultants={getProjectConsultants} getProjectClients={getProjectClients}
                getAvailableConsultants={getAvailableConsultants} getAvailableClients={getAvailableClients}
                getProjectTimeEntries={getProjectTimeEntries} getProjectTotalTime={getProjectTotalTime}
                resetProjectForm={resetProjectForm} showToast={showToast}
                formatDate={formatDate} formatBudget={formatBudget} formatTime={formatTime}
                getPriorityColor={getPriorityColor} fmtStatus={fmtStatus} getPublicUrl={getPublicUrl}
            />
        </div>
    );
};

export default RealEstateProjects;