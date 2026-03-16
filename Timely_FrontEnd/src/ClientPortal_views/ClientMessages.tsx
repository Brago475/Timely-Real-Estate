// src/ClientPortal_views/ClientMessages.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    MessageCircle, Send, Search, Star, Trash2, Archive, X,
    RefreshCw, CheckCheck, Reply, AlertCircle, CheckCircle,
    Plus, Users, Shield, Briefcase, Info, Clock, Inbox,
    ChevronLeft, Mail,
} from "lucide-react";

const API_BASE = "/api";
const STORAGE_KEY = "timely_client_messages";
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientMessagesProps = { userName?: string; userEmail?: string; customerId?: string; };
type ViewType = "inbox" | "starred" | "archived" | "trash";

interface MsgFrom { name: string; email: string; role: "client" | "consultant" | "admin" | "system" | "support"; id?: string; }
interface MsgTo   { name: string; email: string; role?: string; id?: string; }

interface Message {
    id: string; threadId: string;
    from: MsgFrom; to: MsgTo;
    subject: string; body: string; timestamp: string;
    read: boolean; starred: boolean; archived: boolean; deleted: boolean;
    replyTo?: string;
}

interface Thread {
    id: string; subject: string;
    lastMessage: string; lastMessageTime: string;
    unreadCount: number; starred: boolean; archived: boolean;
    otherParticipant: { name: string; email: string; role: string };
}

interface Contact { id: string; name: string; email: string; role: "consultant" | "admin" | "support"; }
interface Toast   { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Role helpers ─────────────────────────────────────────────────────────────

const roleColor = (role: string) => ({
    consultant: "bg-blue-600",
    admin:      "bg-blue-600",
    system:     "bg-emerald-600",
    support:    "bg-emerald-600",
    client:     "bg-blue-600",
}[role] || "bg-gray-600");

const roleLabel = (role: string) => ({
    consultant: "Consultant",
    admin:      "Admin",
    support:    "Support",
    client:     "You",
    system:     "System",
}[role] || role);

// ─── Component ────────────────────────────────────────────────────────────────

const ClientMessages: React.FC<ClientMessagesProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
        pressed:      isDark ? "neu-dark-pressed"   : "neu-light-pressed",
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
        rowHover:     isDark ? "hover:bg-gray-800/60" : "hover:bg-black/5",
        activeRow:    isDark ? "bg-blue-600/10 border-l-blue-500" : "bg-blue-50 border-l-blue-500",
    };

    const [messages,       setMessages]       = useState<Message[]>([]);
    const [contacts,       setContacts]       = useState<Contact[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [loadingContacts,setLoadingContacts]= useState(true);
    const [currentView,    setCurrentView]    = useState<ViewType>("inbox");
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [searchQuery,    setSearchQuery]    = useState("");
    const [toasts,         setToasts]         = useState<Toast[]>([]);
    const [showCompose,    setShowCompose]    = useState(false);
    const [replyingTo,     setReplyingTo]     = useState<Message | null>(null);

    const [composeTo,      setComposeTo]      = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody,    setComposeBody]    = useState("");
    const [sending,        setSending]        = useState(false);

    const msgEndRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = genId("t");
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    useEffect(() => { loadMessages(); loadContacts(); }, [customerId]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const stored = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            if (stored) { setMessages(JSON.parse(stored)); }
            else {
                const welcome: Message = {
                    id: genId("msg"), threadId: "thread_welcome",
                    from: { name: "Timely Support", email: "support@timely.com", role: "system" },
                    to:   { name: userName, email: userEmail },
                    subject: "Welcome to Timely",
                    body: `Hi ${userName.split(" ")[0]},\n\nWelcome to the Timely Client Portal. This is your secure messaging center where you can communicate directly with your consultant and our team.\n\nTo get started, click "Compose" to send your first message.\n\nBest regards,\nThe Timely Team`,
                    timestamp: new Date().toISOString(),
                    read: false, starred: false, archived: false, deleted: false,
                };
                saveMessages([welcome]);
            }
        } catch {} finally { setLoading(false); }
    };

    const loadContacts = async () => {
        setLoadingContacts(true);
        const list: Contact[] = [];
        try {
            const ccRes = await fetch(`${API_BASE}/client-consultants?clientId=${customerId}`);
            if (ccRes.ok) {
                const ccData = await ccRes.json();
                const assignedIds = new Set((ccData.data || []).map((x: any) => String(x.consultantId)));
                if (assignedIds.size > 0) {
                    const cRes = await fetch(`${API_BASE}/consultants`);
                    if (cRes.ok) {
                        const cData = await cRes.json();
                        (cData.data || []).forEach((c: any) => {
                            if (assignedIds.has(String(c.consultantId)))
                                list.push({ id: c.consultantId, name: `${c.firstName} ${c.lastName}`, email: c.email, role: "consultant" });
                        });
                    }
                }
            }
            const uRes = await fetch(`${API_BASE}/users-report`);
            if (uRes.ok) {
                const uData = await uRes.json();
                (uData.data || []).forEach((u: any) => {
                    if (u.role === "admin")
                        list.push({ id: u.customerId, name: `${u.firstName} ${u.lastName}`, email: u.email, role: "admin" });
                });
            }
        } catch {}
        list.push({ id: "support", name: "Timely Support", email: "support@timely.com", role: "support" });
        setContacts(list);
        setLoadingContacts(false);
    };

    const saveMessages = (msgs: Message[]) => {
        setMessages(msgs);
        localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(msgs));
    };

    const saveToRecipient = (msg: Message, contact: Contact) => {
        const key = contact.role === "admin"
            ? "timely_admin_messages"
            : `timely_consultant_messages_${contact.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...existing, { ...msg, clientId: customerId, clientName: userName }]));
        const global = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
        localStorage.setItem("timely_global_messages", JSON.stringify([...global, { ...msg, clientId: customerId, clientName: userName }]));
    };

    // ── Derived state ─────────────────────────────────────────────────────────

    const threads = useMemo((): Thread[] => {
        const map = new Map<string, Thread>();
        messages.forEach(msg => {
            if (msg.deleted && currentView !== "trash") return;
            if (msg.archived && currentView !== "archived" && currentView !== "trash") return;
            const other = msg.from.email === userEmail ? msg.to : msg.from;
            const existing = map.get(msg.threadId);
            if (!existing) {
                map.set(msg.threadId, {
                    id: msg.threadId, subject: msg.subject,
                    lastMessage: msg.body.slice(0, 120),
                    lastMessageTime: msg.timestamp,
                    unreadCount: msg.read ? 0 : 1,
                    starred: msg.starred, archived: msg.archived,
                    otherParticipant: { name: other.name || "Unknown", email: other.email || "", role: (other as any).role || "system" },
                });
            } else {
                if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = msg.body.slice(0, 120);
                    existing.lastMessageTime = msg.timestamp;
                }
                if (!msg.read) existing.unreadCount++;
                if (msg.starred) existing.starred = true;
            }
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    }, [messages, currentView, userEmail]);

    const filteredThreads = useMemo(() => {
        let res = threads;
        if (currentView === "starred")  res = res.filter(t => t.starred);
        if (currentView === "archived") res = res.filter(t => messages.some(m => m.threadId === t.id && m.archived && !m.deleted));
        if (currentView === "trash")    res = threads.filter(t => messages.some(m => m.threadId === t.id && m.deleted));
        if (currentView === "inbox")    res = res.filter(t => !t.archived);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            res = res.filter(t => t.subject.toLowerCase().includes(q) || t.lastMessage.toLowerCase().includes(q) || t.otherParticipant.name.toLowerCase().includes(q));
        }
        return res;
    }, [threads, currentView, searchQuery, messages]);

    const threadMessages = useMemo(() =>
        messages.filter(m => m.threadId === selectedThread).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
        [messages, selectedThread]);

    const stats = useMemo(() => ({
        unread:  messages.filter(m => !m.read && !m.archived && !m.deleted).length,
        starred: threads.filter(t => t.starred).length,
    }), [messages, threads]);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [threadMessages]);
    useEffect(() => {
        if (selectedThread) saveMessages(messages.map(m => m.threadId === selectedThread ? { ...m, read: true } : m));
    }, [selectedThread]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const toggleStar    = (tid: string) => saveMessages(messages.map(m => m.threadId === tid ? { ...m, starred: !m.starred } : m));
    const archiveThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, archived: true } : m)); showToast("Archived", "info"); setSelectedThread(null); };
    const deleteThread  = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, deleted: true } : m)); showToast("Moved to trash", "info"); setSelectedThread(null); };
    const restoreThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, deleted: false, archived: false } : m)); showToast("Restored", "success"); };
    const permDelete    = (tid: string) => { if (confirm("Permanently delete this conversation?")) { saveMessages(messages.filter(m => m.threadId !== tid)); showToast("Deleted", "success"); setSelectedThread(null); } };

    const handleSend = () => {
        if (!composeTo || !composeSubject.trim() || !composeBody.trim()) { showToast("Please fill all fields", "error"); return; }
        const contact = contacts.find(c => c.email === composeTo);
        if (!contact) { showToast("Invalid recipient", "error"); return; }
        setSending(true);
        const threadId = replyingTo?.threadId || genId("thread");
        const msg: Message = {
            id: genId("msg"), threadId,
            from: { name: userName, email: userEmail, role: "client", id: customerId },
            to:   { name: contact.name, email: contact.email, role: contact.role, id: contact.id },
            subject: replyingTo ? `Re: ${replyingTo.subject.replace(/^Re: /, "")}` : composeSubject,
            body: composeBody, timestamp: new Date().toISOString(),
            read: true, starred: false, archived: false, deleted: false,
            replyTo: replyingTo?.id,
        };
        saveMessages([...messages, msg]);
        saveToRecipient(msg, contact);
        showToast("Message sent", "success");
        setComposeTo(""); setComposeSubject(""); setComposeBody("");
        setShowCompose(false); setReplyingTo(null); setSending(false);
        setSelectedThread(threadId);
    };

    const openReply = (msg: Message) => {
        setReplyingTo(msg);
        setComposeTo(msg.from.email === userEmail ? msg.to.email : msg.from.email);
        setComposeSubject(`Re: ${msg.subject.replace(/^Re: /, "")}`);
        setComposeBody(""); setShowCompose(true);
    };

    const fmtTime = (ts: string) => {
        const d = new Date(ts); const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const consultants = contacts.filter(c => c.role === "consultant");
    const admins      = contacts.filter(c => c.role === "admin");
    const support     = contacts.filter(c => c.role === "support");

    const Avatar: React.FC<{ name: string; role: string; size?: "sm" | "md" }> = ({ name, role, size = "md" }) => (
        <div className={`${size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs"} ${roleColor(role)} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* ── Compose Modal ── */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl w-full max-w-2xl overflow-hidden`}>
                        <div className={`px-5 py-4 border-b ${n.divider} flex items-center justify-between ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                                    {replyingTo ? <Reply className="w-4 h-4 text-white" /> : <Mail className="w-4 h-4 text-white" />}
                                </div>
                                <h3 className={`font-semibold ${n.text}`}>{replyingTo ? "Reply" : "New Message"}</h3>
                            </div>
                            <button onClick={() => { setShowCompose(false); setReplyingTo(null); }} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* To */}
                            <div>
                                <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>To</label>
                                <select value={composeTo} onChange={e => setComposeTo(e.target.value)} disabled={!!replyingTo}
                                    className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50`}>
                                    <option value="">Select recipient…</option>
                                    {consultants.length > 0 && <optgroup label="Your Consultants">{consultants.map(c => <option key={c.id} value={c.email}>{c.name} — Consultant</option>)}</optgroup>}
                                    {admins.length > 0    && <optgroup label="Admins">{admins.map(c => <option key={c.id} value={c.email}>{c.name} — Admin</option>)}</optgroup>}
                                    {support.length > 0   && <optgroup label="Support">{support.map(c => <option key={c.id} value={c.email}>{c.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            {/* Subject */}
                            {!replyingTo && (
                                <div>
                                    <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Subject</label>
                                    <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject…"
                                        className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                                </div>
                            )}
                            {/* Body */}
                            <div>
                                <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Message</label>
                                <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={7} placeholder="Type your message…"
                                    className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} />
                            </div>
                        </div>
                        <div className={`px-5 py-4 border-t ${n.divider} flex justify-end gap-2 ${n.modalHead}`}>
                            <button onClick={() => { setShowCompose(false); setReplyingTo(null); }} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button>
                            <button onClick={handleSend} disabled={sending || !composeTo || !composeBody.trim()}
                                className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2 disabled:opacity-50`}>
                                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                {sending ? "Sending…" : "Send"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Messages</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>
                        {stats.unread > 0 ? `${stats.unread} unread` : "All caught up"}
                    </p>
                </div>
                <button onClick={() => setShowCompose(true)} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}>
                    <Plus className="w-4 h-4" />Compose
                </button>
            </div>

            {/* ── Main panel ── */}
            <div className={`${n.card} rounded-2xl overflow-hidden`} style={{ height: 640 }}>
                <div className="flex h-full">

                    {/* ── Left sidebar: nav + contacts ── */}
                    <div className={`w-56 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                        {/* Nav */}
                        <div className="p-3 space-y-0.5">
                            {([
                                { id: "inbox",    label: "Inbox",    icon: Inbox,   count: stats.unread },
                                { id: "starred",  label: "Starred",  icon: Star,    count: stats.starred },
                                { id: "archived", label: "Archived", icon: Archive  },
                                { id: "trash",    label: "Trash",    icon: Trash2   },
                            ] as { id: ViewType; label: string; icon: any; count?: number }[]).map(item => {
                                const active = currentView === item.id;
                                return (
                                    <button key={item.id} onClick={() => { setCurrentView(item.id); setSelectedThread(null); }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm
                                            ${active ? `${n.pressed} ${n.label}` : `${n.rowHover} ${n.secondary}`}`}>
                                        <div className="flex items-center gap-2.5">
                                            <item.icon className="w-4 h-4" />
                                            <span className="font-medium">{item.label}</span>
                                        </div>
                                        {item.count !== undefined && item.count > 0 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white font-bold">{item.count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Contacts */}
                        <div className={`border-t ${n.divider} flex-1 overflow-y-auto p-3`}>
                            <p className={`text-[10px] uppercase tracking-widest ${n.tertiary} mb-3 px-1`}>Contacts</p>
                            {loadingContacts ? (
                                <div className="flex justify-center py-6"><RefreshCw className={`w-5 h-5 ${n.label} animate-spin`} /></div>
                            ) : (
                                <div className="space-y-0.5">
                                    {consultants.length > 0 && (
                                        <>
                                            <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} mb-1.5 mt-1 px-1 flex items-center gap-1`}><Briefcase className="w-3 h-3" />Consultants</p>
                                            {consultants.map(c => (
                                                <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl ${n.rowHover} transition-all group`}>
                                                    <Avatar name={c.name} role={c.role} size="sm" />
                                                    <div className="text-left min-w-0">
                                                        <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {admins.length > 0 && (
                                        <>
                                            <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} mb-1.5 mt-3 px-1 flex items-center gap-1`}><Shield className="w-3 h-3" />Admin</p>
                                            {admins.map(c => (
                                                <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl ${n.rowHover} transition-all`}>
                                                    <Avatar name={c.name} role={c.role} size="sm" />
                                                    <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {support.map(c => (
                                        <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl ${n.rowHover} transition-all mt-3`}>
                                            <Avatar name={c.name} role={c.role} size="sm" />
                                            <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                        </button>
                                    ))}
                                    {consultants.length === 0 && admins.length === 0 && (
                                        <div className="text-center py-6">
                                            <Users className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} strokeWidth={1.5} />
                                            <p className={`text-xs ${n.tertiary}`}>No contacts yet</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Thread list ── */}
                    <div className={`w-72 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                        {/* Search */}
                        <div className="p-3">
                            <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                                <Search className={`w-3.5 h-3.5 ${n.tertiary} flex-shrink-0`} />
                                <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className={`w-full bg-transparent ${n.text} text-xs focus:outline-none`} />
                                {searchQuery && <button onClick={() => setSearchQuery("")}><X className={`w-3 h-3 ${n.tertiary}`} /></button>}
                            </div>
                        </div>

                        {/* Threads */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-10"><RefreshCw className={`w-6 h-6 ${n.label} animate-spin`} /></div>
                            ) : filteredThreads.length === 0 ? (
                                <div className="text-center py-12">
                                    <MessageCircle className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                    <p className={`${n.secondary} text-sm`}>No messages</p>
                                    <button onClick={() => setShowCompose(true)} className={`mt-3 text-xs ${n.link}`}>Compose one</button>
                                </div>
                            ) : filteredThreads.map(thread => {
                                const active = selectedThread === thread.id;
                                return (
                                    <div key={thread.id} onClick={() => setSelectedThread(thread.id)}
                                        className={`px-3 py-3.5 cursor-pointer transition-all border-l-2
                                            ${active ? n.activeRow : `border-transparent ${n.rowHover}`}
                                            ${thread.unreadCount > 0 ? (isDark ? "bg-blue-500/5" : "bg-blue-50/40") : ""}`}>
                                        <div className="flex items-start gap-2.5">
                                            <Avatar name={thread.otherParticipant.name} role={thread.otherParticipant.role} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <p className={`text-sm font-semibold ${n.text} truncate`}>{thread.otherParticipant.name}</p>
                                                    <span className={`text-[10px] ${n.tertiary} flex-shrink-0 ml-1`}>{fmtTime(thread.lastMessageTime)}</span>
                                                </div>
                                                <p className={`text-xs font-medium ${thread.unreadCount > 0 ? n.text : n.secondary} truncate`}>{thread.subject}</p>
                                                <p className={`text-[11px] ${n.tertiary} truncate mt-0.5`}>{thread.lastMessage}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    {thread.starred    && <Star    className="w-3 h-3 text-amber-400 fill-amber-400" />}
                                                    {thread.unreadCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white font-bold">{thread.unreadCount}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Message pane ── */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {!selectedThread ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <div className={`w-16 h-16 ${n.flat} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                                        <Mail className={`w-8 h-8 ${n.tertiary}`} strokeWidth={1.5} />
                                    </div>
                                    <p className={`font-semibold ${n.secondary} text-sm`}>Select a conversation</p>
                                    <p className={`text-xs ${n.tertiary} mt-1 mb-4`}>or start a new one</p>
                                    <button onClick={() => setShowCompose(true)} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2 mx-auto`}>
                                        <Plus className="w-3.5 h-3.5" />New Message
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Thread header */}
                                <div className={`px-4 py-3 border-b ${n.divider} flex items-center justify-between flex-shrink-0`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <p className={`font-semibold ${n.text} text-sm truncate`}>{threadMessages[0]?.subject || "No Subject"}</p>
                                            <p className={`text-xs ${n.tertiary}`}>{threadMessages.length} message{threadMessages.length !== 1 ? "s" : ""}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button onClick={() => toggleStar(selectedThread)} className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}>
                                            <Star className={`w-4 h-4 ${threads.find(t => t.id === selectedThread)?.starred ? "text-amber-400 fill-amber-400" : n.tertiary}`} />
                                        </button>
                                        <button onClick={() => archiveThread(selectedThread)} className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}>
                                            <Archive className={`w-4 h-4 ${n.tertiary}`} />
                                        </button>
                                        {currentView === "trash" ? (
                                            <>
                                                <button onClick={() => restoreThread(selectedThread)} className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}>
                                                    <RefreshCw className={`w-4 h-4 ${n.tertiary}`} />
                                                </button>
                                                <button onClick={() => permDelete(selectedThread)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10">
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => deleteThread(selectedThread)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10">
                                                <Trash2 className={`w-4 h-4 ${n.tertiary}`} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                                    {threadMessages.map(msg => {
                                        const isOwn = msg.from.email === userEmail;
                                        return (
                                            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-3`}>
                                                {!isOwn && <Avatar name={msg.from.name} role={msg.from.role} />}
                                                <div className={`max-w-[72%]`}>
                                                    {!isOwn && (
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className={`text-xs font-semibold ${n.text}`}>{msg.from.name}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-gray-800 text-gray-500" : "bg-black/10 text-gray-500"}`}>{roleLabel(msg.from.role)}</span>
                                                            <span className={`text-[10px] ${n.tertiary}`}>{fmtTime(msg.timestamp)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                                                        ${isOwn
                                                            ? "bg-blue-600 text-white rounded-br-sm"
                                                            : `${n.flat} ${n.text} rounded-bl-sm`}`}>
                                                        {msg.body}
                                                    </div>
                                                    {isOwn && (
                                                        <div className="flex items-center justify-end gap-1 mt-1">
                                                            <span className={`text-[10px] ${n.tertiary}`}>{fmtTime(msg.timestamp)}</span>
                                                            <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                {isOwn && <Avatar name={msg.from.name} role={msg.from.role} />}
                                            </div>
                                        );
                                    })}
                                    <div ref={msgEndRef} />
                                </div>

                                {/* Reply bar */}
                                <div className={`px-4 py-3 border-t ${n.divider} flex-shrink-0`}>
                                    <button
                                        onClick={() => openReply(threadMessages[threadMessages.length - 1])}
                                        className={`w-full ${n.inset} rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${isDark ? "hover:bg-gray-800/50" : "hover:bg-black/5"}`}
                                    >
                                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Reply className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className={`text-sm ${n.tertiary}`}>Reply to this conversation…</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientMessages;