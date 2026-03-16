// src/ClientPortal_views/ClientProjects.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    FolderOpen, Calendar, MapPin, Bed, Bath, Maximize,
    ExternalLink, Globe, Search, X, RefreshCw, Filter,
    Clock, Home, Building2, ChevronRight, Lock, Tag,
} from "lucide-react";

import { getAssignedProjects } from "./Clientassignmentservice";

const API_BASE = "/api";

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) return null;
        return await r.json();
    } catch { return null; }
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    status: string;
    priority?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    dateDue?: string;
    budget?: string;
    createdAt?: string;
    clientName?: string;
    // Property fields
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    propertyType?: string;
    bedrooms?: string;
    bathrooms?: string;
    sqft?: string;
    lotSize?: string;
    yearBuilt?: string;
    amenities?: string[];
    photos?: string[];
    coverPhotoIndex?: number;
    // Listing fields
    isPublished?: boolean;
    listingSlug?: string;
    listingStatus?: string;
    listingPrice?: string;
    publishedAt?: string;
}

interface ClientProjectsProps {
    userName?: string;
    userEmail?: string;
    customerId?: string;
}

// ─── Cover helpers (matches projects.tsx palette) ─────────────────────────────

const COVER_GRADIENTS = [
    ["#0d1b2e", "#1a3a5c"], ["#111827", "#1e3a52"], ["#0f1f35", "#1c3554"],
    ["#0c1a2e", "#163050"], ["#13202f", "#1b3349"],
];
const COVER_ACCENTS = [
    "radial-gradient(circle at 20% 80%, rgba(59,130,246,0.25) 0%, transparent 60%)",
    "radial-gradient(circle at 80% 20%, rgba(59,130,246,0.2) 0%, transparent 55%)",
    "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.18) 0%, transparent 65%)",
];

const getCoverGradient = (pid: string): React.CSSProperties => {
    const hash   = pid.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const [f, t] = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
    const accent = COVER_ACCENTS[hash % COVER_ACCENTS.length];
    return { background: `${accent}, linear-gradient(145deg, ${f} 0%, ${t} 100%)` };
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientProjects: React.FC<ClientProjectsProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
        text:         isDark ? "text-white"         : "text-gray-900",
        secondary:    isDark ? "text-gray-300"      : "text-gray-600",
        tertiary:     isDark ? "text-gray-500"      : "text-gray-400",
        strong:       isDark ? "text-white"         : "text-black",
        label:        isDark ? "text-blue-400"      : "text-blue-600",
        link:         isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500",
        divider:      isDark ? "border-gray-800"    : "border-gray-200",
        modal:        isDark ? "bg-[#111111] border-gray-800" : "bg-[#e4e4e4] border-gray-300",
        modalHead:    isDark ? "bg-[#111111]"       : "bg-[#e4e4e4]",
        input:        isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
    };

    const [projects, setProjects]         = useState<Project[]>([]);
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [searchTerm, setSearchTerm]     = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showFilters, setShowFilters]   = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    useEffect(() => { loadProjects(); }, [customerId]);

    const loadProjects = async () => {
        setRefreshing(true);
        try {
            // Get assigned project IDs from AssignmentService localStorage
            // Use shared service — handles all formats, deduplicates
            const assigned = await getAssignedProjects(customerId) as Project[];
            setProjects(assigned);
        } catch (e) {
            console.error("Error loading projects:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filteredProjects = useMemo(() => {
        let list = projects;
        if (searchTerm) list = list.filter(p =>
            p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.projectCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.city || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (statusFilter !== "all") list = list.filter(p => p.status === statusFilter);
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [projects, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total:     projects.length,
        active:    projects.filter(p => p.status === "active" || p.status === "in_progress").length,
        completed: projects.filter(p => p.status === "completed").length,
        listed:    projects.filter(p => p.isPublished).length,
    }), [projects]);

    const formatDate = (d?: string) => d
        ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null;

    const formatPrice = (p?: string) => p ? `$${Number(p).toLocaleString()}` : null;

    const statusBadge = (status: string) => ({
        active:      "bg-emerald-500/10 text-emerald-500",
        in_progress: "bg-emerald-500/10 text-emerald-500",
        completed:   "bg-blue-500/10 text-blue-500",
        pending:     "bg-amber-500/10 text-amber-500",
        on_hold:     "bg-gray-500/10 text-gray-500",
        planning:    "bg-blue-500/10 text-blue-400",
        cancelled:   "bg-red-500/10 text-red-500",
    }[status] || "bg-emerald-500/10 text-emerald-500");

    const statusLabel = (status: string) => ({
        active: "In Progress", in_progress: "In Progress",
        completed: "Completed", pending: "Pending",
        on_hold: "On Hold", planning: "Planning", cancelled: "Cancelled",
    }[status] || "Active");

    const listingStatusColor = (s?: string): string => ({
        active:  "bg-emerald-600 text-white",
        pending: "bg-amber-600 text-white",
        sold:    "bg-gray-600 text-white",
    }[s || "active"] || "bg-emerald-600 text-white");

    const getListingUrl = (slug: string) => `${window.location.origin}/listing/${slug}`;

    // ── Project cover ─────────────────────────────────────────────────────────
    const ProjectCover: React.FC<{ p: Project; className?: string }> = ({ p, className = "" }) => {
        const src = p.photos && p.photos.length > 0 ? p.photos[p.coverPhotoIndex || 0] : null;
        return src ? (
            <img src={src} alt={p.projectName} className={`absolute inset-0 w-full h-full object-cover ${className}`} />
        ) : (
            <>
                <div className={`absolute inset-0 ${className}`} style={getCoverGradient(p.projectId)} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {p.propertyType === "commercial"
                        ? <Building2 className="w-16 h-16 opacity-[0.05] text-white" strokeWidth={1} />
                        : <Home      className="w-16 h-16 opacity-[0.05] text-white" strokeWidth={1} />
                    }
                </div>
            </>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="text-center">
                <RefreshCw className={`w-7 h-7 ${n.label} animate-spin mx-auto mb-3`} />
                <p className={`${n.secondary} text-sm`}>Loading your projects…</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>My Projects</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Properties and projects assigned to you</p>
                </div>
                <button onClick={loadProjects} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                    <RefreshCw className={`w-4 h-4 ${n.secondary} ${refreshing ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Total",     value: stats.total,     dot: "bg-blue-500" },
                    { label: "Active",    value: stats.active,    dot: "bg-emerald-500" },
                    { label: "Completed", value: stats.completed, dot: "bg-blue-500" },
                    { label: "Listings",  value: stats.listed,    dot: "bg-emerald-500" },
                ].map((st, i) => (
                    <div key={i} className={`${n.card} ${n.edgeHover} p-4 rounded-2xl transition-all`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                        </div>
                        <div className={`text-2xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                    </div>
                ))}
            </div>

            {/* Search + filter */}
            <div className="flex gap-3">
                <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5 rounded-xl`}>
                    <Search className={`w-4 h-4 ${n.tertiary} flex-shrink-0`} />
                    <input type="text" placeholder="Search by name, code, or city…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                    {searchTerm && <button onClick={() => setSearchTerm("")}><X className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>}
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters ? n.inset : n.flat} flex items-center justify-center rounded-xl`}>
                    <Filter className={`w-4 h-4 ${showFilters ? n.label : n.secondary}`} />
                </button>
            </div>

            {showFilters && (
                <div className={`${n.card} p-4 rounded-2xl`}>
                    <label className={`${n.tertiary} text-[11px] block mb-2 uppercase tracking-wider`}>Status</label>
                    <div className="flex flex-wrap gap-2">
                        {["all", "active", "in_progress", "completed", "pending", "on_hold"].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${statusFilter === s ? "bg-blue-600 text-white" : `${n.flat} ${n.secondary}`}`}>
                                {s === "all" ? "All" : statusLabel(s)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Project grid */}
            {filteredProjects.length === 0 ? (
                <div className={`${n.card} rounded-2xl text-center py-20`}>
                    <FolderOpen className={`w-12 h-12 ${n.tertiary} mx-auto mb-4`} strokeWidth={1.5} />
                    <p className={`${n.secondary} text-sm font-medium`}>
                        {projects.length === 0 ? "No projects assigned yet" : "No projects match your search"}
                    </p>
                    <p className={`${n.tertiary} text-xs mt-1`}>Your agent will assign projects to your account</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredProjects.map(p => {
                        const price    = formatPrice(p.listingPrice);
                        const location = [p.address, p.city, p.state].filter(Boolean).join(", ");

                        return (
                            <div key={p.projectId} className={`${n.card} rounded-2xl overflow-hidden ${n.edgeHover} transition-all flex flex-col`}>

                                {/* Cover */}
                                <div className="relative h-44 flex-shrink-0 overflow-hidden">
                                    <ProjectCover p={p} />

                                    {/* Status badge */}
                                    <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadge(p.status)} backdrop-blur-sm bg-black/30 !text-white`}>
                                        {statusLabel(p.status)}
                                    </div>

                                    {/* Listing badge */}
                                    {p.isPublished && (
                                        <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-semibold ${listingStatusColor(p.listingStatus)} flex items-center gap-1`}>
                                            <Globe className="w-2.5 h-2.5" />
                                            {p.listingStatus === "sold" ? "Sold" : p.listingStatus === "pending" ? "Pending" : "For Sale"}
                                        </div>
                                    )}

                                    {/* Price chip */}
                                    {price && (
                                        <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs font-bold">
                                            {price}
                                        </div>
                                    )}

                                    {/* Photo count chip */}
                                    {p.photos && p.photos.length > 0 && (
                                        <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/80 text-[11px] flex items-center gap-1">
                                            <Home className="w-3 h-3" />{p.photos.length} photos
                                        </div>
                                    )}

                                    <div className="absolute bottom-0 left-0 right-0 h-6" style={{ background: isDark ? "linear-gradient(to bottom, transparent, rgba(17,17,17,0.8))" : "linear-gradient(to bottom, transparent, rgba(228,228,228,0.7))" }} />
                                </div>

                                {/* Body */}
                                <div className="p-4 flex flex-col flex-1 gap-2.5">
                                    <div>
                                        <h3 className={`${n.strong} font-semibold text-[15px] leading-snug`}>{p.projectName}</h3>
                                        <p className={`${n.tertiary} text-[11px] font-mono mt-0.5`}>{p.projectCode}</p>
                                    </div>

                                    {location && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className={`w-3 h-3 ${n.tertiary} flex-shrink-0`} />
                                            <span className={`${n.secondary} text-xs truncate`}>{location}</span>
                                        </div>
                                    )}

                                    {(p.bedrooms || p.bathrooms || p.sqft) && (
                                        <div className={`flex items-center gap-3 text-[11px] ${n.tertiary}`}>
                                            {p.bedrooms  && <span className="flex items-center gap-1"><Bed      className="w-3 h-3" />{p.bedrooms} bd</span>}
                                            {p.bathrooms && <span className="flex items-center gap-1"><Bath     className="w-3 h-3" />{p.bathrooms} ba</span>}
                                            {p.sqft      && <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{Number(p.sqft).toLocaleString()} sqft</span>}
                                        </div>
                                    )}

                                    {p.propertyType && (
                                        <div className="flex items-center gap-1.5">
                                            <Tag className={`w-3 h-3 ${n.tertiary}`} />
                                            <span className={`${n.tertiary} text-xs capitalize`}>{p.propertyType.replace("_", " ")}</span>
                                        </div>
                                    )}

                                    {p.description && <p className={`${n.secondary} text-xs leading-relaxed line-clamp-2`}>{p.description}</p>}

                                    {(p.startDate || p.endDate || p.dateDue) && (
                                        <div className={`flex items-center gap-1.5 text-[11px] ${n.tertiary}`}>
                                            <Calendar className="w-3 h-3 flex-shrink-0" />
                                            <span>
                                                {p.startDate ? formatDate(p.startDate) : "—"}
                                                {(p.endDate || p.dateDue) && ` — ${formatDate(p.endDate || p.dateDue)}`}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex-1" />

                                    {/* Footer actions */}
                                    <div className={`flex items-center justify-between pt-3 border-t ${n.divider}`}>
                                        <button
                                            onClick={() => setSelectedProject(p)}
                                            className={`text-xs ${n.link} flex items-center gap-1`}
                                        >
                                            Details <ChevronRight className="w-3 h-3" />
                                        </button>

                                        {p.isPublished && p.listingSlug ? (
                                            <a
                                                href={getListingUrl(p.listingSlug)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-[11px] font-medium flex items-center gap-1.5`}
                                            >
                                                <Globe className="w-3 h-3" />View Listing
                                            </a>
                                        ) : (
                                            <div className={`flex items-center gap-1 text-[11px] ${n.tertiary}`}>
                                                <Lock className="w-3 h-3" />No listing yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Detail Modal ── */}
            {selectedProject && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto`}>

                        {/* Header with cover */}
                        <div className="relative h-52 flex-shrink-0 overflow-hidden rounded-t-2xl">
                            <ProjectCover p={selectedProject} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selectedProject.projectName}</h2>
                                    <p className="text-white/60 text-xs font-mono mt-0.5">{selectedProject.projectCode}</p>
                                </div>
                                <button onClick={() => setSelectedProject(null)} className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>
                            {selectedProject.isPublished && (
                                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${listingStatusColor(selectedProject.listingStatus)} flex items-center gap-1`}>
                                    <Globe className="w-2.5 h-2.5" />
                                    {selectedProject.listingStatus === "sold" ? "Sold" : selectedProject.listingStatus === "pending" ? "Pending" : "For Sale"}
                                </div>
                            )}
                        </div>

                        <div className="p-5 space-y-5">

                            {/* Status + price */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${statusBadge(selectedProject.status)}`}>
                                    {statusLabel(selectedProject.status)}
                                </span>
                                {selectedProject.listingPrice && (
                                    <span className={`text-xl font-bold ${n.strong}`}>{formatPrice(selectedProject.listingPrice)}</span>
                                )}
                            </div>

                            {/* Property stats */}
                            {(selectedProject.bedrooms || selectedProject.bathrooms || selectedProject.sqft || selectedProject.yearBuilt) && (
                                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3`}>
                                    {selectedProject.bedrooms && (
                                        <div className={`${n.flat} p-3 rounded-xl text-center`}>
                                            <Bed className={`w-4 h-4 ${n.label} mx-auto mb-1`} />
                                            <p className={`font-semibold ${n.strong}`}>{selectedProject.bedrooms}</p>
                                            <p className={`text-[10px] ${n.tertiary}`}>Bedrooms</p>
                                        </div>
                                    )}
                                    {selectedProject.bathrooms && (
                                        <div className={`${n.flat} p-3 rounded-xl text-center`}>
                                            <Bath className={`w-4 h-4 ${n.label} mx-auto mb-1`} />
                                            <p className={`font-semibold ${n.strong}`}>{selectedProject.bathrooms}</p>
                                            <p className={`text-[10px] ${n.tertiary}`}>Bathrooms</p>
                                        </div>
                                    )}
                                    {selectedProject.sqft && (
                                        <div className={`${n.flat} p-3 rounded-xl text-center`}>
                                            <Maximize className={`w-4 h-4 ${n.label} mx-auto mb-1`} />
                                            <p className={`font-semibold ${n.strong}`}>{Number(selectedProject.sqft).toLocaleString()}</p>
                                            <p className={`text-[10px] ${n.tertiary}`}>Sq Ft</p>
                                        </div>
                                    )}
                                    {selectedProject.yearBuilt && (
                                        <div className={`${n.flat} p-3 rounded-xl text-center`}>
                                            <Clock className={`w-4 h-4 ${n.label} mx-auto mb-1`} />
                                            <p className={`font-semibold ${n.strong}`}>{selectedProject.yearBuilt}</p>
                                            <p className={`text-[10px] ${n.tertiary}`}>Year Built</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Address */}
                            {(selectedProject.address || selectedProject.city) && (
                                <div className={`${n.flat} p-4 rounded-xl flex items-start gap-3`}>
                                    <MapPin className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                                    <div>
                                        {selectedProject.address && <p className={`${n.text} text-sm font-medium`}>{selectedProject.address}</p>}
                                        <p className={`${n.secondary} text-xs`}>{[selectedProject.city, selectedProject.state, selectedProject.zip].filter(Boolean).join(", ")}</p>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {selectedProject.description && (
                                <div>
                                    <p className={`${n.label} text-[11px] uppercase tracking-wider mb-2`}>Description</p>
                                    <p className={`${n.secondary} text-sm leading-relaxed`}>{selectedProject.description}</p>
                                </div>
                            )}

                            {/* Amenities */}
                            {selectedProject.amenities && selectedProject.amenities.length > 0 && (
                                <div>
                                    <p className={`${n.label} text-[11px] uppercase tracking-wider mb-2`}>Amenities</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedProject.amenities.map(a => (
                                            <span key={a} className={`px-2.5 py-1 ${n.flat} rounded-lg text-xs ${n.secondary}`}>{a}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            {(selectedProject.startDate || selectedProject.endDate) && (
                                <div className={`${n.flat} p-4 rounded-xl`}>
                                    <p className={`${n.label} text-[11px] uppercase tracking-wider mb-3`}>Timeline</p>
                                    <div className="flex gap-8">
                                        {selectedProject.startDate && (
                                            <div><p className={`${n.tertiary} text-[10px]`}>Start</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.startDate)}</p></div>
                                        )}
                                        {selectedProject.endDate && (
                                            <div><p className={`${n.tertiary} text-[10px]`}>Target Close</p><p className={`${n.text} text-sm`}>{formatDate(selectedProject.endDate)}</p></div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Photo gallery strip */}
                            {selectedProject.photos && selectedProject.photos.length > 1 && (
                                <div>
                                    <p className={`${n.label} text-[11px] uppercase tracking-wider mb-2`}>Photos</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {selectedProject.photos.map((photo, i) => (
                                            <div key={i} className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0">
                                                <img src={photo} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CTA */}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setSelectedProject(null)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>
                                    Close
                                </button>
                                {selectedProject.isPublished && selectedProject.listingSlug ? (
                                    <a
                                        href={getListingUrl(selectedProject.listingSlug)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}
                                    >
                                        <Globe className="w-4 h-4" />View Full Listing
                                    </a>
                                ) : (
                                    <div className={`flex-1 px-4 py-2.5 ${n.flat} rounded-xl text-sm flex items-center justify-center gap-2 ${n.tertiary}`}>
                                        <Lock className="w-4 h-4" />Listing not available yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientProjects;