// src/Pages/ListingView.tsx
// Private listing page — neumorphic design, photo slideshow, videos, map

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    MapPin, Bed, Bath, Maximize, ChevronLeft, ChevronRight,
    Home, Building2, Globe, Layers, ArrowLeft, Calendar,
    DollarSign, Tag, Lock, LogIn, X, Sun, Moon,
    Ruler, Trees, Shield, MessageCircle, Share2, Heart,
    Play, Image, Video, CheckCircle, Clock, Eye, Copy
} from 'lucide-react';
import AssignmentService from '../services/AssignmentService';
import timelyLogo from '../assets/Timely_logo.png';

const getSlugFromUrl = (): string => { const p = window.location.pathname.split('/'); return p[p.length - 1] || ''; };
let _useParams: () => { slug?: string };
try { _useParams = require('react-router-dom').useParams; } catch { _useParams = () => ({ slug: getSlugFromUrl() }); }

interface Project {
    projectId: string; projectName: string; description?: string; status?: string; clientName?: string;
    address?: string; city?: string; state?: string; zip?: string;
    propertyType?: string; bedrooms?: string; bathrooms?: string;
    sqft?: string; lotSize?: string; yearBuilt?: string;
    amenities?: string[]; photos?: string[]; videos?: string[]; coverPhotoIndex?: number;
    listingPrice?: string; listingStatus?: string;
    isPublished?: boolean; publishedAt?: string; listingSlug?: string;
    startDate?: string; endDate?: string; budget?: string; createdAt?: string;
}
interface CurrentUser { role: 'admin' | 'consultant' | 'client'; email: string; customerId?: string; consultantId?: string; name?: string; }

const AMENITY_ICONS: Record<string, string> = {
    'Pool': '🏊', 'Gym': '🏋️', 'Garage': '🚗', 'Parking': '🅿️', 'Garden': '🌿', 'Balcony': '🏙️',
    'Terrace': '☀️', 'Elevator': '🛗', 'Security System': '🔒', 'Pet Friendly': '🐾',
    'Air Conditioning': '❄️', 'Heating': '🔥', 'Storage': '📦', 'In-Unit Laundry': '🫧',
    'Furnished': '🛋️', 'Smart Home': '📱', 'Fireplace': '🕯️', 'Solar Panels': '⚡',
};
const STATUS_LABEL: Record<string, string> = { active: 'For Sale', pending: 'Sale Pending', sold: 'Sold' };

const getCurrentUser = (): CurrentUser | null => {
    try {
        const raw = localStorage.getItem('timely_user'), auth = localStorage.getItem('timely_authenticated');
        if (!raw || auth !== 'true') return null;
        const p = JSON.parse(raw); const role = (p.role || 'client').toLowerCase();
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

const ListingView: React.FC = () => {
    const { slug } = _useParams();
    const [isDark, setIsDark] = useState(() => { const s = localStorage.getItem('timely_theme'); return s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; });
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

    useEffect(() => { (async () => {
        const user = getCurrentUser();
        if (!user) { setNotLoggedIn(true); return; }
        try {
            const token = sessionStorage.getItem('timely_token') || localStorage.getItem('timely_token') || '';
            const res = await fetch('/api/projects', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
            const data = res.ok ? await res.json() : null;
            const found = (data?.data || []).find((p: any) => p.isPublished && p.listingSlug === slug);
            if (!found) { setNotFound(true); return; }
            if (!checkAccess(found, user)) { setAccessDenied(true); return; }
            setProject(found); setActivePhoto(found.coverPhotoIndex || 0);
        } catch { setNotFound(true); }
    })(); }, [slug]);

    // Auto-slideshow
    const photos = useMemo(() => (project?.photos || []) as string[], [project]);
    const videos = useMemo(() => (project?.videos || []) as string[], [project]);
    useEffect(() => {
        if (photos.length <= 1) return;
        const t = setInterval(() => setActivePhoto(i => (i + 1) % photos.length), 5000);
        return () => clearInterval(t);
    }, [photos.length]);

    // Gallery keyboard
    useEffect(() => {
        if (!galleryOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setGalleryIndex(i => Math.min(photos.length - 1, i + 1));
            if (e.key === 'ArrowLeft') setGalleryIndex(i => Math.max(0, i - 1));
            if (e.key === 'Escape') setGalleryOpen(false);
        };
        window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
    }, [galleryOpen, photos.length]);

    const price = project?.listingPrice ? `$${Number(project.listingPrice).toLocaleString()}` : null;
    const location = [project?.address, project?.city, project?.state, project?.zip].filter(Boolean).join(', ');
    const statusLabel = STATUS_LABEL[project?.listingStatus || 'active'] ?? 'For Sale';
    const mapQuery = encodeURIComponent(location || project?.projectName || '');
    const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const daysListed = project?.publishedAt ? Math.max(1, Math.ceil((Date.now() - new Date(project.publishedAt).getTime()) / 86400000)) : null;

    // Neumorphic tokens
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
        divider: isDark ? 'border-gray-800/50' : 'border-gray-200/50',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
        btnGhost: isDark ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-900',
        badge: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
        statusBadge: (project?.listingStatus || 'active') === 'active' ? 'bg-emerald-600 text-white' : (project?.listingStatus || 'active') === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white',
        edgeHover: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
        navBg: isDark ? 'bg-[#0a0a0a]/95' : 'bg-[#e4e4e4]/95',
        barBg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#e4e4e4]',
    };

    // Gate screens
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
    if (accessDenied) return <GateScreen icon={<Shield className="w-6 h-6 text-amber-500" />} title="Access restricted" message="You don't have access. Contact your agent." action={<button onClick={() => window.history.back()} className={`${n.flat} px-6 py-2.5 rounded-xl text-sm ${n.secondary} inline-flex items-center gap-2`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (notFound) return <GateScreen icon={<Globe className={`w-6 h-6 ${n.tertiary}`} />} title="Listing not found" message="This listing may have been removed or the URL is incorrect." action={<button onClick={() => window.history.back()} className={`${n.flat} px-6 py-2.5 rounded-xl text-sm ${n.secondary} inline-flex items-center gap-2`}><ArrowLeft className="w-4 h-4" />Go Back</button>} />;
    if (!project) return <div className={`min-h-screen ${n.bg} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

    // Gallery overlay
    if (galleryOpen) return (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col items-center justify-center select-none">
            <button onClick={() => setGalleryOpen(false)} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"><X className="w-5 h-5" /></button>
            {galleryIndex > 0 && <button onClick={() => setGalleryIndex(i => i - 1)} className="absolute left-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-6 h-6" /></button>}
            {galleryIndex < photos.length - 1 && <button onClick={() => setGalleryIndex(i => i + 1)} className="absolute right-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><ChevronRight className="w-6 h-6" /></button>}
            <img src={photos[galleryIndex]} alt="" className="max-w-[92vw] max-h-[82vh] object-contain rounded-xl" />
            <div className="absolute bottom-6 flex items-center gap-4">
                <span className="text-white/50 text-sm font-medium">{galleryIndex + 1} / {photos.length}</span>
            </div>
            <div className="absolute bottom-3 flex gap-1.5">{photos.map((_, i) => <button key={i} onClick={() => setGalleryIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white w-5' : 'bg-white/30'}`} />)}</div>
        </div>
    );

    return (
        <div className={`min-h-screen ${n.bg} ${n.text} transition-colors duration-300`}>

            {/* ═══ NAV ═══ */}
            <nav className={`sticky top-0 z-50 ${n.navBg} backdrop-blur-xl transition-colors duration-300`}>
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className={`${n.btnGhost} flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-colors`}><ArrowLeft className="w-4 h-4" />Back</button>
                    <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center`}><img src={timelyLogo} alt="" className="w-4 h-4" /></div>
                        <span className={`text-sm font-semibold ${n.text}`}>Timely</span>
                        <span className={`text-[9px] tracking-[0.18em] uppercase ${n.tertiary}`}>Real Estate</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${n.badge} flex items-center gap-1`}><Lock className="w-2.5 h-2.5" />Private</span>
                        <button onClick={toggleTheme} className={`w-8 h-8 ${n.flat} rounded-lg flex items-center justify-center ${n.btnGhost} transition-colors`}>{isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}</button>
                    </div>
                </div>
            </nav>

            {/* ═══ HERO — full-width photo with slideshow ═══ */}
            <div className="relative h-[440px] md:h-[520px] overflow-hidden">
                {photos.length > 0 ? (
                    <>
                        {photos.map((photo, i) => (
                            <img key={i} src={photo} alt={project.projectName}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === activePhoto ? 'opacity-100' : 'opacity-0'}`} />
                        ))}
                    </>
                ) : (
                    <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-[#0d1b2e] to-[#1a3a5c]' : 'bg-gradient-to-br from-gray-300 to-gray-500'} flex items-center justify-center`}>
                        {project.propertyType === 'commercial' ? <Building2 className="w-32 h-32 text-white/5" strokeWidth={0.5} /> : <Home className="w-32 h-32 text-white/5" strokeWidth={0.5} />}
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                {/* Hero content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <div className="max-w-7xl mx-auto flex items-end justify-between gap-6 flex-wrap">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-2.5 mb-4">
                                <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${n.statusBadge} shadow-lg`}>{statusLabel}</span>
                                {project.propertyType && <span className="px-3 py-1.5 rounded-full text-xs text-white/90 bg-white/15 backdrop-blur-sm capitalize font-medium">{project.propertyType}</span>}
                                {daysListed && <span className="px-3 py-1.5 rounded-full text-xs text-white/70 bg-white/10 backdrop-blur-sm flex items-center gap-1"><Clock className="w-3 h-3" />{daysListed}d on market</span>}
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight leading-tight">{project.projectName}</h1>
                            {location && <p className="text-white/70 text-sm md:text-base flex items-center gap-2"><MapPin className="w-4 h-4 flex-shrink-0" />{location}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                            {price && <div className="text-3xl md:text-5xl font-bold text-white tracking-tight">{price}</div>}
                            {project.sqft && price && <div className="text-white/50 text-sm mt-1">${(Number(project.listingPrice) / Number(project.sqft)).toFixed(0)}/sqft</div>}
                        </div>
                    </div>
                </div>

                {/* Photo nav dots */}
                {photos.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => <button key={i} onClick={() => setActivePhoto(i)} className={`h-1 rounded-full transition-all duration-300 ${i === activePhoto ? 'w-8 bg-white' : 'w-1 bg-white/40 hover:bg-white/60'}`} />)}
                    </div>
                )}

                {/* Hero actions */}
                <div className="absolute top-4 right-6 md:top-6 md:right-10 flex gap-2">
                    <button onClick={() => setLiked(!liked)} className={`w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors ${liked ? 'bg-red-500/80' : 'hover:bg-black/60'}`}>
                        <Heart className={`w-4 h-4 text-white ${liked ? 'fill-white' : ''}`} />
                    </button>
                    <button onClick={copyLink} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 flex items-center justify-center transition-colors">
                        {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-white" />}
                    </button>
                    {photos.length > 1 && (
                        <button onClick={() => { setGalleryIndex(activePhoto); setGalleryOpen(true); }} className="px-4 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 flex items-center gap-2 transition-colors">
                            <Layers className="w-4 h-4 text-white" /><span className="text-white text-xs font-medium">{photos.length} Photos</span>
                        </button>
                    )}
                </div>

                {/* Prev/Next arrows */}
                {photos.length > 1 && (
                    <>
                        <button onClick={() => setActivePhoto(i => (i - 1 + photos.length) % photos.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={() => setActivePhoto(i => (i + 1) % photos.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
                    </>
                )}
            </div>

            {/* ═══ THUMBNAIL STRIP ═══ */}
            {photos.length > 1 && (
                <div className={`${n.barBg} transition-colors duration-300`}>
                    <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto">
                        {photos.map((photo, i) => (
                            <button key={i} onClick={() => setActivePhoto(i)}
                                className={`flex-shrink-0 w-[72px] h-12 rounded-lg overflow-hidden transition-all duration-200 ${i === activePhoto ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-[#0a0a0a]' : 'ring-offset-[#e4e4e4]') + ' scale-105' : 'opacity-40 hover:opacity-80'}`}>
                                <img src={photo} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ QUICK STATS BAR ═══ */}
            <div className={`${n.barBg} transition-colors duration-300 pb-6`}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className={`${n.card} rounded-2xl p-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-4 md:gap-6 overflow-x-auto">
                            {project.bedrooms && <div className="flex items-center gap-2 flex-shrink-0"><div className={`w-8 h-8 ${n.inset} rounded-lg flex items-center justify-center`}><Bed className={`w-4 h-4 ${n.label}`} /></div><div><span className={`text-sm font-bold ${n.strong}`}>{project.bedrooms}</span><span className={`text-xs ${n.tertiary} ml-1`}>bed</span></div></div>}
                            {project.bathrooms && <div className="flex items-center gap-2 flex-shrink-0"><div className={`w-8 h-8 ${n.inset} rounded-lg flex items-center justify-center`}><Bath className={`w-4 h-4 ${n.label}`} /></div><div><span className={`text-sm font-bold ${n.strong}`}>{project.bathrooms}</span><span className={`text-xs ${n.tertiary} ml-1`}>bath</span></div></div>}
                            {project.sqft && <div className="flex items-center gap-2 flex-shrink-0"><div className={`w-8 h-8 ${n.inset} rounded-lg flex items-center justify-center`}><Maximize className={`w-4 h-4 ${n.label}`} /></div><div><span className={`text-sm font-bold ${n.strong}`}>{Number(project.sqft).toLocaleString()}</span><span className={`text-xs ${n.tertiary} ml-1`}>sqft</span></div></div>}
                            {project.yearBuilt && <div className="flex items-center gap-2 flex-shrink-0"><div className={`w-8 h-8 ${n.inset} rounded-lg flex items-center justify-center`}><Calendar className={`w-4 h-4 ${n.label}`} /></div><div><span className={`text-xs ${n.tertiary}`}>Built</span><span className={`text-sm font-bold ${n.strong} ml-1`}>{project.yearBuilt}</span></div></div>}
                            {project.lotSize && <div className="flex items-center gap-2 flex-shrink-0"><div className={`w-8 h-8 ${n.inset} rounded-lg flex items-center justify-center`}><Trees className={`w-4 h-4 ${n.label}`} /></div><div><span className={`text-sm font-bold ${n.strong}`}>{project.lotSize}</span><span className={`text-xs ${n.tertiary} ml-1`}>lot</span></div></div>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                            <button onClick={() => setLiked(!liked)} className={`w-9 h-9 ${n.flat} rounded-lg flex items-center justify-center transition-all`}><Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : n.tertiary}`} /></button>
                            <button onClick={copyLink} className={`w-9 h-9 ${n.flat} rounded-lg flex items-center justify-center transition-all`}>{copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className={`w-4 h-4 ${n.tertiary}`} />}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ CONTENT ═══ */}
            <div className="max-w-7xl mx-auto px-6 pb-12">
                <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

                    {/* ── LEFT ── */}
                    <div className="space-y-6">

                        {/* Overview — description + key facts */}
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            {/* Price banner */}
                            {price && (
                                <div className={`px-6 py-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50/80'} flex items-center justify-between`}>
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-[0.15em] ${n.label} font-semibold`}>Asking Price</span>
                                        <div className={`text-2xl font-bold ${n.strong} tracking-tight mt-0.5`}>{price}</div>
                                    </div>
                                    <div className="text-right">
                                        {project.sqft && <div className={`text-xs ${n.secondary}`}>${(Number(project.listingPrice) / Number(project.sqft)).toFixed(0)} per sqft</div>}
                                        {daysListed && <div className={`text-xs ${n.tertiary} mt-0.5`}>{daysListed} days on market</div>}
                                    </div>
                                </div>
                            )}
                            <div className="p-6">
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-3`}>Overview</h2>
                                {project.description ? (
                                    <p className={`${n.secondary} text-[15px] leading-[1.85]`}>{project.description}</p>
                                ) : (
                                    <p className={`${n.tertiary} text-sm italic`}>No description available for this property.</p>
                                )}
                            </div>
                        </div>

                        {/* Property details grid */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Property Details</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    project.propertyType && { icon: Tag, label: 'Type', value: project.propertyType, capitalize: true },
                                    project.bedrooms && { icon: Bed, label: 'Bedrooms', value: project.bedrooms },
                                    project.bathrooms && { icon: Bath, label: 'Bathrooms', value: project.bathrooms },
                                    project.sqft && { icon: Maximize, label: 'Living Area', value: `${Number(project.sqft).toLocaleString()} sqft` },
                                    project.lotSize && { icon: Ruler, label: 'Lot Size', value: project.lotSize },
                                    project.yearBuilt && { icon: Calendar, label: 'Year Built', value: project.yearBuilt },
                                    price && { icon: DollarSign, label: 'Price', value: price },
                                    project.status && { icon: CheckCircle, label: 'Project Status', value: project.status.replace(/_/g, ' '), capitalize: true },
                                ].filter(Boolean).map((item: any, i) => (
                                    <div key={i} className={`${n.flat} rounded-xl p-3.5 flex items-center gap-3`}>
                                        <div className={`w-9 h-9 ${n.inset} rounded-lg flex items-center justify-center flex-shrink-0`}><item.icon className={`w-4 h-4 ${n.label}`} /></div>
                                        <div className="min-w-0">
                                            <div className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>{item.label}</div>
                                            <div className={`text-sm font-semibold ${n.text} truncate ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Amenities */}
                        {project.amenities && project.amenities.length > 0 && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Amenities & Features</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {project.amenities.map(a => (
                                        <div key={a} className={`${n.flat} rounded-xl px-3.5 py-3 flex items-center gap-3`}>
                                            <span className="text-lg">{AMENITY_ICONS[a] || '✓'}</span>
                                            <span className={`text-sm ${n.text}`}>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── PHOTO GALLERY ── */}
                        {photos.length > 0 && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} flex items-center gap-2`}><Image className="w-3.5 h-3.5" />Photos <span className={`${n.badge} text-[10px] px-1.5 py-0.5 rounded-full ml-1`}>{photos.length}</span></h2>
                                    <button onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }} className={`text-xs ${n.label} flex items-center gap-1 hover:underline`}><Eye className="w-3 h-3" />View all</button>
                                </div>
                                {/* Featured + grid */}
                                <div className="grid grid-cols-4 gap-2">
                                    {/* Large featured */}
                                    <button onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }} className="col-span-2 row-span-2 relative rounded-xl overflow-hidden group aspect-[4/3]">
                                        <img src={photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </button>
                                    {/* Grid */}
                                    {photos.slice(1, 5).map((photo, i) => (
                                        <button key={i} onClick={() => { setGalleryIndex(i + 1); setGalleryOpen(true); }} className="relative rounded-xl overflow-hidden group aspect-[4/3]">
                                            <img src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            {i === 3 && photos.length > 5 && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white font-bold text-lg">+{photos.length - 5}</span></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── VIDEOS ── */}
                        {videos.length > 0 && (
                            <div className={`${n.card} rounded-2xl p-6`}>
                                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} flex items-center gap-2 mb-4`}><Video className="w-3.5 h-3.5" />Property Videos <span className={`${n.badge} text-[10px] px-1.5 py-0.5 rounded-full ml-1`}>{videos.length}</span></h2>
                                <div className={`grid ${videos.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
                                    {videos.map((video, i) => (
                                        <div key={i} className={`${n.flat} rounded-xl overflow-hidden`}>
                                            <video src={video} controls className="w-full aspect-video object-cover" preload="metadata" controlsList="nodownload" />
                                            <div className={`px-3 py-2 flex items-center gap-2`}>
                                                <Play className={`w-3 h-3 ${n.label}`} />
                                                <span className={`text-xs ${n.secondary}`}>Tour {i + 1}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── MAP ── */}
                        {location && (
                            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                                <div className="p-6 pb-4">
                                    <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-3`}>Location</h2>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 ${n.inset} rounded-xl flex items-center justify-center`}><MapPin className={`w-4 h-4 ${n.label}`} /></div>
                                        <div>
                                            {project.address && <p className={`text-sm font-semibold ${n.text}`}>{project.address}</p>}
                                            {(project.city || project.state) && <p className={`text-xs ${n.secondary}`}>{[project.city, project.state, project.zip].filter(Boolean).join(', ')}</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[320px]">
                                    <iframe title="Map" width="100%" height="100%" style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg) brightness(0.95)' : 'none' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT SIDEBAR ── */}
                    <div className="lg:sticky lg:top-20 space-y-5">

                        {/* Summary */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <h3 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Listing Summary</h3>
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Status</span><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${n.statusBadge}`}>{statusLabel}</span></div>
                                {price && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Price</span><span className={`text-lg font-bold ${n.strong}`}>{price}</span></div>}
                                {project.propertyType && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Type</span><span className={`text-sm font-medium ${n.text} capitalize`}>{project.propertyType}</span></div>}
                                {(project.bedrooms || project.bathrooms) && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Bed / Bath</span><span className={`text-sm font-medium ${n.text}`}>{[project.bedrooms && `${project.bedrooms} bd`, project.bathrooms && `${project.bathrooms} ba`].filter(Boolean).join(' · ')}</span></div>}
                                {project.sqft && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Area</span><span className={`text-sm font-medium ${n.text}`}>{Number(project.sqft).toLocaleString()} sqft</span></div>}
                                {project.lotSize && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Lot</span><span className={`text-sm font-medium ${n.text}`}>{project.lotSize}</span></div>}
                                {project.yearBuilt && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Built</span><span className={`text-sm font-medium ${n.text}`}>{project.yearBuilt}</span></div>}
                                {project.publishedAt && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Listed</span><span className={`text-sm font-medium ${n.text}`}>{new Date(project.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                                {photos.length > 0 && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Photos</span><span className={`text-sm font-medium ${n.text}`}>{photos.length}</span></div>}
                                {videos.length > 0 && <div className="flex items-center justify-between"><span className={`text-sm ${n.secondary}`}>Videos</span><span className={`text-sm font-medium ${n.text}`}>{videos.length}</span></div>}
                            </div>
                        </div>

                        {/* CTA */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <p className={`text-sm font-semibold ${n.strong} mb-1`}>Interested in this property?</p>
                            <p className={`text-xs ${n.secondary} mb-5 leading-relaxed`}>Send a message to your assigned consultant directly through Timely.</p>
                            <button onClick={() => window.history.back()} className={`w-full ${n.btnPrimary} py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20`}><MessageCircle className="w-4 h-4" />Open Messages</button>
                        </div>

                        {/* Timeline */}
                        <div className={`${n.card} rounded-2xl p-6`}>
                            <h3 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${n.label} mb-4`}>Timeline</h3>
                            <div className="relative pl-6">
                                <div className={`absolute left-[7px] top-1 bottom-1 w-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                {project.publishedAt && (
                                    <div className="relative flex items-start gap-3 pb-4">
                                        <div className="absolute -left-6 top-1 w-[9px] h-[9px] rounded-full bg-emerald-500" />
                                        <div><p className={`text-xs font-medium ${n.text}`}>Listing Published</p><p className={`text-[11px] ${n.tertiary}`}>{new Date(project.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
                                    </div>
                                )}
                                {project.createdAt && (
                                    <div className="relative flex items-start gap-3 pb-4">
                                        <div className="absolute -left-6 top-1 w-[9px] h-[9px] rounded-full bg-blue-500" />
                                        <div><p className={`text-xs font-medium ${n.text}`}>Project Created</p><p className={`text-[11px] ${n.tertiary}`}>{new Date(project.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
                                    </div>
                                )}
                                {project.startDate && (
                                    <div className="relative flex items-start gap-3">
                                        <div className="absolute -left-6 top-1 w-[9px] h-[9px] rounded-full bg-amber-500" />
                                        <div><p className={`text-xs font-medium ${n.text}`}>Project Start</p><p className={`text-[11px] ${n.tertiary}`}>{new Date(project.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
                                    </div>
                                )}
                            </div>
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

            {/* ═══ FOOTER ═══ */}
            <footer className={`${n.barBg} mt-4 transition-colors duration-300`}>
                <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <img src={timelyLogo} alt="" className="w-4 h-4" />
                        <span className={`text-xs font-semibold ${n.text}`}>Timely Real Estate</span>
                    </div>
                    <p className={`text-xs ${n.tertiary}`}>Private listing — assigned team members only</p>
                </div>
            </footer>
        </div>
    );
};

export default ListingView;