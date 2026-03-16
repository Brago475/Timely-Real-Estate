// src/ClientPortal_views/ClientMessages.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Send, Search, Star, Trash2, Archive, X, RefreshCw,
    CheckCheck, Reply, AlertCircle, CheckCircle, Plus,
    Users, Shield, Briefcase, Info, Clock, Inbox, Mail,
    MoreVertical, Smile, Paperclip, MessageCircle,
} from "lucide-react";

const API_BASE = "/api";
const STORAGE_KEY = "timely_client_messages";
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

type ClientMessagesProps = { userName?: string; userEmail?: string; customerId?: string; };
type ViewType = "inbox" | "starred" | "archived" | "trash";

interface MsgFrom { name: string; email: string; role: "client" | "consultant" | "admin" | "system" | "support"; id?: string; }
interface MsgTo   { name: string; email: string; role?: string; id?: string; }

interface Message {
    id: string; threadId: string; from: MsgFrom; to: MsgTo;
    subject: string; body: string; timestamp: string;
    read: boolean; starred: boolean; archived: boolean; deleted: boolean;
    replyTo?: string;
}

interface Thread {
    id: string; subject: string; lastMessage: string; lastMessageTime: string;
    unreadCount: number; starred: boolean; archived: boolean;
    otherParticipant: { name: string; email: string; role: string };
}

interface Contact { id: string; name: string; email: string; role: "consultant" | "admin" | "support"; }
interface Toast   { id: string; message: string; type: "success" | "error" | "info"; }

const roleColor = (role: string) => ({
    consultant: "from-blue-500 to-blue-600",
    admin:      "from-blue-600 to-blue-700",
    system:     "from-gray-500 to-gray-600",
    support:    "from-gray-500 to-gray-600",
    client:     "from-blue-500 to-blue-600",
}[role] || "from-gray-500 to-gray-600");

const roleLabel = (role: string) => ({
    consultant: "Consultant", admin: "Admin",
    support: "Support", client: "You", system: "System",
}[role] || role);

const ClientMessages: React.FC<ClientMessagesProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark } = useTheme();

    const n = {
        card:      isDark ? "neu-dark"        : "neu-light",
        flat:      isDark ? "neu-dark-flat"   : "neu-light-flat",
        inset:     isDark ? "neu-dark-inset"  : "neu-light-inset",
        pressed:   isDark ? "neu-dark-pressed": "neu-light-pressed",
        text:      isDark ? "text-white"      : "text-gray-900",
        secondary: isDark ? "text-gray-300"   : "text-gray-600",
        tertiary:  isDark ? "text-gray-500"   : "text-gray-400",
        strong:    isDark ? "text-white"      : "text-black",
        label:     isDark ? "text-blue-400"   : "text-blue-600",
        divider:   isDark ? "border-gray-800" : "border-gray-200",
        modal:     isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200",
        input:     isDark ? "bg-transparent border-gray-700 text-white placeholder-gray-600" : "bg-transparent border-gray-300 text-gray-900 placeholder-gray-400",
        btnPrimary:"bg-blue-600 hover:bg-blue-500 text-white",
        rowHover:  isDark ? "hover:bg-gray-800/60" : "hover:bg-gray-50",
        activeRow: isDark ? "bg-blue-600/10 border-l-2 border-l-blue-500" : "bg-blue-50 border-l-2 border-l-blue-500",
        msgInput:  isDark ? "bg-gray-800/60 border-gray-700" : "bg-gray-50 border-gray-200",
    };

    const [messages,        setMessages]        = useState<Message[]>([]);
    const [contacts,        setContacts]        = useState<Contact[]>([]);
    const [loading,         setLoading]         = useState(true);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [currentView,     setCurrentView]     = useState<ViewType>("inbox");
    const [selectedThread,  setSelectedThread]  = useState<string | null>(null);
    const [searchQuery,     setSearchQuery]     = useState("");
    const [toasts,          setToasts]          = useState<Toast[]>([]);
    const [showCompose,     setShowCompose]     = useState(false);
    const [composeTo,       setComposeTo]       = useState("");
    const [composeSubject,  setComposeSubject]  = useState("");
    const [composeBody,     setComposeBody]     = useState("");
    const [sending,         setSending]         = useState(false);

    // inline reply input
    const [replyText,       setReplyText]       = useState("");
    const [sendingReply,    setSendingReply]    = useState(false);

    // message context menu
    const [msgMenu,         setMsgMenu]         = useState<{ msgId: string; x: number; y: number } | null>(null);

    const msgEndRef   = useRef<HTMLDivElement>(null);
    const replyRef    = useRef<HTMLTextAreaElement>(null);

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
                    body: `Hi ${userName.split(" ")[0]},\n\nWelcome to the Timely Client Portal. This is your secure messaging center where you can communicate directly with your consultant and our team.\n\nClick "New Message" to send your first message.\n\nBest regards,\nThe Timely Team`,
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
        const key = contact.role === "admin" ? "timely_admin_messages" : `timely_consultant_messages_${contact.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...existing, { ...msg, clientId: customerId, clientName: userName }]));
        const global = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
        localStorage.setItem("timely_global_messages", JSON.stringify([...global, { ...msg, clientId: customerId, clientName: userName }]));
    };

    // ── Derived ───────────────────────────────────────────────────────────────

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
                    lastMessage: msg.body.slice(0, 80),
                    lastMessageTime: msg.timestamp,
                    unreadCount: msg.read ? 0 : 1,
                    starred: msg.starred, archived: msg.archived,
                    otherParticipant: { name: other.name || "Unknown", email: other.email || "", role: (other as any).role || "system" },
                });
            } else {
                if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = msg.body.slice(0, 80);
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

    const activeThread = useMemo(() => threads.find(t => t.id === selectedThread), [threads, selectedThread]);

    const stats = useMemo(() => ({
        unread:  messages.filter(m => !m.read && !m.archived && !m.deleted).length,
        starred: threads.filter(t => t.starred).length,
    }), [messages, threads]);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [threadMessages]);
    useEffect(() => {
        if (selectedThread) saveMessages(messages.map(m => m.threadId === selectedThread ? { ...m, read: true } : m));
        setReplyText("");
    }, [selectedThread]);

    // close msg menu on click outside
    useEffect(() => {
        const handle = () => setMsgMenu(null);
        document.addEventListener("click", handle);
        return () => document.removeEventListener("click", handle);
    }, []);

    // ── Actions ───────────────────────────────────────────────────────────────
    const toggleStar    = (tid: string) => saveMessages(messages.map(m => m.threadId === tid ? { ...m, starred: !m.starred } : m));
    const archiveThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, archived: true } : m)); showToast("Archived", "info"); setSelectedThread(null); };
    const deleteThread  = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, deleted: true } : m)); showToast("Moved to trash", "info"); setSelectedThread(null); };
    const restoreThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, deleted: false, archived: false } : m)); showToast("Restored"); };
    const permDelete    = (tid: string) => { if (confirm("Permanently delete this conversation?")) { saveMessages(messages.filter(m => m.threadId !== tid)); showToast("Deleted"); setSelectedThread(null); } };
    const deleteMsg     = (msgId: string) => { saveMessages(messages.map(m => m.id === msgId ? { ...m, deleted: true } : m)); showToast("Message deleted"); setMsgMenu(null); };
    const starMsg       = (msgId: string) => { saveMessages(messages.map(m => m.id === msgId ? { ...m, starred: !m.starred } : m)); setMsgMenu(null); };

    const sendCompose = () => {
        if (!composeTo || !composeSubject.trim() || !composeBody.trim()) { showToast("Please fill all fields", "error"); return; }
        const contact = contacts.find(c => c.email === composeTo);
        if (!contact) { showToast("Invalid recipient", "error"); return; }
        setSending(true);
        const threadId = genId("thread");
        const msg: Message = {
            id: genId("msg"), threadId,
            from: { name: userName, email: userEmail, role: "client", id: customerId },
            to:   { name: contact.name, email: contact.email, role: contact.role, id: contact.id },
            subject: composeSubject, body: composeBody,
            timestamp: new Date().toISOString(),
            read: true, starred: false, archived: false, deleted: false,
        };
        saveMessages([...messages, msg]);
        saveToRecipient(msg, contact);
        showToast("Message sent");
        setComposeTo(""); setComposeSubject(""); setComposeBody("");
        setShowCompose(false); setSending(false);
        setSelectedThread(threadId);
    };

    const sendReply = () => {
        if (!replyText.trim() || !selectedThread) return;
        const lastMsg = threadMessages[threadMessages.length - 1];
        if (!lastMsg) return;
        const recipientEmail = lastMsg.from.email === userEmail ? lastMsg.to.email : lastMsg.from.email;
        const contact = contacts.find(c => c.email === recipientEmail) || { id: "support", name: "Timely Support", email: "support@timely.com", role: "support" as const };
        setSendingReply(true);
        const msg: Message = {
            id: genId("msg"), threadId: selectedThread,
            from: { name: userName, email: userEmail, role: "client", id: customerId },
            to:   { name: contact.name, email: contact.email, role: contact.role, id: contact.id },
            subject: `Re: ${lastMsg.subject.replace(/^Re: /, "")}`,
            body: replyText, timestamp: new Date().toISOString(),
            read: true, starred: false, archived: false, deleted: false,
            replyTo: lastMsg.id,
        };
        saveMessages([...messages, msg]);
        saveToRecipient(msg, contact as Contact);
        setReplyText(""); setSendingReply(false);
        showToast("Reply sent");
    };

    const handleReplyKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); }
    };

    const fmtTime = (ts: string) => {
        const d = new Date(ts); const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const fmtFull = (ts: string) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const consultants = contacts.filter(c => c.role === "consultant");
    const admins      = contacts.filter(c => c.role === "admin");
    const support     = contacts.filter(c => c.role === "support");

    const Avatar: React.FC<{ name: string; role: string; size?: "xs" | "sm" | "md" }> = ({ name, role, size = "md" }) => {
        const sz = size === "xs" ? "w-7 h-7 text-[9px]" : size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs";
        return (
            <div className={`${sz} bg-gradient-to-br ${roleColor(role)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm shadow-lg`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> : <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>
                    </div>
                ))}
            </div>

            {/* Message context menu */}
            {msgMenu && (
                <div className={`fixed z-[9998] ${n.modal} border rounded-xl shadow-xl overflow-hidden`}
                    style={{ top: msgMenu.y, left: msgMenu.x, minWidth: 160 }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => starMsg(msgMenu.msgId)} className={`w-full px-4 py-2.5 text-left text-sm ${n.secondary} ${n.rowHover} flex items-center gap-2`}>
                        <Star className="w-3.5 h-3.5" />Star message
                    </button>
                    <button onClick={() => deleteMsg(msgMenu.msgId)} className={`w-full px-4 py-2.5 text-left text-sm text-red-400 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} flex items-center gap-2`}>
                        <Trash2 className="w-3.5 h-3.5" />Delete message
                    </button>
                </div>
            )}

            {/* ── Compose Modal ── */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl`}>
                        <div className={`px-5 py-4 border-b ${n.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                                    <Mail className="w-4 h-4 text-white" />
                                </div>
                                <h3 className={`font-semibold ${n.text}`}>New Message</h3>
                            </div>
                            <button onClick={() => setShowCompose(false)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>To</label>
                                <select value={composeTo} onChange={e => setComposeTo(e.target.value)}
                                    className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`}>
                                    <option value="">Select recipient…</option>
                                    {consultants.length > 0 && <optgroup label="Your Consultants">{consultants.map(c => <option key={c.id} value={c.email}>{c.name} — Consultant</option>)}</optgroup>}
                                    {admins.length > 0    && <optgroup label="Admins">{admins.map(c => <option key={c.id} value={c.email}>{c.name} — Admin</option>)}</optgroup>}
                                    {support.length > 0   && <optgroup label="Support">{support.map(c => <option key={c.id} value={c.email}>{c.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            <div>
                                <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Subject</label>
                                <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject…"
                                    className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                            </div>
                            <div>
                                <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Message</label>
                                <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={6} placeholder="Type your message…"
                                    className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} />
                            </div>
                        </div>
                        <div className={`px-5 py-4 border-t ${n.divider} flex justify-end gap-2`}>
                            <button onClick={() => setShowCompose(false)} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button>
                            <button onClick={sendCompose} disabled={sending || !composeTo || !composeSubject.trim() || !composeBody.trim()}
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
                    <p className={`text-sm ${n.secondary} mt-0.5`}>{stats.unread > 0 ? `${stats.unread} unread` : "All caught up"}</p>
                </div>
                <button onClick={() => setShowCompose(true)} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}>
                    <Plus className="w-4 h-4" />New Message
                </button>
            </div>

            {/* ── Main 3-col panel ── */}
            <div className={`${n.card} rounded-2xl overflow-hidden flex`} style={{ height: 660 }}>

                {/* ── Col 1: Nav + Contacts ── */}
                <div className={`w-52 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                    {/* Folder nav */}
                    <div className="p-3 space-y-0.5">
                        {([
                            { id: "inbox",    label: "Inbox",    icon: Inbox,   count: stats.unread },
                            { id: "starred",  label: "Starred",  icon: Star,    count: stats.starred },
                            { id: "archived", label: "Archived", icon: Archive },
                            { id: "trash",    label: "Trash",    icon: Trash2 },
                        ] as { id: ViewType; label: string; icon: any; count?: number }[]).map(item => {
                            const active = currentView === item.id;
                            return (
                                <button key={item.id} onClick={() => { setCurrentView(item.id); setSelectedThread(null); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all
                                        ${active ? `${n.pressed} ${n.label} font-semibold` : `${n.rowHover} ${n.secondary}`}`}>
                                    <div className="flex items-center gap-2.5">
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </div>
                                    {item.count !== undefined && item.count > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-blue-600 text-white font-bold">{item.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Contacts */}
                    <div className={`border-t ${n.divider} flex-1 overflow-y-auto p-3`}>
                        <p className={`text-[10px] uppercase tracking-widest ${n.tertiary} mb-3 px-1`}>Direct Messages</p>
                        {loadingContacts ? (
                            <div className="flex justify-center py-6"><RefreshCw className={`w-5 h-5 ${n.label} animate-spin`} /></div>
                        ) : (
                            <div className="space-y-0.5">
                                {consultants.length > 0 && <>
                                    <p className={`text-[10px] px-1 mb-1 flex items-center gap-1 ${n.tertiary}`}><Briefcase className="w-3 h-3" />Consultants</p>
                                    {consultants.map(c => (
                                        <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl ${n.rowHover} transition-all`}>
                                            <Avatar name={c.name} role={c.role} size="xs" />
                                            <div className="text-left min-w-0">
                                                <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                                <p className={`text-[10px] ${n.tertiary}`}>Consultant</p>
                                            </div>
                                        </button>
                                    ))}
                                </>}
                                {admins.length > 0 && <>
                                    <p className={`text-[10px] px-1 mt-3 mb-1 flex items-center gap-1 ${n.tertiary}`}><Shield className="w-3 h-3" />Admin</p>
                                    {admins.map(c => (
                                        <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl ${n.rowHover} transition-all`}>
                                            <Avatar name={c.name} role={c.role} size="xs" />
                                            <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                        </button>
                                    ))}
                                </>}
                                {support.map(c => (
                                    <button key={c.id} onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl ${n.rowHover} transition-all mt-2`}>
                                        <Avatar name={c.name} role={c.role} size="xs" />
                                        <p className={`text-xs font-medium ${n.text} truncate`}>{c.name}</p>
                                    </button>
                                ))}
                                {consultants.length === 0 && admins.length === 0 && (
                                    <div className="text-center py-8">
                                        <Users className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} strokeWidth={1.5} />
                                        <p className={`text-xs ${n.tertiary}`}>No contacts yet</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Col 2: Thread list ── */}
                <div className={`w-72 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                    {/* Search */}
                    <div className="p-3">
                        <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                            <Search className={`w-3.5 h-3.5 ${n.tertiary} flex-shrink-0`} />
                            <input type="text" placeholder="Search messages…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className={`w-full bg-transparent ${n.text} text-xs focus:outline-none`} />
                            {searchQuery && <button onClick={() => setSearchQuery("")}><X className={`w-3 h-3 ${n.tertiary}`} /></button>}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center py-10"><RefreshCw className={`w-6 h-6 ${n.label} animate-spin`} /></div>
                        ) : filteredThreads.length === 0 ? (
                            <div className="text-center py-16">
                                <MessageCircle className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                <p className={`${n.secondary} text-sm`}>No messages</p>
                                <button onClick={() => setShowCompose(true)} className={`mt-3 text-xs text-blue-400 hover:text-blue-300`}>Start a conversation</button>
                            </div>
                        ) : filteredThreads.map(thread => {
                            const active = selectedThread === thread.id;
                            const isUnread = thread.unreadCount > 0;
                            return (
                                <div key={thread.id} onClick={() => setSelectedThread(thread.id)}
                                    className={`px-4 py-4 cursor-pointer transition-all relative group
                                        ${active ? n.activeRow : `border-l-2 border-transparent ${n.rowHover}`}
                                        ${isUnread && !active ? (isDark ? "bg-blue-500/5" : "bg-blue-50/30") : ""}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0">
                                            <Avatar name={thread.otherParticipant.name} role={thread.otherParticipant.role} size="sm" />
                                            {isUnread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-current" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <p className={`text-sm truncate ${isUnread ? `font-bold ${n.text}` : `font-medium ${n.secondary}`}`}>
                                                    {thread.otherParticipant.name}
                                                </p>
                                                <span className={`text-[10px] flex-shrink-0 ${n.tertiary}`}>{fmtTime(thread.lastMessageTime)}</span>
                                            </div>
                                            <p className={`text-xs truncate ${isUnread ? `font-semibold ${n.text}` : n.secondary}`}>{thread.subject}</p>
                                            <p className={`text-[11px] truncate mt-0.5 ${n.tertiary}`}>{thread.lastMessage}</p>
                                        </div>
                                    </div>
                                    {/* Thread quick actions on hover */}
                                    <div className={`absolute right-3 top-3 hidden group-hover:flex items-center gap-1`}>
                                        <button onClick={e => { e.stopPropagation(); toggleStar(thread.id); }}
                                            className={`w-6 h-6 flex items-center justify-center rounded-lg ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-100"} shadow-sm`}>
                                            <Star className={`w-3 h-3 ${thread.starred ? "text-amber-400 fill-amber-400" : n.tertiary}`} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); archiveThread(thread.id); }}
                                            className={`w-6 h-6 flex items-center justify-center rounded-lg ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-100"} shadow-sm`}>
                                            <Archive className={`w-3 h-3 ${n.tertiary}`} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); deleteThread(thread.id); }}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500 shadow-sm group/del">
                                            <Trash2 className="w-3 h-3 text-red-400 group-hover/del:text-white" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Col 3: Message pane ── */}
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
                            <div className={`px-5 py-3.5 border-b ${n.divider} flex items-center justify-between flex-shrink-0`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    {activeThread && <Avatar name={activeThread.otherParticipant.name} role={activeThread.otherParticipant.role} size="sm" />}
                                    <div className="min-w-0">
                                        <p className={`font-semibold ${n.text} text-sm truncate`}>{activeThread?.otherParticipant.name}</p>
                                        <p className={`text-[11px] ${n.tertiary}`}>{activeThread ? roleLabel(activeThread.otherParticipant.role) : ""} · {threadMessages.length} message{threadMessages.length !== 1 ? "s" : ""}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => toggleStar(selectedThread)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"} transition-colors`}>
                                        <Star className={`w-4 h-4 ${activeThread?.starred ? "text-amber-400 fill-amber-400" : n.tertiary}`} />
                                    </button>
                                    <button onClick={() => archiveThread(selectedThread)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"} transition-colors`}>
                                        <Archive className={`w-4 h-4 ${n.tertiary}`} />
                                    </button>
                                    {currentView === "trash" ? (
                                        <>
                                            <button onClick={() => restoreThread(selectedThread)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
                                                <RefreshCw className={`w-4 h-4 ${n.tertiary}`} />
                                            </button>
                                            <button onClick={() => permDelete(selectedThread)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10">
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => deleteThread(selectedThread)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors">
                                            <Trash2 className={`w-4 h-4 ${n.tertiary}`} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                {threadMessages.map((msg, idx) => {
                                    const isOwn = msg.from.email === userEmail;
                                    const prevMsg = idx > 0 ? threadMessages[idx - 1] : null;
                                    const showAvatar = !prevMsg || prevMsg.from.email !== msg.from.email;
                                    return (
                                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-3 group/msg`}>
                                            {!isOwn && (
                                                <div className="flex-shrink-0 self-end">
                                                    {showAvatar
                                                        ? <Avatar name={msg.from.name} role={msg.from.role} size="sm" />
                                                        : <div className="w-8" />
                                                    }
                                                </div>
                                            )}
                                            <div className="max-w-[68%]">
                                                {showAvatar && !isOwn && (
                                                    <div className="flex items-center gap-2 mb-1.5 ml-1">
                                                        <span className={`text-xs font-semibold ${n.text}`}>{msg.from.name}</span>
                                                        <span className={`text-[10px] ${n.tertiary}`}>{fmtFull(msg.timestamp)}</span>
                                                    </div>
                                                )}
                                                <div className="relative group/bubble">
                                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                                                        ${isOwn
                                                            ? "bg-blue-600 text-white rounded-br-sm"
                                                            : `${n.flat} ${n.text} rounded-bl-sm`}`}>
                                                        {msg.body}
                                                    </div>
                                                    {/* Per-message actions */}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setMsgMenu({ msgId: msg.id, x: e.clientX, y: e.clientY }); }}
                                                        className={`absolute ${isOwn ? "-left-8" : "-right-8"} top-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                                                        <MoreVertical className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                                    </button>
                                                </div>
                                                {isOwn && (
                                                    <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                                                        <span className={`text-[10px] ${n.tertiary}`}>{fmtFull(msg.timestamp)}</span>
                                                        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                                    </div>
                                                )}
                                            </div>
                                            {isOwn && <div className="w-8 flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                                <div ref={msgEndRef} />
                            </div>

                            {/* ── Reply input bar ── */}
                            <div className={`px-4 py-3 border-t ${n.divider} flex-shrink-0`}>
                                <div className={`flex items-end gap-3 ${n.msgInput} border rounded-2xl px-4 py-3`}>
                                    <textarea
                                        ref={replyRef}
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={handleReplyKeyDown}
                                        placeholder="Type your message… (⌘ + Enter to send)"
                                        rows={1}
                                        style={{ minHeight: "36px", maxHeight: "120px" }}
                                        className={`flex-1 bg-transparent ${n.text} text-sm resize-none focus:outline-none leading-relaxed`}
                                        onInput={e => {
                                            const t = e.currentTarget;
                                            t.style.height = "auto";
                                            t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                                        }}
                                    />
                                    <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                                        <button className={`w-8 h-8 flex items-center justify-center rounded-xl ${n.rowHover} transition-colors`}>
                                            <Smile className={`w-4 h-4 ${n.tertiary}`} />
                                        </button>
                                        <button
                                            onClick={sendReply}
                                            disabled={sendingReply || !replyText.trim()}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl ${n.btnPrimary} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}>
                                            {sendingReply
                                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                : <Send className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>
                                <p className={`text-[10px] ${n.tertiary} mt-1.5 ml-1`}>Press ⌘ + Enter to send</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientMessages;