// src/Tabs/ProjectDetailModal.tsx
//
// Contains all modals for the Projects page:
//   - Tabbed Detail Modal (Overview / Property / Listing / Team / Progress)
//   - Create Modal
//   - Edit Modal
//   - Time Log Modal
//   - Manage Consultants Modal
//   - Manage Clients Modal

import React, { useRef } from 'react';
import {
    X, Trash2, FolderOpen, Globe, Info, Home, Users, Clock,
    Target, TrendingUp, CheckCircle2, CheckCircle, Edit2, Timer,
    Save, Plus, Camera, Upload, Star, RefreshCw, Send, Copy,
    ExternalLink, Eye, EyeOff, UserMinus, Link2, AlertCircle,
    Video, PlayCircle
} from 'lucide-react';
import ListingService from '../services/ListingService';

// ─── Types (mirrored from projects.tsx) ──────────────────────────────────────

export interface Project {
    projectId: string; projectCode: string; projectName: string;
    clientName?: string; description: string; status: string;
    priority: string; startDate: string; endDate: string;
    budget: string; createdAt: string; createdBy?: string;
    address?: string; city?: string; state?: string; zip?: string;
    propertyType?: string; bedrooms?: string; bathrooms?: string;
    sqft?: string; lotSize?: string; yearBuilt?: string;
    amenities?: string[]; photos?: string[]; coverPhotoIndex?: number;
    videos?: string[];
    listingPrice?: string; listingStatus?: string;
    isPublished?: boolean; publishedAt?: string; listingSlug?: string;
}

export interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; }
export interface Client     { customerId: string; clientCode: string; firstName: string; lastName: string; email: string; }
export interface TimeEntry  { id: string; projectId: string; consultantId: string; consultantName: string; date: string; hours: number; minutes: number; description: string; createdAt: string; }

export type DetailTab = 'overview' | 'property' | 'listing' | 'team' | 'progress';

export const AMENITIES = [
    'Pool', 'Gym', 'Garage', 'Parking', 'Garden', 'Balcony',
    'Terrace', 'Elevator', 'Security System', 'Pet Friendly',
    'Air Conditioning', 'Heating', 'Storage', 'In-Unit Laundry',
    'Furnished', 'Smart Home', 'Fireplace', 'Solar Panels',
];

export const PROPERTY_TYPES = [
    { value: 'house',        label: 'House' },
    { value: 'condo',        label: 'Condo' },
    { value: 'townhouse',    label: 'Townhouse' },
    { value: 'commercial',   label: 'Commercial' },
    { value: 'multi_family', label: 'Multi-Family' },
    { value: 'apartment',    label: 'Apartment' },
    { value: 'land',         label: 'Land' },
];

export const LISTING_STATUSES = [
    { value: 'active',  label: 'Active',  color: 'bg-emerald-600 text-white' },
    { value: 'pending', label: 'Pending', color: 'bg-amber-600 text-white' },
    { value: 'sold',    label: 'Sold',    color: 'bg-gray-600 text-white' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface NTokens {
    bg: string; card: string; flat: string; inset: string; pressed: string;
    text: string; secondary: string; tertiary: string; strong: string;
    label: string; link: string; input: string; modal: string; modalHead: string;
    btnPrimary: string; btnSecondary: string; btnDanger: string; divider: string;
    edgeHover: string; edgeHoverFlat: string;
}

interface ProjectFormState {
    projectName: string; description: string; status: string; priority: string;
    startDate: string; endDate: string; budget: string;
    selectedConsultants: string[]; selectedClients: string[];
}

interface PropertyFormState {
    address: string; city: string; state: string; zip: string;
    propertyType: string; bedrooms: string; bathrooms: string;
    sqft: string; lotSize: string; yearBuilt: string; amenities: string[];
    listingPrice: string; listingStatus: string;
}

interface StatusDef {
    value: string; label: string; color: string; icon: React.ComponentType<{ className?: string }>;
}

export interface ProjectDetailModalProps {
    // Theme
    isDark: boolean;
    n: NTokens;

    // Roles
    isAdmin: boolean;
    isConsultant: boolean;
    canEdit: boolean;
    userConsultantId?: string;
    userEmail: string;
    userName?: string;

    // Data
    selectedProject: Project | null;
    consultants: Consultant[];
    clients: Client[];
    timeEntries: TimeEntry[];
    statuses: StatusDef[];

    // Modal visibility
    showDetailsModal: boolean;
    showCreateModal: boolean;
    showEditModal: boolean;
    showConsultantsModal: boolean;
    showClientsModal: boolean;
    showTimeModal: boolean;
    showDeleteConfirm: string | null;
    showGallery: boolean;
    galleryIndex: number;

    // Form state
    projectForm: ProjectFormState;
    propertyForm: PropertyFormState;
    detailTab: DetailTab;
    loading: boolean;
    photoUploading: boolean;
    videoUploading: boolean;

    // Time form
    timeForm: { hours: number; minutes: number; description: string; date: string };

    // Setters
    setDetailTab: (tab: DetailTab) => void;
    setGalleryIndex: (i: number | ((prev: number) => number)) => void;
    setShowDetailsModal: (v: boolean) => void;
    setShowCreateModal: (v: boolean) => void;
    setShowEditModal: (v: boolean) => void;
    setShowConsultantsModal: (v: boolean) => void;
    setShowClientsModal: (v: boolean) => void;
    setShowTimeModal: (v: boolean) => void;
    setShowDeleteConfirm: (v: string | null) => void;
    setShowGallery: (v: boolean) => void;
    setSelectedProject: (p: Project | null) => void;
    setProjectForm: (f: ProjectFormState) => void;
    setPropertyForm: (f: ((prev: PropertyFormState) => PropertyFormState) | PropertyFormState) => void;
    setTimeForm: (f: { hours: number; minutes: number; description: string; date: string }) => void;

    // Handlers
    createProject: () => void;
    updateProject: () => void;
    deleteProject: (pid: string) => void;
    updateProjectStatus: (projectId: string, newStatus: string) => void;
    handlePhotoUpload: (files: FileList | null) => void;
    removePhoto: (index: number) => void;
    setCoverPhoto: (index: number) => void;
    handleVideoUpload: (files: FileList | null) => void;
    removeVideo: (index: number) => void;
    savePropertyDetails: () => void;
    saveListingDetails: () => void;
    togglePublish: () => void;
    toggleAmenity: (amenity: string) => void;
    addTimeEntry: () => void;
    deleteTimeEntry: (id: string) => void;
    assignConsultantToProject: (cid: string) => void;
    removeConsultantFromProject: (cid: string) => void;
    assignClientToProject: (cid: string) => void;
    removeClientFromProject: (cid: string) => void;
    getProjectConsultants: (pid: string) => Consultant[];
    getProjectClients: (pid: string) => Client[];
    getAvailableConsultants: (pid: string) => Consultant[];
    getAvailableClients: (pid: string) => Client[];
    getProjectTimeEntries: (pid: string) => TimeEntry[];
    getProjectTotalTime: (pid: string) => { hours: number; minutes: number };
    resetProjectForm: () => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

    // Formatters
    formatDate: (d: string) => string;
    formatBudget: (b: string) => string | null;
    formatTime: (h: number, m: number) => string;
    getPriorityColor: (p: string) => string;
    fmtStatus: (s: string) => string;
    getPublicUrl: (slug: string) => string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 34;
const MAX_VIDEOS = 3;

// ─── Component ────────────────────────────────────────────────────────────────

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = (props) => {
    const {
        isDark, n, isAdmin, isConsultant, canEdit,
        userConsultantId, userEmail, userName,
        selectedProject, consultants, clients, timeEntries, statuses,
        showDetailsModal, showCreateModal, showEditModal,
        showConsultantsModal, showClientsModal, showTimeModal,
        showDeleteConfirm, showGallery, galleryIndex,
        projectForm, propertyForm, detailTab,
        loading, photoUploading, videoUploading, timeForm,
        setDetailTab, setGalleryIndex,
        setShowDetailsModal, setShowCreateModal, setShowEditModal,
        setShowConsultantsModal, setShowClientsModal, setShowTimeModal,
        setShowDeleteConfirm, setShowGallery, setSelectedProject,
        setProjectForm, setPropertyForm, setTimeForm,
        createProject, updateProject, deleteProject, updateProjectStatus,
        handlePhotoUpload, removePhoto, setCoverPhoto,
        handleVideoUpload, removeVideo,
        savePropertyDetails, saveListingDetails, togglePublish, toggleAmenity,
        addTimeEntry, deleteTimeEntry,
        assignConsultantToProject, removeConsultantFromProject,
        assignClientToProject, removeClientFromProject,
        getProjectConsultants, getProjectClients,
        getAvailableConsultants, getAvailableClients,
        getProjectTimeEntries, getProjectTotalTime,
        resetProjectForm, showToast,
        formatDate, formatBudget, formatTime,
        getPriorityColor, fmtStatus, getPublicUrl,
    } = props;

    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const resetTimeForm = () =>
        setTimeForm({ hours: 0, minutes: 0, description: '', date: new Date().toISOString().split('T')[0] });

    // ── Delete confirm ────────────────────────────────────────────────────────
    if (showDeleteConfirm) return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
            <div className={`${n.modal} border rounded-2xl max-w-md w-full p-6`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <h3 className={`text-lg font-semibold ${n.text}`}>Delete Project?</h3>
                </div>
                <p className={`${n.secondary} text-sm mb-6`}>This permanently removes the project, assignments, time entries, and published listing.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                    <button onClick={() => deleteProject(showDeleteConfirm)} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete</button>
                </div>
            </div>
        </div>
    );

    // ── Gallery overlay ───────────────────────────────────────────────────────
    if (showGallery && selectedProject?.photos) return (
        <div className="fixed inset-0 bg-black/95 z-[10001] flex items-center justify-center">
            <button onClick={() => setShowGallery(false)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
                <X className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => setGalleryIndex(i => Math.max(0, i - 1))} disabled={galleryIndex === 0} className="absolute left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 disabled:opacity-30">
                <svg className="w-6 h-6 text-white rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => setGalleryIndex(i => Math.min(selectedProject.photos!.length - 1, i + 1))} disabled={galleryIndex === selectedProject.photos.length - 1} className="absolute right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 disabled:opacity-30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <img src={selectedProject.photos[galleryIndex]} alt="" className="max-w-[85vw] max-h-[80vh] object-contain rounded-xl" />
            <div className="absolute bottom-4 flex gap-2">
                {selectedProject.photos.map((_, i) => (
                    <button key={i} onClick={() => setGalleryIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white' : 'bg-white/30'}`} />
                ))}
            </div>
        </div>
    );

    return (
        <>
            {/* Hidden file inputs */}
            <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { handlePhotoUpload(e.target.files); e.target.value = ''; }}            />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={e => { handleVideoUpload(e.target.files); e.target.value = ''; }}            />

            {/* ══ TIME MODAL ═══════════════════════════════════════════════════ */}
            {showTimeModal && selectedProject && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead} rounded-t-2xl`}>
                            <div className="flex items-center gap-3">
                                <Timer className="w-5 h-5 text-emerald-400" />
                                <div>
                                    <h2 className={`text-lg font-semibold ${n.text}`}>Log Time</h2>
                                    <p className={`text-xs ${n.tertiary}`}>{selectedProject.projectName}</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowTimeModal(false); resetTimeForm(); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className={`${n.flat} p-4 space-y-4 rounded-2xl`}>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={`${n.label} text-[11px] block mb-1`}>Hours</label>
                                        <input type="number" min="0" max="24" value={timeForm.hours} onChange={e => setTimeForm({ ...timeForm, hours: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                                    </div>
                                    <div>
                                        <label className={`${n.label} text-[11px] block mb-1`}>Minutes</label>
                                        <input type="number" min="0" max="59" value={timeForm.minutes} onChange={e => setTimeForm({ ...timeForm, minutes: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                                    </div>
                                    <div>
                                        <label className={`${n.label} text-[11px] block mb-1`}>Date</label>
                                        <input type="date" value={timeForm.date} onChange={e => setTimeForm({ ...timeForm, date: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`${n.label} text-[11px] block mb-1`}>Description</label>
                                    <textarea rows={2} value={timeForm.description} onChange={e => setTimeForm({ ...timeForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="What did you work on?" />
                                </div>
                                <button onClick={addTimeEntry} className={`w-full px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}>
                                    <Save className="w-4 h-4" />Log Time
                                </button>
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
                                        {getProjectTimeEntries(selectedProject.projectId)
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map(entry => (
                                                <div key={entry.id} className={`${n.flat} p-3 flex items-center justify-between rounded-xl`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>
                                                            {entry.consultantName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className={`${n.text} text-sm font-medium`}>{formatTime(entry.hours, entry.minutes)}</p>
                                                            <p className={`${n.tertiary} text-[11px]`}>{entry.consultantName} · {new Date(entry.date).toLocaleDateString()}</p>
                                                            {entry.description && <p className={`${n.secondary} text-xs mt-0.5`}>{entry.description}</p>}
                                                        </div>
                                                    </div>
                                                    {(isAdmin || entry.consultantId === (userConsultantId || userEmail)) && (
                                                        <button onClick={() => deleteTimeEntry(entry.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg">
                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CREATE MODAL ═════════════════════════════════════════════════ */}
            {showCreateModal && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead} rounded-t-2xl`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>New Project</h2>
                            <button onClick={() => { setShowCreateModal(false); resetProjectForm(); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={`${n.label} text-[11px] block mb-1`}>Project Name *</label>
                                <input type="text" value={projectForm.projectName} onChange={e => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="Enter project name" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`${n.label} text-[11px] block mb-1`}>Status</label>
                                    <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>
                                        {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`${n.label} text-[11px] block mb-1`}>Priority</label>
                                    <select value={projectForm.priority} onChange={e => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`${n.label} text-[11px] block mb-1`}>Start Date</label>
                                    <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} />
                                </div>
                                <div>
                                    <label className={`${n.label} text-[11px] block mb-1`}>End Date</label>
                                    <input type="date" value={projectForm.endDate} onChange={e => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} />
                                </div>
                                <div className="col-span-2">
                                    <label className={`${n.label} text-[11px] block mb-1`}>Budget</label>
                                    <input type="number" value={projectForm.budget} onChange={e => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} placeholder="Enter budget" />
                                </div>
                            </div>

                            {/* Assign Clients */}
                            <div>
                                <label className={`${n.label} text-[11px] mb-2 flex items-center gap-1.5`}>
                                    <Users className="w-3.5 h-3.5" />Assign Clients
                                    {projectForm.selectedClients.length > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.btnPrimary}`}>{projectForm.selectedClients.length}</span>}
                                </label>
                                <div className={`${n.inset} p-2 max-h-36 overflow-y-auto space-y-1 rounded-xl`}>
                                    {clients.length === 0 ? <p className={`${n.tertiary} text-xs p-2`}>No clients available</p> : clients.map(c => (
                                        <label key={c.customerId} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} ${projectForm.selectedClients.includes(c.customerId) ? 'bg-blue-500/10' : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedClients.includes(c.customerId)} onChange={e => setProjectForm({ ...projectForm, selectedClients: e.target.checked ? [...projectForm.selectedClients, c.customerId] : projectForm.selectedClients.filter(id => id !== c.customerId) })} className="w-4 h-4 accent-blue-600" />
                                            <div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Assign Consultants */}
                            <div>
                                <label className={`${n.label} text-[11px] mb-2 flex items-center gap-1.5`}>
                                    <Users className="w-3.5 h-3.5" />Assign Consultants
                                    {projectForm.selectedConsultants.length > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.btnPrimary}`}>{projectForm.selectedConsultants.length}</span>}
                                </label>
                                <div className={`${n.inset} p-2 max-h-36 overflow-y-auto space-y-1 rounded-xl`}>
                                    {consultants.length === 0 ? <p className={`${n.tertiary} text-xs p-2`}>No consultants available</p> : consultants.map(c => (
                                        <label key={c.consultantId} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} ${projectForm.selectedConsultants.includes(c.consultantId) ? 'bg-blue-500/10' : ''}`}>
                                            <input type="checkbox" checked={projectForm.selectedConsultants.includes(c.consultantId)} onChange={e => setProjectForm({ ...projectForm, selectedConsultants: e.target.checked ? [...projectForm.selectedConsultants, c.consultantId] : projectForm.selectedConsultants.filter(id => id !== c.consultantId) })} className="w-4 h-4 accent-blue-600" />
                                            <div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                            <div><span className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</span><span className={`${n.tertiary} text-[10px] block`}>{c.consultantCode}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={`${n.label} text-[11px] block mb-1`}>Description</label>
                                <textarea rows={3} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} placeholder="Project description…" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowCreateModal(false); resetProjectForm(); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={createProject} disabled={loading} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2`}>
                                    {loading ? 'Creating…' : <><Plus className="w-4 h-4" />Create</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ TABBED DETAIL MODAL ══════════════════════════════════════════ */}
            {showDetailsModal && selectedProject && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>

                        {/* Header */}
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between flex-shrink-0 ${n.modalHead} rounded-t-2xl`}>
                            <div className="flex items-center gap-3">
                                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                                    {selectedProject.photos && selectedProject.photos.length > 0
                                        ? <img src={selectedProject.photos[selectedProject.coverPhotoIndex || 0]} alt="" className="w-full h-full object-cover" />
                                        : <div className={`w-full h-full ${n.inset} flex items-center justify-center`}><FolderOpen className={`w-4 h-4 ${n.secondary}`} /></div>
                                    }
                                </div>
                                <div>
                                    <h2 className={`text-lg font-semibold ${n.text}`}>{selectedProject.projectName}</h2>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-xs ${n.tertiary} font-mono`}>{selectedProject.projectCode}</p>
                                        {selectedProject.isPublished && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />Published</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {isAdmin && <button onClick={() => setShowDeleteConfirm(selectedProject.projectId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>}
                                <button onClick={() => { setShowDetailsModal(false); setSelectedProject(null); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div className={`border-b ${n.divider} flex-shrink-0 flex overflow-x-auto ${n.modalHead}`}>
                            {([
                                { id: 'overview', label: 'Overview', icon: Info },
                                { id: 'property', label: 'Property', icon: Home },
                                { id: 'listing',  label: 'Listing',  icon: Globe },
                                { id: 'team',     label: 'Team',     icon: Users },
                                { id: 'progress', label: 'Progress', icon: Clock },
                            ] as { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(tab => (
                                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${detailTab === tab.id ? `border-blue-500 ${n.label}` : `border-transparent ${n.tertiary}`}`}>
                                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                                    {tab.id === 'listing' && selectedProject.isPublished && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="flex-1 overflow-y-auto">

                            {/* ── Overview ── */}
                            {detailTab === 'overview' && (
                                <div className="p-5 space-y-5">
                                    <div>
                                        <label className={`${n.label} text-[11px] block mb-2`}>Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {statuses.map(st => (
                                                <button key={st.value} onClick={() => canEdit && updateProjectStatus(selectedProject.projectId, st.value)} disabled={!canEdit}
                                                    className={`px-3 py-2 rounded-xl flex items-center gap-2 text-sm transition-all ${selectedProject.status === st.value ? `${st.color} text-white` : `${n.flat} ${n.secondary}`} ${!canEdit ? 'opacity-50 cursor-default' : ''}`}>
                                                    <st.icon className="w-3.5 h-3.5" />{st.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <p className={`${getPriorityColor(selectedProject.priority || 'medium')} text-sm font-medium`}>{fmtStatus(selectedProject.priority || 'medium')} Priority</p>
                                    <div className="flex flex-wrap gap-2">
                                        {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowEditModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all rounded-xl`}><Edit2 className="w-3.5 h-3.5" />Edit</button>}
                                        {canEdit && <button onClick={() => { setShowDetailsModal(false); setShowTimeModal(true); }} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 text-emerald-400 transition-all rounded-xl`}><Timer className="w-3.5 h-3.5" />Log Time</button>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className={`${n.flat} p-4 rounded-2xl`}>
                                            <span className={`${n.label} text-[11px]`}>Time Tracked</span>
                                            <p className={`text-xl font-semibold ${n.strong} mt-1`}>{formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</p>
                                            <p className={`${n.tertiary} text-[11px]`}>{getProjectTimeEntries(selectedProject.projectId).length} entries</p>
                                        </div>
                                        <div className={`${n.flat} p-4 rounded-2xl`}>
                                            <span className={`${n.label} text-[11px]`}>Budget</span>
                                            <p className={`text-xl font-semibold ${n.strong} mt-1`}>{formatBudget(selectedProject.budget) || '—'}</p>
                                        </div>
                                    </div>
                                    <div className={`${n.flat} p-4 rounded-2xl`}>
                                        <span className={`${n.label} text-[11px]`}>Timeline</span>
                                        <div className="flex gap-6 mt-2">
                                            <div><p className={`${n.tertiary} text-[10px]`}>Start</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.startDate)}</p></div>
                                            <div><p className={`${n.tertiary} text-[10px]`}>End</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.endDate)}</p></div>
                                        </div>
                                    </div>
                                    {selectedProject.description && (
                                        <div className={`${n.flat} p-4 rounded-2xl`}>
                                            <span className={`${n.label} text-[11px]`}>Description</span>
                                            <p className={`${n.text} text-sm mt-1 leading-relaxed`}>{selectedProject.description}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Property ── */}
                            {detailTab === 'property' && (
                                <div className="p-5 space-y-6">
                                    {/* Photos */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Photos ({(selectedProject.photos || []).length}/{MAX_PHOTOS})</span>
                                            {canEdit && (selectedProject.photos || []).length < MAX_PHOTOS && (
                                                <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50`}>
                                                    {photoUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                                    {photoUploading ? 'Uploading…' : 'Add Photos'}
                                                </button>
                                            )}
                                        </div>
                                        {(!selectedProject.photos || selectedProject.photos.length === 0) ? (
                                            <button onClick={() => canEdit && photoInputRef.current?.click()} className={`w-full h-36 ${n.flat} rounded-2xl border-2 border-dashed ${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'} flex flex-col items-center justify-center gap-2 transition-colors ${!canEdit ? 'cursor-default' : ''}`}>
                                                <Camera className={`w-8 h-8 ${n.tertiary}`} strokeWidth={1.5} />
                                                <p className={`${n.secondary} text-sm`}>Click to upload photos</p>
                                                <p className={`${n.tertiary} text-[11px]`}>JPG, PNG — max {MAX_PHOTOS} photos, auto-compressed</p>
                                            </button>
                                        ) : (
                                            <div className="grid grid-cols-4 gap-2">
                                                {selectedProject.photos.map((photo, i) => (
                                                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                                                        <img src={photo} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => { setGalleryIndex(i); setShowGallery(true); }} />
                                                        {canEdit && (
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                                                                <button onClick={() => setCoverPhoto(i)} className={`p-1.5 rounded-lg ${(selectedProject.coverPhotoIndex || 0) === i ? 'bg-yellow-500' : 'bg-white/20 hover:bg-white/30'}`} title="Set as cover"><Star className="w-3 h-3 text-white" /></button>
                                                                <button onClick={() => removePhoto(i)} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg" title="Remove"><Trash2 className="w-3 h-3 text-white" /></button>
                                                            </div>
                                                        )}
                                                        {(selectedProject.coverPhotoIndex || 0) === i && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-yellow-500 rounded text-[9px] text-white font-semibold">Cover</div>}
                                                    </div>
                                                ))}
                                                {canEdit && selectedProject.photos.length < MAX_PHOTOS && (
                                                    <button onClick={() => photoInputRef.current?.click()} className={`aspect-square rounded-xl ${n.flat} border-2 border-dashed ${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'} flex items-center justify-center`}>
                                                        <Plus className={`w-5 h-5 ${n.tertiary}`} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Videos */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Videos ({(selectedProject.videos || []).length}/{MAX_VIDEOS})</span>
                                            {canEdit && (selectedProject.videos || []).length < MAX_VIDEOS && (
                                                <button onClick={() => videoInputRef.current?.click()} disabled={videoUploading} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50`}>
                                                    {videoUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                                                    {videoUploading ? 'Uploading…' : 'Add Video'}
                                                </button>
                                            )}
                                        </div>
                                        {(!selectedProject.videos || selectedProject.videos.length === 0) ? (
                                            <button onClick={() => canEdit && videoInputRef.current?.click()} className={`w-full h-28 ${n.flat} rounded-2xl border-2 border-dashed ${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'} flex flex-col items-center justify-center gap-2 transition-colors ${!canEdit ? 'cursor-default' : ''}`}>
                                                <Video className={`w-7 h-7 ${n.tertiary}`} strokeWidth={1.5} />
                                                <p className={`${n.secondary} text-sm`}>Click to upload videos</p>
                                                <p className={`${n.tertiary} text-[11px]`}>MP4, MOV, WebM — max {MAX_VIDEOS} videos</p>
                                            </button>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2">
                                                {selectedProject.videos.map((videoSrc, i) => (
                                                    <div key={i} className="relative group aspect-video rounded-xl overflow-hidden bg-black">
                                                        <video src={videoSrc} className="w-full h-full object-cover" preload="metadata" />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <PlayCircle className="w-8 h-8 text-white/70" />
                                                        </div>
                                                        {canEdit && (
                                                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => removeVideo(i)} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg" title="Remove">
                                                                    <Trash2 className="w-3 h-3 text-white" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/80 font-medium">
                                                            Video {i + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                                {canEdit && selectedProject.videos.length < MAX_VIDEOS && (
                                                    <button onClick={() => videoInputRef.current?.click()} className={`aspect-video rounded-xl ${n.flat} border-2 border-dashed ${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'} flex items-center justify-center`}>
                                                        <Plus className={`w-5 h-5 ${n.tertiary}`} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Location */}
                                    <div>
                                        <span className={`${n.label} text-[11px] uppercase tracking-wider block mb-3`}>Location</span>
                                        <div className="space-y-3">
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Street Address</label><input type="text" value={propertyForm.address} onChange={e => setPropertyForm(f => ({ ...f, address: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="123 Main Street" /></div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div><label className={`${n.tertiary} text-[11px] block mb-1`}>City</label><input type="text" value={propertyForm.city} onChange={e => setPropertyForm(f => ({ ...f, city: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="City" /></div>
                                                <div><label className={`${n.tertiary} text-[11px] block mb-1`}>State</label><input type="text" value={propertyForm.state} onChange={e => setPropertyForm(f => ({ ...f, state: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="NJ" /></div>
                                                <div><label className={`${n.tertiary} text-[11px] block mb-1`}>ZIP</label><input type="text" value={propertyForm.zip} onChange={e => setPropertyForm(f => ({ ...f, zip: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="07001" /></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Property details */}
                                    <div>
                                        <span className={`${n.label} text-[11px] uppercase tracking-wider block mb-3`}>Property Details</span>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className={`${n.tertiary} text-[11px] block mb-1`}>Property Type</label>
                                                <select value={propertyForm.propertyType} onChange={e => setPropertyForm(f => ({ ...f, propertyType: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>
                                                    {PROPERTY_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                                                </select>
                                            </div>
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Bedrooms</label><input type="number" min="0" value={propertyForm.bedrooms} onChange={e => setPropertyForm(f => ({ ...f, bedrooms: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="3" /></div>
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Bathrooms</label><input type="number" min="0" step="0.5" value={propertyForm.bathrooms} onChange={e => setPropertyForm(f => ({ ...f, bathrooms: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="2" /></div>
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Sq. Footage</label><input type="number" min="0" value={propertyForm.sqft} onChange={e => setPropertyForm(f => ({ ...f, sqft: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="1800" /></div>
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Lot Size</label><input type="text" value={propertyForm.lotSize} onChange={e => setPropertyForm(f => ({ ...f, lotSize: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="0.25 acres" /></div>
                                            <div><label className={`${n.tertiary} text-[11px] block mb-1`}>Year Built</label><input type="number" value={propertyForm.yearBuilt} onChange={e => setPropertyForm(f => ({ ...f, yearBuilt: e.target.value }))} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="2005" /></div>
                                        </div>
                                    </div>

                                    {/* Amenities */}
                                    <div>
                                        <span className={`${n.label} text-[11px] uppercase tracking-wider block mb-3`}>Amenities</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {AMENITIES.map(a => {
                                                const checked = propertyForm.amenities.includes(a);
                                                return (
                                                    <button key={a} onClick={() => toggleAmenity(a)} className={`px-3 py-2 rounded-xl text-xs text-left flex items-center gap-2 transition-all ${checked ? 'bg-blue-600 text-white' : `${n.flat} ${n.secondary}`}`}>
                                                        <div className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center ${checked ? 'bg-white/20 border-white/30' : (isDark ? 'border-gray-600' : 'border-gray-300')}`}>
                                                            {checked && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                                        </div>{a}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <button onClick={savePropertyDetails} className={`w-full px-4 py-3 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}>
                                            <Save className="w-4 h-4" />Save Property Details
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ── Listing ── */}
                            {detailTab === 'listing' && (
                                <div className="p-5 space-y-5">
                                    {/* Publish toggle */}
                                    <div className={`${n.flat} p-5 rounded-2xl`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 mr-4">
                                                <p className={`${n.strong} font-semibold text-sm`}>Listing Visibility</p>
                                                <p className={`${n.secondary} text-xs mt-0.5`}>
                                                    {selectedProject.isPublished
                                                        ? `Active — accessible to assigned clients since ${new Date(selectedProject.publishedAt!).toLocaleDateString()}`
                                                        : 'Inactive — clients cannot view this listing yet'}
                                                </p>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={togglePublish}
                                                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${selectedProject.isPublished ? 'bg-emerald-500' : (isDark ? 'bg-gray-700' : 'bg-gray-300')}`}
                                                    role="switch"
                                                    aria-checked={selectedProject.isPublished}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${selectedProject.isPublished ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            )}
                                        </div>
                                        {selectedProject.isPublished && selectedProject.listingSlug && (
                                            <div className={`mt-4 p-3 ${n.inset} rounded-xl`}>
                                                <p className={`${n.tertiary} text-[11px] mb-2`}>Client listing link (requires Timely login)</p>
                                                <div className="flex items-center gap-2">
                                                    <Globe className={`w-4 h-4 ${n.label} flex-shrink-0`} />
                                                    <span className={`${n.secondary} text-xs truncate flex-1 font-mono`}>{getPublicUrl(selectedProject.listingSlug)}</span>
                                                    <button onClick={() => { navigator.clipboard.writeText(getPublicUrl(selectedProject.listingSlug!)); showToast('URL copied!', 'success'); }} className={`p-1.5 ${n.flat} rounded-lg`} title="Copy link">
                                                        <Copy className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                                    </button>
                                                    <a href={`/listing/${selectedProject.listingSlug}`} target="_blank" rel="noreferrer" className={`p-1.5 ${n.flat} rounded-lg`} title="Preview listing">
                                                        <ExternalLink className={`w-3.5 h-3.5 ${n.label}`} />
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Listing price + status */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className={`${n.label} text-[11px] block mb-1`}>Listing Price</label>
                                            <div className="relative">
                                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${n.tertiary} text-sm`}>$</span>
                                                <input type="number" value={propertyForm.listingPrice} onChange={e => setPropertyForm(f => ({ ...f, listingPrice: e.target.value }))} className={`w-full pl-7 pr-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} placeholder="850000" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`${n.label} text-[11px] block mb-2`}>Listing Status</label>
                                            <div className="flex gap-2">
                                                {LISTING_STATUSES.map(ls => (
                                                    <button key={ls.value} onClick={() => setPropertyForm(f => ({ ...f, listingStatus: ls.value }))} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${propertyForm.listingStatus === ls.value ? ls.color : `${n.flat} ${n.secondary}`}`}>
                                                        {ls.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <button onClick={saveListingDetails} className={`w-full px-4 py-3 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}>
                                            <Save className="w-4 h-4" />Save Listing Details
                                        </button>
                                    )}

                                    {/* Info note */}
                                    <div className={`${n.inset} rounded-xl p-4 flex items-start gap-3`}>
                                        <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                                        <div>
                                            <p className={`${n.text} text-xs font-medium mb-0.5`}>Private listing</p>
                                            <p className={`${n.secondary} text-xs leading-relaxed`}>This listing is only accessible to clients and consultants assigned to this project. They must be logged in to view it. Use the Team tab to manage access.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Team ── */}
                            {detailTab === 'team' && (
                                <div className="p-5 space-y-4">
                                    {/* Consultants */}
                                    <div className={`${n.flat} p-4 rounded-2xl`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Consultants</span>
                                            {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowConsultantsModal(true); }} className={`text-xs ${n.link}`}>Manage</button>}
                                        </div>
                                        {getProjectConsultants(selectedProject.projectId).length === 0
                                            ? <p className={`${n.tertiary} text-xs text-center py-3`}>None assigned</p>
                                            : <div className="space-y-2">{getProjectConsultants(selectedProject.projectId).map(c => (
                                                <div key={c.consultantId} className={`${n.inset} p-3 flex items-center justify-between rounded-xl`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 ${n.flat} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                        <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                                    </div>
                                                    {isAdmin && <button onClick={() => removeConsultantFromProject(c.consultantId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>}
                                                </div>
                                            ))}</div>
                                        }
                                    </div>

                                    {/* Clients */}
                                    <div className={`${n.flat} p-4 rounded-2xl`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Clients</span>
                                            {isAdmin && <button onClick={() => { setShowDetailsModal(false); setShowClientsModal(true); }} className={`text-xs ${n.link}`}>Manage</button>}
                                        </div>
                                        {getProjectClients(selectedProject.projectId).length === 0
                                            ? <p className={`${n.tertiary} text-xs text-center py-3`}>None assigned</p>
                                            : <div className="space-y-2">{getProjectClients(selectedProject.projectId).map(c => (
                                                <div key={c.customerId} className={`${n.inset} p-3 flex items-center justify-between rounded-xl`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 ${n.flat} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div>
                                                        <div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div>
                                                    </div>
                                                    {isAdmin && <button onClick={() => removeClientFromProject(c.customerId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>}
                                                </div>
                                            ))}</div>
                                        }
                                    </div>
                                </div>
                            )}

                            {/* ── Progress ── */}
                            {detailTab === 'progress' && (
                                <div className="p-5 space-y-4">
                                    <div className={`${n.flat} p-4 rounded-2xl flex items-center justify-between`}>
                                        <div>
                                            <span className={`${n.label} text-[11px]`}>Total Time Logged</span>
                                            <p className={`text-2xl font-semibold ${n.strong} mt-1`}>{formatTime(getProjectTotalTime(selectedProject.projectId).hours, getProjectTotalTime(selectedProject.projectId).minutes)}</p>
                                            <p className={`${n.tertiary} text-[11px]`}>{getProjectTimeEntries(selectedProject.projectId).length} entries</p>
                                        </div>
                                        {canEdit && (
                                            <button onClick={() => { setShowDetailsModal(false); setShowTimeModal(true); }} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}>
                                                <Timer className="w-4 h-4" />Log Time
                                            </button>
                                        )}
                                    </div>
                                    {getProjectTimeEntries(selectedProject.projectId).length === 0 ? (
                                        <div className={`${n.flat} rounded-2xl p-8 text-center`}>
                                            <Clock className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                            <p className={`${n.secondary} text-sm`}>No time logged yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {getProjectTimeEntries(selectedProject.projectId)
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map(entry => (
                                                    <div key={entry.id} className={`${n.flat} p-4 flex items-center justify-between rounded-xl`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{entry.consultantName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}</div>
                                                            <div>
                                                                <p className={`${n.text} text-sm font-semibold`}>{formatTime(entry.hours, entry.minutes)}</p>
                                                                <p className={`${n.tertiary} text-[11px]`}>{entry.consultantName} · {new Date(entry.date).toLocaleDateString()}</p>
                                                                {entry.description && <p className={`${n.secondary} text-xs mt-0.5`}>{entry.description}</p>}
                                                            </div>
                                                        </div>
                                                        {(isAdmin || entry.consultantId === (userConsultantId || userEmail)) && (
                                                            <button onClick={() => deleteTimeEntry(entry.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg">
                                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ EDIT MODAL ═══════════════════════════════════════════════════ */}
            {showEditModal && selectedProject && canEdit && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead} rounded-t-2xl`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Edit Project</h2>
                            <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Project Name</label><input type="text" value={projectForm.projectName} onChange={e => setProjectForm({ ...projectForm, projectName: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>{statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}</select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Priority</label><select value={projectForm.priority} onChange={e => setProjectForm({ ...projectForm, priority: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Start Date</label><input type="date" value={projectForm.startDate} onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>End Date</label><input type="date" value={projectForm.endDate} onChange={e => setProjectForm({ ...projectForm, endDate: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                                <div className="col-span-2"><label className={`${n.label} text-[11px] block mb-1`}>Budget</label><input type="number" value={projectForm.budget} onChange={e => setProjectForm({ ...projectForm, budget: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea rows={3} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowEditModal(false); setShowDetailsModal(true); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={updateProject} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CONSULTANTS MODAL ════════════════════════════════════════════ */}
            {showConsultantsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead} rounded-t-2xl`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Consultants</h2>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getProjectConsultants(selectedProject.projectId).length === 0
                                    ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p>
                                    : <div className="space-y-1.5 mt-3">{getProjectConsultants(selectedProject.projectId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between rounded-xl`}>
                                            <div className="flex items-center gap-3"><div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div></div>
                                            <button onClick={() => removeConsultantFromProject(c.consultantId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                }
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableConsultants(selectedProject.projectId).length === 0
                                    ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p>
                                    : <div className="space-y-1.5 mt-3">{getAvailableConsultants(selectedProject.projectId).map(c => (
                                        <div key={c.consultantId} className={`${n.flat} p-3 flex items-center justify-between rounded-xl`}>
                                            <div className="flex items-center gap-3"><div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.consultantCode}</p></div></div>
                                            <button onClick={() => assignConsultantToProject(c.consultantId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                }
                            </div>
                            <button onClick={() => { setShowConsultantsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CLIENTS MODAL ════════════════════════════════════════════════ */}
            {showClientsModal && selectedProject && isAdmin && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead} rounded-t-2xl`}>
                            <h2 className={`text-lg font-semibold ${n.text}`}>Manage Clients</h2>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Assigned</span>
                                {getProjectClients(selectedProject.projectId).length === 0
                                    ? <p className={`${n.tertiary} text-sm text-center py-4`}>None assigned</p>
                                    : <div className="space-y-1.5 mt-3">{getProjectClients(selectedProject.projectId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between rounded-xl`}>
                                            <div className="flex items-center gap-3"><div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.email}</p></div></div>
                                            <button onClick={() => removeClientFromProject(c.customerId)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><UserMinus className="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    ))}</div>
                                }
                            </div>
                            <div>
                                <span className={`${n.label} text-[11px] uppercase tracking-wider`}>Available</span>
                                {getAvailableClients(selectedProject.projectId).length === 0
                                    ? <p className={`${n.tertiary} text-sm text-center py-4`}>All assigned</p>
                                    : <div className="space-y-1.5 mt-3">{getAvailableClients(selectedProject.projectId).map(c => (
                                        <div key={c.customerId} className={`${n.flat} p-3 flex items-center justify-between rounded-xl`}>
                                            <div className="flex items-center gap-3"><div className={`w-7 h-7 ${n.inset} rounded-full flex items-center justify-center text-[10px] ${n.tertiary}`}>{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${n.text} text-sm`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.clientCode}</p></div></div>
                                            <button onClick={() => assignClientToProject(c.customerId)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1.5`}><Link2 className="w-3.5 h-3.5" />Assign</button>
                                        </div>
                                    ))}</div>
                                }
                            </div>
                            <button onClick={() => { setShowClientsModal(false); setShowDetailsModal(true); }} className={`w-full px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Back</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProjectDetailModal;