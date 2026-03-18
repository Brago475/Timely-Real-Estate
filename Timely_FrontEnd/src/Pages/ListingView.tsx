// src/Pages/ListingView.tsx
//
// Private listing page — neumorphic design matching the Timely app.
// Route: /listing/:slug

import React, { useState, useEffect, useMemo } from 'react';
import {
    MapPin, Bed, Bath, Maximize, ChevronLeft, ChevronRight,
    Home, Building2, Globe, Layers, ArrowLeft, Calendar,
    DollarSign, Tag, Lock, LogIn, X, Sun, Moon,
    Ruler, Trees, Shield, MessageCircle, Share2, Heart,
    Play, Image, Video, CheckCircle
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
    amenities?: string[]; photos?: string[]; videos?: string[]; coverPhotoIndex?: number;
    listingPrice?: string; listingStatus?: string;
    isPublished?: boolean; publishedAt?: string; listingSlug?: string;
    startDate?: string; endDate?: string; budget?: string;
    createdAt?: string;
}
interface CurrentUser { role: 'admin' | 'consultant' | 'client'; email: string; customerId?: string; consultantId?: string; name?: string; }

// ─── Amenity icons ────────────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
    'Pool': '🏊', 'Gym': '🏋️', 'Garage': '🚗', 'Parking': '🅿️',
    'Garden': '🌿', 'Balcony': '🏙️', 'Terrace': '☀️', 'Elevator': '🛗',
    'Security System': '🔒', 'Pet Friendly': '🐾', 'Air Conditioning': '❄️',
    'Heating': '🔥', 'Storage': '📦', 'In-Unit Laundry': '🫧',
    'Furnished': '🛋️', 'Smart Home': '📱', 'Fireplace': '🕯️', 'Solar Panels': '⚡',
};
const STATUS_LABEL: Record<string, string> = { active: 'For Sale', pending: 'Sale Pending', sold: 'Sold' };

// ─── Auth ─────────────────────────────────────────────────────────────────────
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
    const [copied, setCopied] = useState(false);
    const [mediaTab, setMediaTab] = useState<'photos' | 'videos'>('photos');

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
    const videos = useMemo(() => (project?.videos || []) as string[], [project]);
    const price = project?.listingPrice ? `$${Number(project.listingPrice).toLocaleString()}` : null;
    const location = [project?.address, project?.city, project?.state, project?.zip].filter(Boolean).join(', ');
    const statusLabel = STATUS_LABEL[project?.listingStatus || 'active'] ?? 'For Sale';
    const mapQuery = encodeURIComponent(location || project?.projectName || '');

    const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    // ── Neumorphic tokens ─────────────────────────────────────────────────────
    const n = {
        bg: isDark ? 'neu-bg-dark' : 'neu-bg-light',
        card: isDark ? 'neu-dark' : 'neu-light',
        flat: isDark ? 'neu-dark-flat' : 'neu-light-flat',
        inset: isDark ? 'neu-dark-inset' : 'neu-light-inset',
        pressed: isDark ? 'neu-dark-pressed' : 'neu-light-pressed',
        text: isDark ? 'text-white' : 'text-gray-900',
        strong: isDark ? 'text-white' : 'text-black',
        secondary: isDark ? 'text-gray-300' : 'text-gray-600',
        tertiary: isDark ? 'text-gray-500' : 'text-gray-400',
        label: isDark ? 'text-blue-400' : 'text-blue-600',
        divider: isDark ? 'border-gray-800' : 'border-gray-200',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
        btnGhost: isDark ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-900',
        badge: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
        statusBadge: (project?.listingStatus || 'active') === 'active'
            ? 'bg-emerald-600 text-white' : (project?.listingStatus || 'active') === 'pending'
            ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white',
        edgeHover: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
    };

    // ── Gate screens ──────────────────────────────────────────────────────────
    const GateScreen: React.FC<{ icon: React.ReactNode; title: string; message: string; action?: React.ReactNode }> = ({ icon, title, message, action }) => (
        <div className={`min-h-screen ${n.bg} ${n.text} flex items-center justify-center px-6`}>
            <div className="text-center max-w-sm">
                <div className={`w-16 h-16 ${n.card} rounded-2xl flex items-center justify-center mx-auto mb-5`}>{icon}</div>
                <h2 className={`text-xl font-semibold ${n.strong} mb-2`}>{title}</h2>
                <p className={`${n.secondary} text-sm mb-6 leading-relaxed`}>{message}</p>
                {action}
            </div>
        </div>
    );

    if (notLoggedIn) return <GateScreen icon={<Lock className={`w-6 h-6 ${n.label}`} />} title="Sign in required" message="This listing is private. Log in to your Timely account to view it." action={<button onClick={() => window.location.href = '/'} className={`${n.btnPrimary} px-6 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2`}><LogIn className="w-4 h-4" />Go to Login</button>} />;
    if (accessDenied) return <GateScreen icon={<Shield className="w-6 h-6 text-amber-500" />} title="Access restricted" message="You don't have access to this listing. Contact your agent." action={<button onClick={() => window.history.back()} className={`${n.flat} px-6 py-2.5 rounded-xl text-sm ${n.secondary} inline-flex items-center gap-2`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (notFound) return <GateScreen icon={<Globe className={`w-6 h-6 ${n.tertiary}`} />} title="Listing not found" message="This listing may have been removed or the URL is incorrect." action={<button onClick={() => window.history.back()} className={`${n.flat} px-6 py-2.5 rounded-xl text-sm ${n.secondary} inline-flex items-center gap-2`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (!project) return <div className={`min-h-screen ${n.bg} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

    // ── Gallery overlay ───────────────────────────────────────────────────────
    if (galleryOpen) return (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col items-center justify-center">
            <button onClick={() => setGalleryOpen(false)} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><X className="w-5 h-5" /></button>
            {galleryIndex > 0 && <button onClick={() => setGalleryIndex(i => i - 1)} className="absolute left-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-6 h-6" /></button>}
            {galleryIndex < photos.length - 1 && <button onClick={() => setGalleryIndex(i => i + 1)} className="absolute right-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronRight className="w-6 h-6" /></button>}
            <img src={photos[galleryIndex]} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl" />
            <span className="absolute bottom-8 text-white/50 text-sm">{galleryIndex + 1} / {photos.length}</span>
            <div className="absolute bottom-4 flex gap-1.5">{photos.map((_, i) => <button key={i} onClick={() => setGalleryIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? 'bg-white' : 'bg-white/30'}`} />)}</div>
        </div>
    );

    // ── Main page ─────────────────────────────────────────────────────────────
    return (
        <div className={`min-h-screen ${n.bg} ${n.text} transition-colors duration-300`}>

            {/* ── Nav ── */}
            <nav className={`sticky top-0 z-50 ${isDark ? 'bg-[#0a0a0a]/95' : 'bg-[#e4e4e4]/95'} backdrop-blur-xl border-b ${n.divider} transition-colors duration-300`}>
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className={`${n.btnGhost} flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-colors`}><ArrowLeft className="w-4 h-4" />Back</button>
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 ${n.flat} rounded-lg flex items-center justify-center`}>
                            <img src={timelyLogo} alt="Timely" className="w-5 h-5" />
                        </div>
                        <span className={`text-sm font-semibold ${n.text}`}>Timely</span>
                        <span className={`text-[10px] tracking-[0.15em] uppercase ${n.tertiary}`}>Real Estate</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${n.badge} flex items-center gap-1`}><Lock className="w-2.5 h-2.5" />Private</span>
                        <button onClick={toggleTheme} className={`w-8 h-8 ${n.flat} rounded-lg flex items-center justify-center ${n.btnGhost} transition-colors`}>{isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}</button>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <div className="relative h-[400px] md:h-[480px] overflow-hidden">
                {photos.length > 0
                    ? <img src={photos[activePhoto]} alt={project.projectName} className="w-full h-full object-cover" />
                    : <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-[#0d1b2e] to-[#1a3a5c]' : 'bg-gradient-to-br from-gray-300 to-gray-400'} flex items-center justify-center`}>{project.propertyType === 'commercial' ? <Building2 className="w-24 h-24 text-white/5" strokeWidth={0.8} /> : <Home className="w-24 h-24 text-white/5" strokeWidth={0.8} />}</div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <div className="max-w-6xl mx-auto flex items-end justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2.5 mb-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${n.statusBadge}`}>{statusLabel}</span>
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
                    <button onClick={() => { setGalleryIndex(activePhoto); setGalleryOpen(true); }}
                        className="absolute bottom-6 right-6 md:bottom-10 md:right-10 px-3.5 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-xl text-white text-xs font-medium flex items-center gap-2 transition-colors border border-white/10">
                        <Layers className="w-3.5 h-3.5" />View all {photos.length}
                    </button>
                )}
            </div>

            {/* ── Photo strip ── */}
            {photos.length > 1 && (
                <div className={`${isDark ? 'bg-[#0a0a0a]' : 'bg-[#e4e4e4]'} border-b ${n.divider} transition-colors duration-300`}>
                    <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto">
                        {photos.map((photo, i) => (
                            <button key={i} onClick={() => setActivePhoto(i)}
                                className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all duration-200 ${i === activePhoto ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-[#0a0a0a]' : 'ring-offset-[#e4e4e4]') : 'opacity-50 hover:opacity-100'}`}>
                                <img src={photo} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Quick stats + actions bar ── */}
            <div className={`${isDark ? 'bg-[#0a0a0a]' : 'bg-[#e4e4e4]'} border-b ${n.divider} transition-colors duration-300`}>
                <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-5 overflow-x-auto">
                        {project.bedrooms && <div className="flex items-center gap-1.5 flex-shrink-0"><Bed className={`w-4 h-4 ${n.label}`} /><span className={`text-sm font-medium ${n.text}`}>{project.bedrooms} <span className={n.tertiary}>bed</span></span></div>}
                        {project.bathrooms && <div className="flex items-center gap-1.5 flex-shrink-0"><Bath className={`w-4 h-4 ${n.label}`} /><span className={`text-sm font-medium ${n.text}`}>{project.bathrooms} <span className={n.tertiary}>bath</span></span></div>}
                        {project.sqft && <div className="flex items-center gap-1.5 flex-shrink-0"><Maximize className={`w-4 h-4 ${n.label}`} /><span className={`text-sm font-medium ${n.text}`}>{Number(project.sqft).toLocaleString()} <span className={n.tertiary}>sqft</span></span></div>}
                        {project.yearBuilt && <div className="flex items-center gap-1.5 flex-shrink-0"><Calendar className={`w-4 h-4 ${n.label}`} /><span className={`text-sm font-medium ${n.text}`}>Built {project.yearBuilt}</span></div>}
                        {project.lotSize && <div className="flex items-center gap-1.5 flex-shrink-0"><Trees className={`w-4 h-4 ${n.label}`} /><span className={`text-sm font-medium ${n.text}`}>{project.lotSize} <span className={n.tertiary}>lot</span></span></div>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setLiked(!liked)} className={`w-9 h-9 ${n.flat} rounded-lg flex items-center justify-center transition-all`}>
                            <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : n.tertiary}`} />
                        </button>
                        <button onClick={copyLink} className={`w-9 h-9 ${n.flat} rounded-lg flex items-center justify-center transition-all`}>
                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Share2 className={`w-4 h-4 ${n.tertiary}`} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">

                    {/* ── Left ── */}
                    <div className="space-y-6">

                        {/* Stat cards */}
                        {(project.bedrooms || project.bathrooms || project.sqft || project.yearBuilt || project.lotSize) && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {project.bedrooms && <div className={`${n.card} ${n.edgeHover} rounded-xl p-4 text-center transition-all`}><Bed className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.strong}`}>{project.bedrooms}</div><div className={`text-[11px] ${n.tertiary} mt-0.5`}>Bedrooms</div></div>}
                                {project.bathrooms && <div className={`${n.card} ${n.edgeHover} rounded-xl p-4 text-center transition-all`}><Bath className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.strong}`}>{project.bathrooms}</div><div className={`text-[11px] ${n.tertiary} mt-0.5`}>Bathrooms</div></div>}
                                {project.sqft && <div className={`${n.card} ${n.edgeHover} rounded-xl p-4 text-center transition-all`}><Maximize className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.strong}`}>{Number(project.sqft).toLocaleString()}</div><div className={`text-[11px] ${n.tertiary} mt-0.5`}>Sq Feet</div></div>}
                                {project.yearBuilt && <div className={`${n.card} ${n.edgeHover} rounded-xl p-4 text-center transition-all`}><Calendar className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.strong}`}>{project.yearBuilt}</div><div className={`text-[11px] ${n.tertiary} mt-0.5`}>Year Built</div></div>}
                                {project.lotSize && <div className={`${n.card} ${n.edgeHover} rounded-xl p-4 text-center transition-all`}><Trees className={`w-5 h-5 ${n.label} mx-auto mb-2`} /><div className={`text-xl font-bold ${n.strong}`}>{project.lotSize}</div><div className={`text-[11px] ${n.tertiary} mt-0.5`}>Lot Size</div></div>}
                            </div>
                        )}

                        {/* Description */}
                        {project.description && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>About this property</h2>
                                <p className={`${n.secondary} text-[15px] leading-[1.8]`}>{project.description}</p>
                            </div>
                        )}

                        {/* Property details */}
                        {(project.propertyType || project.yearBuilt || project.lotSize || price) && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Property Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {project.propertyType && <div className="flex items-center gap-3"><div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center`}><Tag className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Type</div><div className={`text-sm font-medium ${n.text} capitalize`}>{project.propertyType}</div></div></div>}
                                    {project.yearBuilt && <div className="flex items-center gap-3"><div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center`}><Calendar className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Built</div><div className={`text-sm font-medium ${n.text}`}>{project.yearBuilt}</div></div></div>}
                                    {project.lotSize && <div className="flex items-center gap-3"><div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center`}><Ruler className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Lot</div><div className={`text-sm font-medium ${n.text}`}>{project.lotSize}</div></div></div>}
                                    {price && <div className="flex items-center gap-3"><div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center`}><DollarSign className={`w-4 h-4 ${n.label}`} /></div><div><div className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Price</div><div className={`text-sm font-medium ${n.text}`}>{price}</div></div></div>}
                                </div>
                            </div>
                        )}

                        {/* Amenities */}
                        {project.amenities && project.amenities.length > 0 && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Amenities & Features</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {project.amenities.map(a => (
                                        <div key={a} className={`flex items-center gap-2.5 px-3 py-2.5 ${n.flat} rounded-xl`}>
                                            <span className="text-base">{AMENITY_ICONS[a] || '✓'}</span>
                                            <span className={`text-sm ${n.text}`}>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Media: Photos & Videos ── */}
                        {(photos.length > 0 || videos.length > 0) && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label}`}>Media</h2>
                                    <div className={`${n.flat} rounded-lg flex p-0.5`}>
                                        <button onClick={() => setMediaTab('photos')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mediaTab === 'photos' ? n.pressed + ' ' + n.label : n.tertiary}`}>
                                            <Image className="w-3 h-3" />Photos {photos.length > 0 && <span className={`text-[10px] ${n.badge} px-1.5 py-0.5 rounded-full`}>{photos.length}</span>}
                                        </button>
                                        <button onClick={() => setMediaTab('videos')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mediaTab === 'videos' ? n.pressed + ' ' + n.label : n.tertiary}`}>
                                            <Video className="w-3 h-3" />Videos {videos.length > 0 && <span className={`text-[10px] ${n.badge} px-1.5 py-0.5 rounded-full`}>{videos.length}</span>}
                                        </button>
                                    </div>
                                </div>

                                {mediaTab === 'photos' && (
                                    photos.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {photos.map((photo, i) => (
                                                <button key={i} onClick={() => { setGalleryIndex(i); setGalleryOpen(true); }}
                                                    className={`relative aspect-[4/3] rounded-xl overflow-hidden group ${n.edgeHover} transition-all`}>
                                                    <img src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    {i === (project.coverPhotoIndex || 0) && <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 rounded text-[9px] font-bold text-white">COVER</div>}
                                                </button>
                                            ))}
                                        </div>
                                    ) : <p className={`text-sm ${n.tertiary} text-center py-8`}>No photos uploaded yet</p>
                                )}

                                {mediaTab === 'videos' && (
                                    videos.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {videos.map((video, i) => (
                                                <div key={i} className={`${n.flat} rounded-xl overflow-hidden`}>
                                                    <video src={video} controls className="w-full aspect-video object-cover" preload="metadata" />
                                                    <div className={`px-3 py-2 flex items-center gap-2 ${n.tertiary}`}>
                                                        <Play className="w-3 h-3" />
                                                        <span className="text-xs">Video {i + 1}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className={`text-sm ${n.tertiary} text-center py-8`}>No videos uploaded yet</p>
                                )}
                            </div>
                        )}

                        {/* Map */}
                        {location && (
                            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                                <div className="p-6 pb-4">
                                    <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-2`}>Location</h2>
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center`}><MapPin className={`w-4 h-4 ${n.label}`} /></div>
                                        <div>
                                            {project.address && <p className={`text-sm font-medium ${n.text}`}>{project.address}</p>}
                                            {(project.city || project.state) && <p className={`text-xs ${n.secondary}`}>{[project.city, project.state, project.zip].filter(Boolean).join(', ')}</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[300px]">
                                    <iframe title="Map" width="100%" height="100%" style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg) brightness(0.95)' : 'none' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right sidebar ── */}
                    <div className="lg:sticky lg:top-20 space-y-4">

                        {/* Summary */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <h3 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Listing Summary</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Status</span><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${n.statusBadge}`}>{statusLabel}</span></div>
                                {price && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Asking Price</span><span className={`text-base font-bold ${n.strong}`}>{price}</span></div>}
                                {project.propertyType && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Type</span><span className={`text-sm ${n.text} capitalize`}>{project.propertyType}</span></div>}
                                {(project.bedrooms || project.bathrooms) && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Bed / Bath</span><span className={`text-sm ${n.text}`}>{[project.bedrooms && `${project.bedrooms} bd`, project.bathrooms && `${project.bathrooms} ba`].filter(Boolean).join(' / ')}</span></div>}
                                {project.sqft && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Area</span><span className={`text-sm ${n.text}`}>{Number(project.sqft).toLocaleString()} sqft</span></div>}
                                {project.publishedAt && (
                                    <>
                                        <div className={`h-px border-t ${n.divider}`} />
                                        <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Listed</span><span className={`text-sm ${n.text}`}>{new Date(project.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                                    </>
                                )}
                                {photos.length > 0 && (
                                    <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Photos</span><span className={`text-sm ${n.text}`}>{photos.length}</span></div>
                                )}
                                {videos.length > 0 && (
                                    <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Videos</span><span className={`text-sm ${n.text}`}>{videos.length}</span></div>
                                )}
                            </div>
                        </div>

                        {/* CTA */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <p className={`text-sm font-semibold ${n.strong} mb-1`}>Interested?</p>
                            <p className={`text-xs ${n.secondary} mb-4 leading-relaxed`}>Message your consultant directly through Timely.</p>
                            <button onClick={() => window.history.back()} className={`w-full ${n.btnPrimary} py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2`}><MessageCircle className="w-4 h-4" />Open Messages</button>
                        </div>

                        {/* Privacy */}
                        <div className={`${n.flat} rounded-xl p-4`}>
                            <div className="flex items-start gap-2.5">
                                <Lock className={`w-3.5 h-3.5 ${n.label} flex-shrink-0 mt-0.5`} />
                                <p className={`text-[11px] ${n.secondary} leading-relaxed`}>This listing is private and only visible to assigned team members. Do not share externally.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className={`border-t ${n.divider} mt-8`}>
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <img src={timelyLogo} alt="Timely" className="w-4 h-4" />
                        <span className={`text-xs font-semibold ${n.text}`}>Timely Real Estate</span>
                    </div>
                    <p className={`text-xs ${n.tertiary}`}>Private listing — assigned team members only</p>
                </div>
            </footer>
        </div>
    );
};

export default ListingView;