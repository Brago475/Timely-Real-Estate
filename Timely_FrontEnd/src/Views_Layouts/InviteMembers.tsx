// src/Views_Layouts/InviteMembers.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "./ThemeContext";
import { UserPlus, Send, Copy, Trash2, CheckCircle, AlertCircle, Info, X, Clock, Users, Briefcase, User, RefreshCw, Mail, Link2 } from "lucide-react";

interface Invite { id: string; email: string; role: "consultant" | "client"; status: "pending" | "accepted" | "expired"; createdAt: string; expiresAt: string; acceptedAt?: string; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const STORAGE_KEY = "timely_invites";
const genId = () => `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const genToken = () => Math.random().toString(36).substr(2, 12) + Math.random().toString(36).substr(2, 12);

const getInvites = (): Invite[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
const saveInvites = (invites: Invite[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(invites));

const relTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`; const days = Math.floor(diff / 86400000);
    if (days === 1) return "Yesterday"; if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const InviteMembers: React.FC = () => {
    const { isDark } = useTheme();

    const n = {
        card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400",
        strong: isDark ? "text-white" : "text-black",
        label: isDark ? "text-blue-400" : "text-blue-600",
        input: isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        btnDanger: "bg-red-600 hover:bg-red-500 text-white",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHover: isDark ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]" : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
        edgeHoverFlat: isDark ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]" : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]",
    };

    const [invites, setInvites] = useState<Invite[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"consultant" | "client">("consultant");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "expired">("all");
    const [searchQ, setSearchQ] = useState("");

    useEffect(() => { setInvites(getInvites()); }, []);

    // Check for expired invites
    useEffect(() => {
        const now = Date.now();
        let changed = false;
        const updated = invites.map(inv => {
            if (inv.status === "pending" && new Date(inv.expiresAt).getTime() < now) {
                changed = true;
                return { ...inv, status: "expired" as const };
            }
            return inv;
        });
        if (changed) { setInvites(updated); saveInvites(updated); }
    }, [invites]);

    const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
        const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const stats = useMemo(() => ({
        total: invites.length,
        pending: invites.filter(i => i.status === "pending").length,
        accepted: invites.filter(i => i.status === "accepted").length,
        expired: invites.filter(i => i.status === "expired").length,
    }), [invites]);

    const filtered = useMemo(() => {
        let r = invites;
        if (filter !== "all") r = r.filter(i => i.status === filter);
        if (searchQ.trim()) { const q = searchQ.toLowerCase(); r = r.filter(i => i.email.toLowerCase().includes(q)); }
        return r.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [invites, filter, searchQ]);

    const sendInvite = () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) { showToast("Enter an email address", "error"); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { showToast("Invalid email format", "error"); return; }
        if (invites.some(i => i.email === trimmed && i.status === "pending")) { showToast("This email already has a pending invite", "error"); return; }

        const token = genToken();
        const inviteLink = `https://timely.app/invite/${token}`;
        const now = new Date();
        const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

        const newInvite: Invite = {
            id: genId(), email: trimmed, role, status: "pending",
            createdAt: now.toISOString(), expiresAt: expires.toISOString(),
        };

        const updated = [newInvite, ...invites];
        setInvites(updated); saveInvites(updated);

        // Get admin info
        let adminName = "Admin";
        try { const u = JSON.parse(localStorage.getItem("timely_user") || "{}"); if (u.name) adminName = u.name; } catch {}

        // Open mailto
        const roleLabel = role === "consultant" ? "Consultant" : "Client";
        const subject = `You're invited to join Timely Real Estate`;
        const body = [
            `Hi,`, ``,
            `${adminName} has invited you to join Timely Real Estate as a ${roleLabel}.`, ``,
            `Click the link below to create your account:`,
            inviteLink, ``,
            `This invitation expires in 48 hours.`, ``,
            `Best regards,`,
            `Timely Real Estate`
        ].join("\n");

        window.location.href = `mailto:${encodeURIComponent(trimmed)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        setEmail("");
        showToast(`Invite sent to ${trimmed}`);
    };

    const copyLink = (inv: Invite) => {
        const link = `https://timely.app/invite/${inv.id}`;
        navigator.clipboard.writeText(link).then(
            () => showToast("Invite link copied"),
            () => showToast("Could not copy", "error")
        );
    };

    const resendInvite = (inv: Invite) => {
        const now = new Date();
        const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const updated = invites.map(i => i.id === inv.id ? { ...i, status: "pending" as const, expiresAt: expires.toISOString() } : i);
        setInvites(updated); saveInvites(updated);

        let adminName = "Admin";
        try { const u = JSON.parse(localStorage.getItem("timely_user") || "{}"); if (u.name) adminName = u.name; } catch {}

        const roleLabel = inv.role === "consultant" ? "Consultant" : "Client";
        const subject = `Reminder: You're invited to join Timely Real Estate`;
        const body = [
            `Hi,`, ``,
            `This is a reminder that ${adminName} has invited you to join Timely Real Estate as a ${roleLabel}.`, ``,
            `Click the link below to create your account:`,
            `https://timely.app/invite/${inv.id}`, ``,
            `This invitation expires in 48 hours.`, ``,
            `Best regards,`,
            `Timely Real Estate`
        ].join("\n");

        window.location.href = `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        showToast(`Invite resent to ${inv.email}`);
    };

    const deleteInvite = (id: string) => {
        const updated = invites.filter(i => i.id !== id);
        setInvites(updated); saveInvites(updated);
        showToast("Invite removed");
    };

    const statusBadge = (s: string) => {
        if (s === "pending") return "bg-amber-500/20 text-amber-400";
        if (s === "accepted") return "bg-emerald-500/20 text-emerald-400";
        return "bg-red-500/20 text-red-400";
    };

    const roleBadge = (r: string) => r === "consultant" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400";

    return (
        <div className="space-y-8">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div>
                <h2 className={`text-lg font-semibold ${n.strong}`}>Invite Team Members</h2>
                <p className={`text-sm ${n.secondary}`}>Send invitations for consultants and clients to create their own accounts</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { l: "Total", v: stats.total, icon: Users, c: "" },
                    { l: "Pending", v: stats.pending, icon: Clock, c: "text-amber-400" },
                    { l: "Accepted", v: stats.accepted, icon: CheckCircle, c: "text-emerald-400" },
                    { l: "Expired", v: stats.expired, icon: AlertCircle, c: "text-red-400" },
                ].map((s, i) => (
                    <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                        <div className="flex items-center justify-between">
                            <s.icon className={`w-4 h-4 ${s.c || n.tertiary}`} />
                            <span className={`text-xl font-semibold ${s.c || n.strong}`}>{s.v}</span>
                        </div>
                        <p className={`text-[11px] ${n.tertiary} mt-1`}>{s.l}</p>
                    </div>
                ))}
            </div>

            {/* Invite Form */}
            <div className={`${n.card} p-6`}>
                <h3 className={`text-sm font-semibold ${n.strong} mb-4 flex items-center gap-2`}>
                    <UserPlus className={`w-4 h-4 ${n.label}`} />Send New Invite
                </h3>

                <div className="space-y-4">
                    {/* Role Selection */}
                    <div>
                        <label className={`${n.label} text-[11px] uppercase tracking-wider block mb-2`}>Role</label>
                        <div className={`${n.flat} p-0.5 flex rounded-xl w-fit`}>
                            <button onClick={() => setRole("consultant")} className={`px-5 py-2.5 text-sm rounded-xl transition-all flex items-center gap-2 ${role === "consultant" ? n.btnPrimary : n.secondary}`}>
                                <Briefcase className="w-3.5 h-3.5" />Consultant
                            </button>
                            <button onClick={() => setRole("client")} className={`px-5 py-2.5 text-sm rounded-xl transition-all flex items-center gap-2 ${role === "client" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : n.secondary}`}>
                                <User className="w-3.5 h-3.5" />Client
                            </button>
                        </div>
                    </div>

                    {/* Email + Send */}
                    <div>
                        <label className={`${n.label} text-[11px] uppercase tracking-wider block mb-2`}>Email Address</label>
                        <div className="flex gap-3">
                            <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                                <Mail className={`w-4 h-4 ${n.tertiary}`} />
                                <input type="email" placeholder="colleague@company.com" value={email} onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") sendInvite(); }}
                                    className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                            </div>
                            <button onClick={sendInvite} className={`${n.btnPrimary} px-6 py-2.5 rounded-xl text-sm flex items-center gap-2`}>
                                <Send className="w-3.5 h-3.5" />Send Invite
                            </button>
                        </div>
                        <p className={`${n.tertiary} text-[11px] mt-2`}>They'll receive an email with a link to create their account. Invites expire after 48 hours.</p>
                    </div>
                </div>
            </div>

            {/* Filters + Search */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className={`${n.card} p-0.5 flex rounded-xl w-fit`}>
                    {(["all", "pending", "accepted", "expired"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-sm rounded-xl transition-all capitalize ${filter === f ? n.btnPrimary : n.secondary}`}>
                            {f}
                        </button>
                    ))}
                </div>
                <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                    <Users className={`w-4 h-4 ${n.tertiary}`} />
                    <input type="text" placeholder="Search by email..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                </div>
            </div>

            {/* Invites List */}
            <div className={`${n.card} p-1.5 space-y-1.5`}>
                {/* Header */}
                <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}>
                    <div className={`col-span-4 text-[11px] uppercase tracking-wider ${n.label}`}>Email</div>
                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.label}`}>Role</div>
                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.label}`}>Status</div>
                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.label}`}>Sent</div>
                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.label} text-right`}>Actions</div>
                </div>

                {filtered.length === 0 ? (
                    <div className={`${n.flat} text-center py-12`}>
                        <UserPlus className={`w-8 h-8 ${n.tertiary} mx-auto mb-2 opacity-30`} />
                        <p className={`text-sm ${n.secondary}`}>{filter === "all" ? "No invites sent yet" : `No ${filter} invites`}</p>
                    </div>
                ) : filtered.map(inv => (
                    <div key={inv.id} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                        <div className="col-span-4 flex items-center gap-3">
                            <div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>
                                {inv.email[0].toUpperCase()}
                            </div>
                            <span className={`${n.text} text-sm truncate`}>{inv.email}</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${roleBadge(inv.role)}`}>{inv.role}</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${statusBadge(inv.status)}`}>{inv.status}</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                            <span className={`${n.tertiary} text-xs`}>{relTime(inv.createdAt)}</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                            <button onClick={() => copyLink(inv)} className={`p-1.5 ${n.flat} rounded-lg`} title="Copy link">
                                <Link2 className={`w-3.5 h-3.5 ${n.secondary}`} />
                            </button>
                            {inv.status !== "accepted" && (
                                <button onClick={() => resendInvite(inv)} className={`p-1.5 ${n.flat} rounded-lg`} title="Resend">
                                    <RefreshCw className={`w-3.5 h-3.5 ${n.secondary}`} />
                                </button>
                            )}
                            <button onClick={() => deleteInvite(inv.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg" title="Delete">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InviteMembers;