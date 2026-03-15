// src/Tabs/Listings.tsx
import React, { useState, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import {
    Globe, EyeOff, MapPin, Bed, Bath, Maximize, Send, Search,
    ExternalLink, Copy, CheckCircle, AlertCircle, X, Info,
    Trash2, Eye, Filter, RefreshCw, Home, Building2, Image
} from 'lucide-react';
import ListingService, { Inquiry } from '../services/ListingService';

const STORAGE_KEY = 'timely_projects';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Project {
    projectId: string; projectCode: string; projectName: string;
    clientName?: string; description?: string; status?: string;
    address?: string; city?: string; state?: string; zip?: string;
    propertyType?: string; bedrooms?: string; bathrooms?: string;
    sqft?: string; amenities?: string[]; photos?: string[]; coverPhotoIndex?: number;
    listingPrice?: string; listingStatus?: string;
    isPublished?: boolean; publishedAt?: string; listingSlug?: string;
    budget?: string; createdAt?: string;
}

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

// ─── Cover helpers ────────────────────────────────────────────────────────────

const COVER_GRADIENTS = [
    ['#0d1b2e', '#1a3a5c'], ['#111827', '#1e3a52'], ['#0f1f35', '#1c3554'],
    ['#0c1a2e', '#163050'], ['#13202f', '#1b3349'],
];
const COVER_ACCENTS = [
    'radial-gradient(circle at 20% 80%, rgba(59,130,246,0.25) 0%, transparent 60%)',
    'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.2) 0%, transparent 55%)',
    'radial-gradient(circle at 50% 50%, rgba(37,99,235,0.18) 0%, transparent 65%)',
];
const getCoverGradient = (pid: string): React.CSSProperties => {
    const hash = pid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const [from, to] = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
    const accent     = COVER_ACCENTS[hash % COVER_ACCENTS.length];
    return { background: `${accent}, linear-gradient(145deg, ${from} 0%, ${to} 100%)` };
};

// ─── Component ────────────────────────────────────────────────────────────────

const Listings: React.FC = () => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? 'neu-bg-dark'       : 'neu-bg-light',
        card:         isDark ? 'neu-dark'           : 'neu-light',
        flat:         isDark ? 'neu-dark-flat'      : 'neu-light-flat',
        inset:        isDark ? 'neu-dark-inset'     : 'neu-light-inset',
        text:         isDark ? 'text-white'         : 'text-gray-900',
        secondary:    isDark ? 'text-gray-300'      : 'text-gray-600',
        tertiary:     isDark ? 'text-gray-500'      : 'text-gray-400',
        strong:       isDark ? 'text-white'         : 'text-black',
        label:        isDark ? 'text-blue-400'      : 'text-blue-600',
        link:         isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500',
        input:        isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border-gray-300 text-gray-900',
        modal:        isDark ? 'bg-[#111111] border-gray-800' : 'bg-[#e4e4e4] border-gray-300',
        modalHead:    isDark ? 'bg-[#111111]'       : 'bg-[#e4e4e4]',
        btnPrimary:   'bg-blue-600 hover:bg-blue-500 text-white',
        btnSecondary: isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        divider:      isDark ? 'border-gray-800'    : 'border-gray-200',
        edgeHover: isDark
            ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]'
            : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
    };

    const [toasts, setToasts]             = useState<Toast[]>([]);
    const [searchTerm, setSearchTerm]     = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters]   = useState(false);
    const [refreshKey, setRefreshKey]     = useState(0);
    const [inqRefreshKey, setInqRefreshKey] = useState(0);
    const [selectedListing, setSelectedListing] = useState<Project | null>(null);
    const [showInquiries, setShowInquiries]     = useState(false);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    // Read all published projects from localStorage
    const allProjects: Project[] = useMemo(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    const publishedListings = useMemo(() => {
        let listings = allProjects.filter(p => p.isPublished);
        if (searchTerm) {
            listings = listings.filter(p =>
                p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.city    || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.address || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (statusFilter !== 'all') listings = listings.filter(p => (p.listingStatus || 'active') === statusFilter);
        return listings.sort((a, b) =>
            new Date(b.publishedAt || b.createdAt || 0).getTime() -
            new Date(a.publishedAt || a.createdAt || 0).getTime()
        );
    }, [allProjects, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total:     publishedListings.length,
        active:    publishedListings.filter(p => (p.listingStatus || 'active') === 'active').length,
        pending:   publishedListings.filter(p => p.listingStatus === 'pending').length,
        sold:      publishedListings.filter(p => p.listingStatus === 'sold').length,
        inquiries: ListingService.getTotalCount(),
        unread:    ListingService.getUnreadCount(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [publishedListings, inqRefreshKey]);

    // ─── Mutations ────────────────────────────────────────────────────────────
    const setListingStatus = (project: Project, newStatus: string) => {
        try {
            const local: Project[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const idx = local.findIndex(p => p.projectId === project.projectId);
            if (idx !== -1) {
                local[idx] = { ...local[idx], listingStatus: newStatus };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
                setRefreshKey(k => k + 1);
                showToast(`Marked as ${newStatus}`, 'success');
            }
        } catch { showToast('Failed to update', 'error'); }
    };

    const unpublish = (project: Project) => {
        try {
            const local: Project[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const idx = local.findIndex(p => p.projectId === project.projectId);
            if (idx !== -1) {
                local[idx] = { ...local[idx], isPublished: false };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
                setRefreshKey(k => k + 1);
                if (selectedListing?.projectId === project.projectId) setSelectedListing(null);
                showToast('Listing unpublished', 'info');
            }
        } catch { showToast('Failed to unpublish', 'error'); }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getPublicUrl = (slug: string) => `${window.location.origin}/listing/${slug}`;
    const formatPrice  = (p?: string) => p ? `$${Number(p).toLocaleString()}` : null;

    const listingStatusColor = (s?: string): string => ({
        active:  'bg-emerald-600 text-white',
        pending: 'bg-amber-600 text-white',
        sold:    'bg-gray-600 text-white',
    }[s || 'active'] || 'bg-emerald-600 text-white');

    const ProjectCover: React.FC<{ p: Project }> = ({ p }) => {
        const src = p.photos && p.photos.length > 0 ? p.photos[p.coverPhotoIndex || 0] : null;
        if (src) return <img src={src} alt={p.projectName} className="absolute inset-0 w-full h-full object-cover" />;
        return (
            <div className="absolute inset-0 flex items-center justify-center" style={getCoverGradient(p.projectId)}>
                {p.propertyType === 'commercial'
                    ? <Building2 className="w-20 h-20 opacity-[0.05] text-white" strokeWidth={1} />
                    : <Home      className="w-20 h-20 opacity-[0.05] text-white" strokeWidth={1} />
                }
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm`}>
                        {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* Inquiries Modal */}
            {showInquiries && selectedListing && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between flex-shrink-0 ${n.modalHead}`}>
                            <div>
                                <h2 className={`text-lg font-semibold ${n.text}`}>Inquiries</h2>
                                <p className={`text-xs ${n.tertiary}`}>{selectedListing.projectName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {ListingService.getUnreadCount(selectedListing.projectId) > 0 && (
                                    <button onClick={() => { ListingService.markAllReadForProject(selectedListing.projectId); setInqRefreshKey(k => k + 1); }} className={`text-xs ${n.link}`}>
                                        Mark all read
                                    </button>
                                )}
                                <button onClick={() => setShowInquiries(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}>
                                    <X className={`w-4 h-4 ${n.tertiary}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {ListingService.getInquiriesForProject(selectedListing.projectId).length === 0 ? (
                                <div className={`${n.flat} rounded-2xl p-10 text-center`}>
                                    <Send className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                    <p className={`${n.secondary} text-sm`}>No inquiries for this listing yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {ListingService.getInquiriesForProject(selectedListing.projectId).map((inq: Inquiry) => (
                                        <div key={inq.id} className={`${n.flat} p-4 rounded-xl ${!inq.read ? 'border-l-2 border-blue-500' : ''}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className={`${n.text} font-semibold text-sm`}>{inq.name}</p>
                                                        {!inq.read && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white">New</span>}
                                                    </div>
                                                    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${n.tertiary} text-xs mb-2`}>
                                                        <span>{inq.email}</span>
                                                        {inq.phone && <span>{inq.phone}</span>}
                                                        <span>{new Date(inq.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className={`${n.secondary} text-sm leading-relaxed`}>{inq.message}</p>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    {!inq.read && (
                                                        <button onClick={() => { ListingService.markRead(inq.id); setInqRefreshKey(k => k + 1); }} className={`p-1.5 ${n.flat} rounded-lg`} title="Mark read">
                                                            <Eye className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => { ListingService.deleteInquiry(inq.id); setInqRefreshKey(k => k + 1); }} className="p-1.5 hover:bg-red-500/20 rounded-lg">
                                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main page */}
            <div className="max-w-7xl mx-auto px-6 py-8">

                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Listings</h1>
                        <p className={`text-sm ${n.secondary}`}>Published properties visible to the public</p>
                    </div>
                    <button onClick={() => setRefreshKey(k => k + 1)} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                        <RefreshCw className={`w-4 h-4 ${n.secondary}`} />
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    {[
                        { label: 'Published', value: stats.total,     dot: 'bg-blue-500' },
                        { label: 'Active',    value: stats.active,    dot: 'bg-emerald-500' },
                        { label: 'Pending',   value: stats.pending,   dot: 'bg-amber-500' },
                        { label: 'Sold',      value: stats.sold,      dot: 'bg-gray-500' },
                        { label: 'Inquiries', value: stats.inquiries, dot: 'bg-blue-500', badge: stats.unread > 0 ? stats.unread : undefined },
                    ].map((st, i) => (
                        <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all rounded-2xl`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                                {st.badge && <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white">{st.badge} new</span>}
                            </div>
                            <div className={`text-2xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                        </div>
                    ))}
                </div>

                {/* Search + filter */}
                <div className="flex gap-3 items-center mb-4">
                    <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5 rounded-xl`}>
                        <Search className={`w-4 h-4 ${n.tertiary} flex-shrink-0`} />
                        <input type="text" placeholder="Search by name, city, or address…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        {searchTerm && <button onClick={() => setSearchTerm('')}><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                        <Filter className={`w-4 h-4 ${n.secondary}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className={`${n.card} p-4 mb-6 rounded-2xl`}>
                        <label className={`${n.tertiary} text-[11px] block mb-2 uppercase tracking-wider`}>Listing Status</label>
                        <div className="flex gap-2">
                            {['all', 'active', 'pending', 'sold'].map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${statusFilter === s ? 'bg-blue-600 text-white' : `${n.flat} ${n.secondary}`}`}>
                                    {s === 'all' ? 'All' : s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {publishedListings.length === 0 ? (
                    <div className={`${n.card} rounded-2xl text-center py-20`}>
                        <Globe className={`w-12 h-12 ${n.tertiary} mx-auto mb-4`} strokeWidth={1.5} />
                        <p className={`${n.secondary} text-sm font-medium`}>No published listings yet</p>
                        <p className={`${n.tertiary} text-xs mt-1`}>Open a project → Listing tab → toggle Publish</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {publishedListings.map(p => {
                            const inquiryCount = ListingService.getTotalCount(p.projectId);
                            const unreadCount  = ListingService.getUnreadCount(p.projectId);
                            const price        = formatPrice(p.listingPrice);
                            const hasPhotos    = p.photos && p.photos.length > 0;

                            return (
                                <div key={p.projectId} className={`${n.card} rounded-2xl overflow-hidden group transition-all duration-200 ${n.edgeHover} flex flex-col`}>

                                    {/* Cover */}
                                    <div className="relative h-48 flex-shrink-0 overflow-hidden">
                                        <ProjectCover p={p} />

                                        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${listingStatusColor(p.listingStatus)}`}>
                                            {(p.listingStatus || 'active').charAt(0).toUpperCase() + (p.listingStatus || 'active').slice(1)}
                                        </div>

                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => unpublish(p)} className="px-2.5 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg text-[11px] text-white flex items-center gap-1">
                                                <EyeOff className="w-3 h-3" />Unpublish
                                            </button>
                                        </div>

                                        {price && (
                                            <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-sm font-bold">
                                                {price}
                                            </div>
                                        )}

                                        {hasPhotos && (
                                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/80 text-[11px] flex items-center gap-1">
                                                <Image className="w-3 h-3" />{p.photos!.length}
                                            </div>
                                        )}

                                        <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: isDark ? 'linear-gradient(to bottom, transparent, rgba(17,17,17,0.9))' : 'linear-gradient(to bottom, transparent, rgba(228,228,228,0.8))' }} />
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 flex flex-col flex-1 gap-2.5">
                                        <div>
                                            <h3 className={`${n.strong} font-semibold text-[15px] leading-snug`}>{p.projectName}</h3>
                                            {(p.city || p.address) && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <MapPin className={`w-3 h-3 ${n.tertiary}`} />
                                                    <p className={`${n.tertiary} text-xs truncate`}>{[p.address, p.city, p.state].filter(Boolean).join(', ')}</p>
                                                </div>
                                            )}
                                        </div>

                                        {(p.bedrooms || p.bathrooms || p.sqft) && (
                                            <div className={`flex items-center gap-4 text-xs ${n.secondary}`}>
                                                {p.bedrooms  && <span className="flex items-center gap-1"><Bed      className="w-3.5 h-3.5" />{p.bedrooms} bd</span>}
                                                {p.bathrooms && <span className="flex items-center gap-1"><Bath     className="w-3.5 h-3.5" />{p.bathrooms} ba</span>}
                                                {p.sqft      && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{Number(p.sqft).toLocaleString()} sqft</span>}
                                            </div>
                                        )}

                                        {inquiryCount > 0 && (
                                            <div className={`flex items-center gap-1.5 text-xs ${n.label}`}>
                                                <Send className="w-3.5 h-3.5" />
                                                {inquiryCount} {inquiryCount === 1 ? 'inquiry' : 'inquiries'}
                                                {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white">{unreadCount} new</span>}
                                            </div>
                                        )}

                                        {p.publishedAt && (
                                            <p className={`text-[11px] ${n.tertiary}`}>Published {new Date(p.publishedAt).toLocaleDateString()}</p>
                                        )}

                                        <div className="flex-1" />

                                        {/* Quick status toggle */}
                                        <div className="flex gap-1.5">
                                            {(['active', 'pending', 'sold'] as const).map(s => (
                                                <button key={s} onClick={() => setListingStatus(p, s)} className={`flex-1 py-1.5 rounded-lg text-[11px] capitalize transition-all ${(p.listingStatus || 'active') === s ? listingStatusColor(s) : `${n.flat} ${n.secondary}`}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Footer */}
                                        <div className={`flex items-center justify-between pt-3 border-t ${n.divider}`}>
                                            <div className="flex items-center gap-1.5">
                                                {p.listingSlug && (
                                                    <>
                                                        <button onClick={() => { navigator.clipboard.writeText(getPublicUrl(p.listingSlug!)); showToast('URL copied!', 'success'); }} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center`} title="Copy URL">
                                                            <Copy className={`w-3 h-3 ${n.tertiary}`} />
                                                        </button>
                                                        <a href={`/listing/${p.listingSlug}`} target="_blank" rel="noreferrer" className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center`} title="View listing">
                                                            <ExternalLink className={`w-3 h-3 ${n.label}`} />
                                                        </a>
                                                    </>
                                                )}
                                                {inquiryCount > 0 && (
                                                    <button onClick={() => { setSelectedListing(p); setShowInquiries(true); }} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center relative`} title="View inquiries">
                                                        <Send className={`w-3 h-3 ${unreadCount > 0 ? 'text-blue-400' : n.tertiary}`} />
                                                        {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />}
                                                    </button>
                                                )}
                                            </div>
                                            <button onClick={() => unpublish(p)} className={`px-3 py-1.5 ${n.flat} rounded-lg text-[11px] ${n.secondary} flex items-center gap-1 hover:text-red-400 transition-colors`}>
                                                <EyeOff className="w-3 h-3" />Unpublish
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Listings;