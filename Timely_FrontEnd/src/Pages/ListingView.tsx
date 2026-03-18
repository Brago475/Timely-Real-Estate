// src/Pages/ListingView.tsx
//
// Private listing page — requires Timely login.
// Access is checked against project assignments before rendering.
// Route: /listing/:slug

import React, { useState, useEffect, useMemo } from 'react';
import {
    MapPin, Bed, Bath, Maximize, ChevronLeft, ChevronRight,
    Home, Building2, Globe, Layers, ArrowLeft, Calendar,
    DollarSign, Tag, Lock, LogIn, X, Sun, Moon,
    Ruler, Trees, Shield, MessageCircle, Share2, Heart
} from 'lucide-react';
import AssignmentService from '../services/AssignmentService';
import timelyLogo from '../assets/Timely_logo.png';

// ─── Router shim ──────────────────────────────────────────────────────────────
const getSlugFromUrl = (): string => {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
};

let _useParams: () => { slug?: string };
try { _useParams = require('react-router-dom').useParams; }
catch { _useParams = () => ({ slug: getSlugFromUrl() }); }

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Project {
    projectId: string; projectName: string; description?: string;
    status?: string; clientName?: string;
    address?: string; city?: string; state?: string; zip?: string;
    propertyType?: string; bedrooms?: string; bathrooms?: string;
    sqft?: string; lotSize?: string; yearBuilt?: string;
    amenities?: string[]; photos?: string[]; coverPhotoIndex?: number;
    listingPrice?: string; listingStatus?: string;
    isPublished?: boolean; publishedAt?: string; listingSlug?: string;
    startDate?: string; endDate?: string; budget?: string;
    createdAt?: string;
}

interface CurrentUser {
    role: 'admin' | 'consultant' | 'client';
    email: string; customerId?: string; consultantId?: string; name?: string;
}

// ─── Amenity icons ────────────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
    'Pool': '🏊', 'Gym': '🏋️', 'Garage': '🚗', 'Parking': '🅿️',
    'Garden': '🌿', 'Balcony': '🏙️', 'Terrace': '☀️', 'Elevator': '🛗',
    'Security System': '🔒', 'Pet Friendly': '🐾', 'Air Conditioning': '❄️',
    'Heating': '🔥', 'Storage': '📦', 'In-Unit Laundry': '🫧',
    'Furnished': '🛋️', 'Smart Home': '📱', 'Fireplace': '🕯️', 'Solar Panels': '⚡',
};

const STATUS_LABEL: Record<string, string> = { active: 'For Sale', pending: 'Sale Pending', sold: 'Sold' };
const STATUS_BADGE_LIGHT: Record<string, string> = { active: 'bg-emerald-600 text-white', pending: 'bg-amber-500 text-white', sold: 'bg-gray-500 text-white' };
const STATUS_BADGE_DARK: Record<string, string> = { active: 'bg-emerald-500 text-white', pending: 'bg-amber-500 text-white', sold: 'bg-gray-600 text-white' };

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getCurrentUser = (): CurrentUser | null => {
    try {
        const raw = localStorage.getItem('timely_user');
        const auth = localStorage.getItem('timely_authenticated');
        if (!raw || auth !== 'true') return null;
        const p = JSON.parse(raw);
        const role = (p.role || 'client').toLowerCase();
        if (!['admin', 'consultant', 'client'].includes(role)) return null;
        return { role: role as any, email: p.email || '', customerId: p.customerId, consultantId: p.consultantId || p.customerId, name: p.name };
    } catch { return null; }
};

const checkAccess = (project: Project, user: CurrentUser): boolean => {
    if (user.role === 'admin') return true;
    const pid = String(project.projectId);
    if (user.role === 'consultant' && user.consultantId) return AssignmentService.getProjectsForConsultant(user.consultantId).includes(pid);
    if (user.role === 'client' && user.customerId) return AssignmentService.getProjectsForClient(user.customerId).includes(pid);
    return false;
};

// ─── Component ────────────────────────────────────────────────────────────────
const ListingView: React.FC = () => {
    const { slug } = _useParams();

    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('timely_theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const toggleTheme = () => { const next = !isDark; setIsDark(next); localStorage.setItem('timely_theme', next ? 'dark' : 'light'); };

    const [project, setProject] = useState<Project | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [notLoggedIn, setNotLoggedIn] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [activePhoto, setActivePhoto] = useState(0);
    const [liked, setLiked] = useState(false);

    useEffect(() => { (async () => {
        const user = getCurrentUser();
        if (!user) { setNotLoggedIn(true); return; }
        try {
            const token = sessionStorage.getItem('timely_token') || localStorage.getItem('timely_token') || '';
            const res = await fetch('/api/projects', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
            const data = res.ok ? await res.json() : null;
            const all: Project[] = data?.data || [];
            const found = all.find((p: any) => p.isPublished && p.listingSlug === slug);
            if (!found) { setNotFound(true); return; }
            if (!checkAccess(found, user)) { setAccessDenied(true); return; }
            setProject(found);
            setActivePhoto(found.coverPhotoIndex || 0);
        } catch { setNotFound(true); }
    })(); }, [slug]);

    useEffect(() => {
        if (!galleryOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setGalleryIndex(i => Math.min((project?.photos?.length ?? 1) - 1, i + 1));
            if (e.key === 'ArrowLeft') setGalleryIndex(i => Math.max(0, i - 1));
            if (e.key === 'Escape') setGalleryOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [galleryOpen, project?.photos?.length]);

    const photos = useMemo(() => (project?.photos || []) as string[], [project]);
    const price = project?.listingPrice ? `$${Number(project.listingPrice).toLocaleString()}` : null;
    const location = [project?.address, project?.city, project?.state, project?.zip].filter(Boolean).join(', ');
    const statusLabel = STATUS_LABEL[project?.listingStatus || 'active'] ?? 'For Sale';
    const statusBadge = (isDark ? STATUS_BADGE_DARK : STATUS_BADGE_LIGHT)[project?.listingStatus || 'active'] ?? 'bg-emerald-600 text-white';
    const mapQuery = encodeURIComponent(location || project?.projectName || '');

    const n = {
        bg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#f5f5f0]',
        surface: isDark ? 'bg-[#141414]' : 'bg-white',
        border: isDark ? 'border-[#222]' : 'border-[#e5e5e0]',
        text: isDark ? 'text-white' : 'text-gray-900',
        secondary: isDark ? 'text-gray-400' : 'text-gray-500',
        muted: isDark ? 'text-gray-500' : 'text-gray-400',
        label: isDark ? 'text-blue-400' : 'text-blue-600',
        card: isDark ? 'bg-[#141414] border border-[#222] shadow-[0_1px_3px_rgba(0,0,0,0.4)]' : 'bg-white border border-[#e8e8e4] shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
        btnGhost: isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500',
        iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
    };

    // ── Gate screens ──────────────────────────────────────────────────────────
    const GateScreen: React.FC<{ icon: React.ReactNode; title: string; message: string; action?: React.ReactNode }> = ({ icon, title, message, action }) => (
        <div className={`min-h-screen ${n.bg} ${n.text} flex items-center justify-center`}>
            <div className="text-center max-w-sm px-6">
                <div className={`w-16 h-16 ${n.surface} rounded-2xl flex items-center justify-center mx-auto mb-5 border ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>{icon}</div>
                <h2 className="text-xl font-semibold mb-2">{title}</h2>
                <p className={`${n.secondary} text-sm mb-6 leading-relaxed`}>{message}</p>
                {action}
            </div>
        </div>
    );

    if (notLoggedIn) return <GateScreen icon={<Lock className={`w-6 h-6 ${n.label}`} />} title="Sign in required" message="This listing is private. Log in to your Timely account to view it." action={<button onClick={() => window.location.href = '/'} className={`${n.btnPrimary} px-6 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2`}><LogIn className="w-4 h-4" />Go to Login</button>} />;
    if (accessDenied) return <GateScreen icon={<Shield className="w-6 h-6 text-amber-500" />} title="Access restricted" message="You don't have access to this listing. Contact your agent if needed." action={<button onClick={() => window.history.back()} className={`${n.btnGhost} px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 border ${n.border}`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (notFound) return <GateScreen icon={<Globe className="w-6 h-6 opacity-40" />} title="Listing not found" message="This listing may have been removed or the URL is incorrect." action={<button onClick={() => window.history.back()} className={`${n.btnGhost} px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 border ${n.border}`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (!project) return <div className={`min-h-screen ${n.bg} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

    // ── Gallery ───────────────────────────────────────────────────────────────
    if (galleryOpen) return (
        <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
            <button onClick={() => setGalleryOpen(false)} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><X className="w-5 h-5" /></button>
            {galleryIndex > 0 && <button onClick={() => setGalleryIndex(i => i - 1)} className="absolute left-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-6 h-6" /></button>}
            {galleryIndex < photos.length - 1 && <button onClick={() => setGalleryIndex(i => i + 1)} className="absolute right-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronRight className="w-6 h-6" /></button>}
            <img src={photos[galleryIndex]} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg" />
            <span className="absolute bottom-8 text-white/50 text-sm">{galleryIndex + 1} / {photos.length}</span>
            <div className="absolute bottom-4 flex gap-1.5">{photos.map((_, i) => <button key={i} onClick={() => setGalleryIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? 'bg-white' : 'bg-white/30'}`} />)}</div>
        </div>
    );

    // ── Main ──────────────────────────────────────────────────────────────────
    return (
        <div className={`min-h-screen ${n.bg} ${n.text} transition-colors duration-300`}>

            {/* Nav */}
            <nav className={`sticky top-0 z-50 ${n.surface} border-b ${n.border} backdrop-blur-xl transition-colors duration-300`}>
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className={`${n.btnGhost} flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors`}><ArrowLeft className="w-4 h-4" />Back</button>
                    <div className="flex items-center gap-2.5">
                        <img src={timelyLogo} alt="Timely" className="w-5 h-5" />
                        <span className={`text-sm font-semibold ${n.text}`}>Timely</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}><Lock className="w-2.5 h-2.5 inline mr-1" />Private</span>
                    </div>
                    <button onClick={toggleTheme} className={`w-8 h-8 rounded-lg ${n.btnGhost} flex items-center justify-center transition-colors`}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
                </div>
            </nav>

            {/* Hero */}
            <div className="relative h-[420px] md:h-[480px] overflow-hidden bg-gray-900">
                {photos.length > 0
                    ? <img src={photos[activePhoto]} alt={project.projectName} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">{project.propertyType === 'commercial' ? <Building2 className="w-24 h-24 text-white/5" strokeWidth={0.8} /> : <Home className="w-24 h-24 text-white/5" strokeWidth={0.8} />}</div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <div className="max-w-6xl mx-auto flex items-end justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2.5 mb-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge}`}>{statusLabel}</span>
                                {project.propertyType && <span className="px-3 py-1 rounded-full text-xs text-white/80 bg-white/15 backdrop-blur-sm capitalize">{project.propertyType}</span>}
                            </div>
                            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 tracking-tight">{project.projectName}</h1>
                            {location && <p className="text-white/70 text-sm flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location}</p>}
                        </div>
                        <div className="text-right">
                            {price && <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">{price}</div>}
                            {project.sqft && <div className="text-white/50 text-sm mt-1">{Number(project.sqft).toLocaleString()} sqft</div>}
                        </div>
                    </div>
                </div>
                {photos.length > 1 && (
                    <button onClick={() => { setGalleryIndex(activePhoto); setGalleryOpen(true); }} className="absolute bottom-6 right-6 md:bottom-10 md:right-10 px-3.5 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-lg text-white text-xs font-medium flex items-center gap-2 transition-colors border border-white/10">
                        <Layers className="w-3.5 h-3.5" />View all {photos.length}
                    </button>
                )}
            </div>

            {/* Photo strip */}
            {photos.length > 1 && (
                <div className={`${n.surface} border-b ${n.border} transition-colors duration-300`}>
                    <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto">
                        {photos.map((photo, i) => (
                            <button key={i} onClick={() => setActivePhoto(i)} className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all duration-200 ${i === activePhoto ? `ring-2 ring-blue-500 ring-offset-2 ${isDark ? 'ring-offset-[#0a0a0a]' : 'ring-offset-[#f5f5f0]'}` : 'opacity-60 hover:opacity-100'}`}>
                                <img src={photo} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick stats bar */}
            <div className={`${n.surface} border-b ${n.border} transition-colors duration-300`}>
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        {project.bedrooms && <div className="flex items-center gap-1.5"><Bed className={`w-4 h-4 ${n.secondary}`} /><span className={`text-sm font-medium ${n.text}`}>{project.bedrooms} <span className={n.secondary}>bed</span></span></div>}
                        {project.bathrooms && <div className="flex items-center gap-1.5"><Bath className={`w-4 h-4 ${n.secondary}`} /><span className={`text-sm font-medium ${n.text}`}>{project.bathrooms} <span className={n.secondary}>bath</span></span></div>}
                        {project.sqft && <div className="flex items-center gap-1.5"><Maximize className={`w-4 h-4 ${n.secondary}`} /><span className={`text-sm font-medium ${n.text}`}>{Number(project.sqft).toLocaleString()} <span className={n.secondary}>sqft</span></span></div>}
                        {project.yearBuilt && <div className="flex items-center gap-1.5"><Calendar className={`w-4 h-4 ${n.secondary}`} /><span className={`text-sm font-medium ${n.text}`}>Built {project.yearBuilt}</span></div>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setLiked(!liked)} className={`w-9 h-9 rounded-lg ${n.btnGhost} flex items-center justify-center transition-colors`}><Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} /></button>
                        <button onClick={() => navigator.clipboard.writeText(window.location.href)} className={`w-9 h-9 rounded-lg ${n.btnGhost} flex items-center justify-center transition-colors`}><Share2 className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-start">

                    {/* Left */}
                    <div className="space-y-8">

                        {/* Stat cards */}
                        {(project.bedrooms || project.bathrooms || project.sqft || project.yearBuilt || project.lotSize) && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {project.bedrooms && <div className={`${n.card} rounded-xl p-4 text-center transition-colors duration-300`}><Bed className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.text}`}>{project.bedrooms}</div><div className={`text-[11px] ${n.muted} mt-0.5`}>Bedrooms</div></div>}
                                {project.bathrooms && <div className={`${n.card} rounded-xl p-4 text-center transition-colors duration-300`}><Bath className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.text}`}>{project.bathrooms}</div><div className={`text-[11px] ${n.muted} mt-0.5`}>Bathrooms</div></div>}
                                {project.sqft && <div className={`${n.card} rounded-xl p-4 text-center transition-colors duration-300`}><Maximize className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.text}`}>{Number(project.sqft).toLocaleString()}</div><div className={`text-[11px] ${n.muted} mt-0.5`}>Sq Feet</div></div>}
                                {project.yearBuilt && <div className={`${n.card} rounded-xl p-4 text-center transition-colors duration-300`}><Calendar className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.text}`}>{project.yearBuilt}</div><div className={`text-[11px] ${n.muted} mt-0.5`}>Year Built</div></div>}
                                {project.lotSize && <div className={`${n.card} rounded-xl p-4 text-center transition-colors duration-300`}><Trees className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.text}`}>{project.lotSize}</div><div className={`text-[11px] ${n.muted} mt-0.5`}>Lot Size</div></div>}
                            </div>
                        )}

                        {/* Description */}
                        {project.description && (
                            <div className={`${n.card} rounded-2xl p-6 transition-colors duration-300`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${n.label} mb-4`}>About this property</h2>
                                <p className={`${n.secondary} text-[15px] leading-[1.8]`}>{project.description}</p>
                            </div>
                        )}

                        {/* Property details */}
                        {(project.propertyType || project.yearBuilt || project.lotSize || price) && (
                            <div className={`${n.card} rounded-2xl p-6 transition-colors duration-300`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${n.label} mb-4`}>Property Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {project.propertyType && <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg ${n.iconBg} flex items-center justify-center`}><Tag className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.muted}`}>Type</div><div className={`text-sm font-medium ${n.text} capitalize`}>{project.propertyType}</div></div></div>}
                                    {project.yearBuilt && <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg ${n.iconBg} flex items-center justify-center`}><Calendar className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.muted}`}>Built</div><div className={`text-sm font-medium ${n.text}`}>{project.yearBuilt}</div></div></div>}
                                    {project.lotSize && <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg ${n.iconBg} flex items-center justify-center`}><Ruler className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.muted}`}>Lot Size</div><div className={`text-sm font-medium ${n.text}`}>{project.lotSize}</div></div></div>}
                                    {price && <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg ${n.iconBg} flex items-center justify-center`}><DollarSign className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.muted}`}>Price</div><div className={`text-sm font-medium ${n.text}`}>{price}</div></div></div>}
                                </div>
                            </div>
                        )}

                        {/* Amenities */}
                        {project.amenities && project.amenities.length > 0 && (
                            <div className={`${n.card} rounded-2xl p-6 transition-colors duration-300`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${n.label} mb-4`}>Amenities & Features</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {project.amenities.map(a => (
                                        <div key={a} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'} transition-colors`}>
                                            <span className="text-base">{AMENITY_ICONS[a] || '✓'}</span>
                                            <span className={`text-sm ${n.text}`}>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Map */}
                        {location && (
                            <div className={`${n.card} rounded-2xl overflow-hidden transition-colors duration-300`}>
                                <div className="p-6 pb-4">
                                    <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${n.label} mb-2`}>Location</h2>
                                    <div className="flex items-center gap-2">
                                        <MapPin className={`w-4 h-4 ${n.label} flex-shrink-0`} />
                                        <div>
                                            {project.address && <p className={`text-sm font-medium ${n.text}`}>{project.address}</p>}
                                            {(project.city || project.state) && <p className={`text-xs ${n.secondary}`}>{[project.city, project.state, project.zip].filter(Boolean).join(', ')}</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[280px]">
                                    <iframe title="Map" width="100%" height="100%" style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg)' : 'none' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar */}
                    <div className="lg:sticky lg:top-20 space-y-5">
                        <div className={`${n.card} rounded-2xl p-6 transition-colors duration-300`}>
                            <h3 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${n.label} mb-4`}>Listing Summary</h3>
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Status</span><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge}`}>{statusLabel}</span></div>
                                {price && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Asking Price</span><span className={`text-base font-bold ${n.text}`}>{price}</span></div>}
                                {project.propertyType && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Type</span><span className={`text-sm ${n.text} capitalize`}>{project.propertyType}</span></div>}
                                {(project.bedrooms || project.bathrooms) && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Bed / Bath</span><span className={`text-sm ${n.text}`}>{[project.bedrooms && `${project.bedrooms} bd`, project.bathrooms && `${project.bathrooms} ba`].filter(Boolean).join(' / ')}</span></div>}
                                {project.sqft && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Area</span><span className={`text-sm ${n.text}`}>{Number(project.sqft).toLocaleString()} sqft</span></div>}
                                {project.publishedAt && (<><div className={`h-px ${isDark ? 'bg-[#222]' : 'bg-gray-100'}`} /><div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Listed</span><span className={`text-sm ${n.text}`}>{new Date(project.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div></>)}
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl p-6 transition-colors duration-300`}>
                            <p className={`text-sm font-semibold ${n.text} mb-1`}>Interested?</p>
                            <p className={`text-xs ${n.secondary} mb-4 leading-relaxed`}>Message your consultant directly through Timely.</p>
                            <button onClick={() => window.history.back()} className={`w-full ${n.btnPrimary} py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors`}><MessageCircle className="w-4 h-4" />Open Messages</button>
                        </div>

                        <div className={`rounded-xl p-4 ${isDark ? 'bg-blue-500/5 border border-blue-500/10' : 'bg-blue-50/60 border border-blue-100'} transition-colors duration-300`}>
                            <div className="flex items-start gap-2.5">
                                <Lock className={`w-3.5 h-3.5 ${n.label} flex-shrink-0 mt-0.5`} />
                                <p className={`text-[11px] ${n.secondary} leading-relaxed`}>This listing is private and only visible to assigned team members. Do not share this URL externally.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className={`border-t ${n.border} mt-10 transition-colors duration-300`}>
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5"><img src={timelyLogo} alt="Timely" className="w-4 h-4" /><span className={`text-xs font-semibold ${n.text}`}>Timely Real Estate</span></div>
                    <p className={`text-xs ${n.muted}`}>Private listing — for assigned team members only</p>
                </div>
            </footer>
        </div>
    );
};

export default ListingView;