// src/Pages/ListingView.tsx
//
// Private listing page — requires Timely login.
// Access is checked against project assignments before rendering.
// Route: /listing/:slug
//
// Add to App.tsx routing (already handled via getListingSlug intercept).

import React, { useState, useEffect, useMemo } from 'react';
import {
    MapPin, Bed, Bath, Maximize, ChevronLeft, ChevronRight,
    Home, Building2, Globe, Layers, ArrowLeft, Calendar,
    DollarSign, Tag, Lock, LogIn, CheckCircle, Clock
} from 'lucide-react';
import AssignmentService from '../services/AssignmentService';

// ─── Router shim ──────────────────────────────────────────────────────────────
const getSlugFromUrl = (): string => {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
};

let _useParams: () => { slug?: string };
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _useParams = require('react-router-dom').useParams;
} catch {
    _useParams = () => ({ slug: getSlugFromUrl() });
}

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
    email: string;
    customerId?: string;
    consultantId?: string;
    name?: string;
}

// ─── Amenity emoji map ────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, string> = {
    'Pool': '🏊', 'Gym': '🏋️', 'Garage': '🚗', 'Parking': '🅿️',
    'Garden': '🌿', 'Balcony': '🏙️', 'Terrace': '☀️', 'Elevator': '🛗',
    'Security System': '🔒', 'Pet Friendly': '🐾', 'Air Conditioning': '❄️',
    'Heating': '🔥', 'Storage': '📦', 'In-Unit Laundry': '🫧',
    'Furnished': '🛋️', 'Smart Home': '📱', 'Fireplace': '🕯️', 'Solar Panels': '⚡',
};

const STATUS_LABEL: Record<string, string> = { active: 'For Sale', pending: 'Sale Pending', sold: 'Sold' };
const STATUS_COLOR: Record<string, string>  = { active: '#10b981', pending: '#f59e0b', sold: '#6b7280' };

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
    bg:        '#080c12',
    surface:   'rgba(255,255,255,0.04)',
    border:    'rgba(255,255,255,0.08)',
    text:      '#f1f5f9',
    muted:     '#94a3b8',
    dim:       '#475569',
    blue:      '#3b82f6',
    blueHover: '#2563eb',
    emerald:   '#10b981',
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const getCurrentUser = (): CurrentUser | null => {
    try {
        const raw  = localStorage.getItem('timely_user');
        const auth = localStorage.getItem('timely_authenticated');
        if (!raw || auth !== 'true') return null;
        const p    = JSON.parse(raw);
        const role = (p.role || 'client').toLowerCase();
        if (role !== 'admin' && role !== 'consultant' && role !== 'client') return null;
        return { role, email: p.email || '', customerId: p.customerId, consultantId: p.consultantId || p.customerId, name: p.name };
    } catch { return null; }
};

const checkAccess = (project: Project, user: CurrentUser): boolean => {
    if (user.role === 'admin') return true;
    const pid = String(project.projectId);
    if (user.role === 'consultant' && user.consultantId) {
        const assignedProjects = AssignmentService.getProjectsForConsultant(user.consultantId);
        return assignedProjects.includes(pid);
    }
    if (user.role === 'client' && user.customerId) {
        const assignedProjects = AssignmentService.getProjectsForClient(user.customerId);
        return assignedProjects.includes(pid);
    }
    return false;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ListingView: React.FC = () => {
    const { slug } = _useParams();

    const [project, setProject]           = useState<Project | null>(null);
    const [notFound, setNotFound]         = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [notLoggedIn, setNotLoggedIn]   = useState(false);
    const [galleryOpen, setGalleryOpen]   = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [activePhoto, setActivePhoto]   = useState(0);

    useEffect(() => { (async () => {
        // 1. Check auth
        const user = getCurrentUser();
        if (!user) { setNotLoggedIn(true); return; }

        // 2. Find project by slug from API
        try {
const token = sessionStorage.getItem('timely_token') || localStorage.getItem('timely_token') || '';
const res = await fetch('/api/projects', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });            const data = res.ok ? await res.json() : null;
            const all: Project[] = data?.data || [];
            const found = all.find((p: any) => p.isPublished && p.listingSlug === slug);
            if (!found) { setNotFound(true); return; }

            // 3. Check assignment
            if (!checkAccess(found, user)) { setAccessDenied(true); return; }

            setProject(found);
            setActivePhoto(found.coverPhotoIndex || 0);
        } catch { setNotFound(true); }
    })(); }, [slug]);

    // Keyboard nav for gallery
    useEffect(() => {
        if (!galleryOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setGalleryIndex(i => Math.min((project?.photos?.length ?? 1) - 1, i + 1));
            if (e.key === 'ArrowLeft')  setGalleryIndex(i => Math.max(0, i - 1));
            if (e.key === 'Escape')     setGalleryOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [galleryOpen, project?.photos?.length]);

    const photos      = useMemo(() => project?.photos || [], [project]);
    const price       = project?.listingPrice ? `$${Number(project.listingPrice).toLocaleString()}` : null;
    const location    = [project?.address, project?.city, project?.state, project?.zip].filter(Boolean).join(', ');
    const statusLabel = STATUS_LABEL[project?.listingStatus || 'active'] ?? 'For Sale';
    const statusColor = STATUS_COLOR[project?.listingStatus || 'active'] ?? C.emerald;

    // ── Shared inline styles ──────────────────────────────────────────────────
    const card: React.CSSProperties   = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 };
    const sLabel: React.CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.blue, fontWeight: 600, display: 'block', marginBottom: 8 };

    // ── Gate screens ──────────────────────────────────────────────────────────
    const GateScreen: React.FC<{ icon: React.ReactNode; title: string; message: string; action?: React.ReactNode }> = ({ icon, title, message, action }) => (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, sans-serif', padding: 24 }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h2>
            <p style={{ color: C.muted, fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>{message}</p>
            {action}
        </div>
    );

    if (notLoggedIn) return (
        <GateScreen
            icon={<Lock style={{ width: 28, height: 28, color: C.blue }} />}
            title="Sign in to view this listing"
            message="This property listing is private and only accessible to assigned team members and clients. Please log in to your Timely account to continue."
            action={
                <button
                    onClick={() => { window.location.href = '/'; }}
                    style={{ padding: '10px 24px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
                >
                    <LogIn style={{ width: 16, height: 16 }} /> Go to Login
                </button>
            }
        />
    );

    if (accessDenied) return (
        <GateScreen
            icon={<Lock style={{ width: 28, height: 28, color: '#f59e0b' }} />}
            title="Access restricted"
            message="You don't have access to this listing. Contact your agent or administrator if you believe this is an error."
            action={
                <button
                    onClick={() => window.history.back()}
                    style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.08)', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <ArrowLeft style={{ width: 14, height: 14 }} /> Go Back
                </button>
            }
        />
    );

    if (notFound) return (
        <GateScreen
            icon={<Globe style={{ width: 28, height: 28, opacity: 0.4 }} />}
            title="Listing not found"
            message="This listing may have been removed or the URL is incorrect."
            action={
                <button
                    onClick={() => window.history.back()}
                    style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.08)', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <ArrowLeft style={{ width: 14, height: 14 }} /> Go Back
                </button>
            }
        />
    );

    if (!project) return (
        <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, border: `3px solid rgba(255,255,255,0.1)`, borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    // ── Fullscreen gallery ────────────────────────────────────────────────────
    if (galleryOpen) return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <button onClick={() => setGalleryOpen(false)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <button onClick={() => setGalleryIndex(i => Math.max(0, i - 1))} disabled={galleryIndex === 0} style={{ position: 'absolute', left: 20, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: galleryIndex === 0 ? 'default' : 'pointer', opacity: galleryIndex === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft style={{ width: 24, height: 24 }} />
            </button>
            <button onClick={() => setGalleryIndex(i => Math.min(photos.length - 1, i + 1))} disabled={galleryIndex === photos.length - 1} style={{ position: 'absolute', right: 20, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: galleryIndex === photos.length - 1 ? 'default' : 'pointer', opacity: galleryIndex === photos.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight style={{ width: 24, height: 24 }} />
            </button>
            <img src={photos[galleryIndex]} alt="" style={{ maxWidth: '85vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }} />
            <p style={{ position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{galleryIndex + 1} / {photos.length}</p>
            <div style={{ position: 'absolute', bottom: 20, display: 'flex', gap: 8 }}>
                {photos.map((_, i) => (
                    <button key={i} onClick={() => setGalleryIndex(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: i === galleryIndex ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', padding: 0 }} />
                ))}
            </div>
        </div>
    );

    // ── Main page ─────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                * { box-sizing: border-box; }
                a { color: inherit; text-decoration: none; }
            `}</style>

            {/* ── Nav ──────────────────────────────────────────────────────── */}
            <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,12,18,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.border}`, padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} /> Back to Timely
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe style={{ width: 15, height: 15, color: C.blue }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Timely Real Estate</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 99, fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>
                    <Lock style={{ width: 11, height: 11 }} /> Private Listing
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div style={{ position: 'relative', height: 480, overflow: 'hidden' }}>
                {photos.length > 0 ? (
                    <img src={photos[activePhoto]} alt={project.projectName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #0d1b2e 0%, #1a3a5c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {project.propertyType === 'commercial'
                            ? <Building2 style={{ width: 80, height: 80, opacity: 0.06, color: 'white' }} strokeWidth={1} />
                            : <Home      style={{ width: 80, height: 80, opacity: 0.06, color: 'white' }} strokeWidth={1} />
                        }
                    </div>
                )}

                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,12,18,0.96) 0%, rgba(8,12,18,0.25) 50%, transparent 100%)' }} />

                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 40px' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, animation: 'fadeUp 0.5s ease' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <span style={{ padding: '5px 12px', background: statusColor, borderRadius: 99, fontSize: 12, fontWeight: 700, color: 'white' }}>{statusLabel}</span>
                                {project.propertyType && (
                                    <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.12)', borderRadius: 99, fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                                        {project.propertyType.replace('_', ' ')}
                                    </span>
                                )}
                            </div>
                            <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px', color: 'white', lineHeight: 1.2 }}>{project.projectName}</h1>
                            {location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                                    <MapPin style={{ width: 14, height: 14 }} />{location}
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            {price && <div style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1 }}>{price}</div>}
                            {project.sqft && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{Number(project.sqft).toLocaleString()} sqft</div>}
                        </div>
                    </div>
                </div>

                {photos.length > 1 && (
                    <button onClick={() => { setGalleryIndex(activePhoto); setGalleryOpen(true); }} style={{ position: 'absolute', bottom: 20, right: 40, padding: '8px 14px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, borderRadius: 8, color: 'white', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                        <Layers style={{ width: 13, height: 13 }} />View all {photos.length} photos
                    </button>
                )}
            </div>

            {/* ── Photo strip ──────────────────────────────────────────────── */}
            {photos.length > 1 && (
                <div style={{ background: '#0c1118', borderBottom: `1px solid ${C.border}`, padding: '10px 40px', display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {photos.map((photo, i) => (
                        <button key={i} onClick={() => setActivePhoto(i)} style={{ flexShrink: 0, width: 80, height: 56, borderRadius: 8, overflow: 'hidden', border: `2px solid ${i === activePhoto ? C.blue : 'transparent'}`, padding: 0, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                            <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                    ))}
                </div>
            )}

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 32, alignItems: 'start' }}>

                    {/* ── Left: Property details ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                        {(project.bedrooms || project.bathrooms || project.sqft || project.yearBuilt) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                                {project.bedrooms && (
                                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                                        <Bed style={{ width: 18, height: 18, color: C.blue, margin: '0 auto 6px' }} />
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{project.bedrooms}</div>
                                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Bedrooms</div>
                                    </div>
                                )}
                                {project.bathrooms && (
                                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                                        <Bath style={{ width: 18, height: 18, color: C.blue, margin: '0 auto 6px' }} />
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{project.bathrooms}</div>
                                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Bathrooms</div>
                                    </div>
                                )}
                                {project.sqft && (
                                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                                        <Maximize style={{ width: 18, height: 18, color: C.blue, margin: '0 auto 6px' }} />
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{Number(project.sqft).toLocaleString()}</div>
                                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Sq Feet</div>
                                    </div>
                                )}
                                {project.yearBuilt && (
                                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                                        <Calendar style={{ width: 18, height: 18, color: C.blue, margin: '0 auto 6px' }} />
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{project.yearBuilt}</div>
                                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Year Built</div>
                                    </div>
                                )}
                                {project.lotSize && (
                                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{project.lotSize}</div>
                                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Lot Size</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {project.description && (
                            <div style={card}>
                                <span style={sLabel}>About this property</span>
                                <p style={{ fontSize: 15, lineHeight: 1.75, color: '#cbd5e1', margin: 0 }}>{project.description}</p>
                            </div>
                        )}

                        {(project.propertyType || project.yearBuilt || project.lotSize || price) && (
                            <div style={card}>
                                <span style={sLabel}>Property Details</span>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginTop: 4 }}>
                                    {project.propertyType && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Tag style={{ width: 16, height: 16, color: C.blue, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</div>
                                                <div style={{ fontSize: 14, color: C.text, textTransform: 'capitalize' }}>{project.propertyType.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    )}
                                    {project.yearBuilt && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Calendar style={{ width: 16, height: 16, color: C.blue, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Built</div>
                                                <div style={{ fontSize: 14, color: C.text }}>{project.yearBuilt}</div>
                                            </div>
                                        </div>
                                    )}
                                    {project.lotSize && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Maximize style={{ width: 16, height: 16, color: C.blue, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lot Size</div>
                                                <div style={{ fontSize: 14, color: C.text }}>{project.lotSize}</div>
                                            </div>
                                        </div>
                                    )}
                                    {price && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <DollarSign style={{ width: 16, height: 16, color: C.blue, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</div>
                                                <div style={{ fontSize: 14, color: C.text }}>{price}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {project.amenities && project.amenities.length > 0 && (
                            <div style={card}>
                                <span style={sLabel}>Amenities & Features</span>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 4 }}>
                                    {project.amenities.map(a => (
                                        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 13, color: '#cbd5e1' }}>
                                            <span style={{ fontSize: 17 }}>{AMENITY_ICONS[a] || '✓'}</span>{a}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {location && (
                            <div style={card}>
                                <span style={sLabel}>Location</span>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 4 }}>
                                    <MapPin style={{ width: 18, height: 18, color: C.blue, flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        {project.address && <p style={{ margin: '0 0 3px', fontSize: 15, color: C.text, fontWeight: 500 }}>{project.address}</p>}
                                        {(project.city || project.state) && <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{[project.city, project.state, project.zip].filter(Boolean).join(', ')}</p>}
                                    </div>
                                </div>
                                <div style={{ marginTop: 16, height: 180, background: 'rgba(255,255,255,0.03)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${C.border}` }}>
                                    <div style={{ textAlign: 'center', color: C.dim }}>
                                        <MapPin style={{ width: 24, height: 24, marginBottom: 6, opacity: 0.4 }} />
                                        <p style={{ fontSize: 13, margin: 0 }}>Map coming soon</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: Project summary card (sticky) ── */}
                    <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>

                        <div style={card}>
                            <span style={sLabel}>Project Summary</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 13, color: C.muted }}>Listing Status</span>
                                    <span style={{ padding: '4px 10px', background: statusColor, borderRadius: 99, fontSize: 12, fontWeight: 700, color: 'white' }}>{statusLabel}</span>
                                </div>
                                {price && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: C.muted }}>Asking Price</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{price}</span>
                                    </div>
                                )}
                                {project.propertyType && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: C.muted }}>Property Type</span>
                                        <span style={{ fontSize: 13, color: C.text, textTransform: 'capitalize' }}>{project.propertyType.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {(project.bedrooms || project.bathrooms) && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: C.muted }}>Bed / Bath</span>
                                        <span style={{ fontSize: 13, color: C.text }}>
                                            {[project.bedrooms && `${project.bedrooms} bd`, project.bathrooms && `${project.bathrooms} ba`].filter(Boolean).join(' / ')}
                                        </span>
                                    </div>
                                )}
                                {project.sqft && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: C.muted }}>Square Feet</span>
                                        <span style={{ fontSize: 13, color: C.text }}>{Number(project.sqft).toLocaleString()}</span>
                                    </div>
                                )}
                                {(project.startDate || project.endDate) && (
                                    <>
                                        <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
                                        {project.startDate && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 13, color: C.muted }}>Project Start</span>
                                                <span style={{ fontSize: 13, color: C.text }}>{new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {project.endDate && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 13, color: C.muted }}>Target Close</span>
                                                <span style={{ fontSize: 13, color: C.text }}>{new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                {project.publishedAt && (
                                    <>
                                        <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, color: C.muted }}>Listed</span>
                                            <span style={{ fontSize: 13, color: C.text }}>{new Date(project.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ ...card, padding: 20 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>Have questions?</p>
                            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
                                Send a message to your assigned consultant directly through Timely.
                            </p>
                            <button
                                onClick={() => window.history.back()}
                                style={{ width: '100%', padding: '11px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                Open Messages in Timely
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12 }}>
                            <Lock style={{ width: 13, height: 13, color: '#93c5fd', flexShrink: 0, marginTop: 2 }} />
                            <p style={{ fontSize: 11, color: '#7dd3fc', margin: 0, lineHeight: 1.5 }}>
                                This listing is private and only visible to assigned team members. Do not share this URL with unassigned parties.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: '20px 40px', marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe style={{ width: 15, height: 15, color: C.blue }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Timely Real Estate</span>
                </div>
                <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>Private — for assigned team members only</p>
            </footer>
        </div>
    );
};

export default ListingView;