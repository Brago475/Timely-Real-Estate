// src/Tabs/AdminMessages.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { MessageCircle, Send, Search, Inbox, Star, Trash2, Archive, X, RefreshCw, CheckCheck, Mail, Plus, AlertCircle, CheckCircle, Users, Briefcase, Info } from "lucide-react";

const API_BASE = "/api";
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const fmtTime = (ts: string) => { const d = new Date(ts); const diff = Date.now() - d.getTime(); if (diff < 60000) return "Now"; if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" }); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

interface Message { id: string; threadId: string; from: { name: string; email: string; role: "client" | "consultant" | "admin" | "system"; id?: string }; to: { name: string; email: string; role?: string; id?: string }; subject: string; body: string; timestamp: string; read: boolean; starred: boolean; archived: boolean; deleted: boolean; clientId?: string; }
interface Client { customerId: string; firstName: string; lastName: string; email: string; }
interface ConsultantInfo { consultantId: string; firstName: string; lastName: string; email: string; role?: string; }
interface Thread { id: string; subject: string; senderName: string; senderEmail: string; senderRole: string; senderId: string; lastMessage: string; lastMessageTime: string; unreadCount: number; starred: boolean; messageCount: number; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }
type ViewType = "inbox" | "starred" | "archived";

interface Props { adminEmail?: string; adminName?: string; onNavigate?: (page: string) => void; }

const AdminMessages: React.FC<Props> = ({ adminEmail = "", adminName = "Admin", onNavigate }) => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? "neu-bg-dark" : "neu-bg-light", card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat", inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-white" : "text-gray-900", secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400", strong: isDark ? "text-white" : "text-black",
        label: isDark ? "text-blue-400" : "text-blue-600",
        badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
        input: isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-[#f0f0f0] border-gray-300",
        modalHead: isDark ? "bg-[#111111]" : "bg-[#f0f0f0]",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white", btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHoverFlat: isDark ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]" : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]",
        msgOwn: isDark ? "bg-blue-600" : "bg-blue-600",
        msgOther: isDark ? "bg-[#161616]" : "bg-[#e8e8e8]",
    };

    const [messages, setMessages] = useState<Message[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [consultants, setConsultants] = useState<ConsultantInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewType>("inbox");
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showCompose, setShowCompose] = useState(false);
    const [composeTo, setComposeTo] = useState(""); const [composeToType, setComposeToType] = useState<"client" | "consultant">("client");
    const [composeSubject, setComposeSubject] = useState(""); const [composeBody, setComposeBody] = useState("");
    const [sending, setSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string, type: "success" | "error" | "info" = "success") => { const id = genId("t"); setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    useEffect(() => { loadMessages(); loadClients(); loadConsultants(); }, []);
const loadClients = async () => { try { const r = await fetch(`${API_BASE}/orgs/me`); if (r.ok) { const d = await r.json(); const members = d.data?.members || []; setClients(members.filter((m: any) => m.role === "client").map((m: any) => ({ customerId: String(m.userId), firstName: m.name.split(" ")[0] || "", lastName: m.name.split(" ").slice(1).join(" ") || "", email: m.email }))); } } catch {} };    const loadConsultants = async () => { try { const r = await fetch(`${API_BASE}/consultants`); if (r.ok) { const d = await r.json(); setConsultants(d.data || []); } } catch {} };

    const loadMessages = () => {
        setLoading(true);
        try { const g = JSON.parse(localStorage.getItem("timely_global_messages") || "[]"); const a = JSON.parse(localStorage.getItem("timely_admin_messages") || "[]"); const seen = new Set<string>(); const all = [...g, ...a].filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }); setMessages(all); } catch {} setLoading(false);
    };

    const saveMessages = (msgs: Message[]) => { setMessages(msgs); localStorage.setItem("timely_global_messages", JSON.stringify(msgs)); localStorage.setItem("timely_admin_messages", JSON.stringify(msgs)); };

    const roleBadge = (r: string) => r === "client" ? "bg-emerald-500/20 text-emerald-400" : r === "consultant" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400";

    const threads = useMemo(() => {
        const map = new Map<string, Thread>();
        messages.forEach(msg => {
            if ((msg.deleted || msg.archived) && currentView !== "archived") return;
            if (!msg.from || !msg.to) return;
            if (msg.from.role === "system") return;
            const isAdmin = msg.from.role === "admin";
            const isFromOther = msg.from.role === "client" || msg.from.role === "consultant";
            if (!isAdmin && !isFromOther) return;
            const other = isAdmin ? { email: msg.to.email, name: msg.to.name, role: msg.to.role || "client", id: msg.to.id || msg.clientId || msg.to.email } : { email: msg.from.email, name: msg.from.name, role: msg.from.role, id: msg.from.id || msg.clientId || msg.from.email };
            const key = msg.threadId || other.email;
            const ex = map.get(key);
            if (!ex) { map.set(key, { id: key, subject: msg.subject, senderName: other.name, senderEmail: other.email, senderRole: other.role, senderId: other.id || "", lastMessage: msg.body.substring(0, 100), lastMessageTime: msg.timestamp, unreadCount: (!msg.read && !isAdmin) ? 1 : 0, starred: msg.starred, messageCount: 1 }); }
            else { if (new Date(msg.timestamp) > new Date(ex.lastMessageTime)) { ex.lastMessage = msg.body.substring(0, 100); ex.lastMessageTime = msg.timestamp; } if (!msg.read && !isAdmin) ex.unreadCount++; if (msg.starred) ex.starred = true; ex.messageCount++; }
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    }, [messages, currentView]);

    const filteredThreads = useMemo(() => {
        let r = threads;
        if (currentView === "starred") r = r.filter(t => t.starred);
        if (currentView === "archived") r = threads.filter(t => messages.some(m => m.threadId === t.id && (m.deleted || m.archived)));
        if (searchQ.trim()) { const q = searchQ.toLowerCase(); r = r.filter(t => t.subject.toLowerCase().includes(q) || t.lastMessage.toLowerCase().includes(q) || t.senderName.toLowerCase().includes(q)); }
        return r;
    }, [threads, currentView, searchQ, messages]);

    const threadMsgs = useMemo(() => {
        if (!selectedThread) return [];
        const thread = threads.find(t => t.id === selectedThread);
        if (!thread) return [];
        return messages.filter(m => { if (!m.from || !m.to) return false; if (m.threadId === selectedThread) return true; if (m.from.email === thread.senderEmail || m.to.email === thread.senderEmail) return true; return false; }).filter(m => !m.deleted)
    }, [messages, selectedThread, threads]);

    const selInfo = useMemo(() => threads.find(t => t.id === selectedThread), [threads, selectedThread]);

    const markRead = (tid: string) => saveMessages(messages.map(m => m.threadId === tid ? { ...m, read: true } : m));
    const toggleStar = (tid: string) => saveMessages(messages.map(m => m.threadId === tid ? { ...m, starred: !m.starred } : m));
    const archiveThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, archived: true } : m)); showToast("Archived"); setSelectedThread(null); };
    const deleteThread = (tid: string) => { saveMessages(messages.map(m => m.threadId === tid ? { ...m, deleted: true } : m)); showToast("Deleted"); setSelectedThread(null); };

    const sendMessage = () => {
        if (!composeBody.trim()) { showToast("Enter a message", "error"); return; }
        if (!selectedThread && !composeTo) { showToast("Select recipient", "error"); return; }
        setSending(true);
        let rName = "", rEmail = "", rId = "", rRole: "client" | "consultant" = "client";
        if (selInfo) { rName = selInfo.senderName; rEmail = selInfo.senderEmail; rId = selInfo.senderId; rRole = selInfo.senderRole as any; }
        else { rEmail = composeTo; if (composeToType === "client") { const c = clients.find(x => x.email === composeTo); if (c) { rName = `${c.firstName} ${c.lastName}`; rId = c.customerId; rRole = "client"; } } else { const c = consultants.find(x => x.email === composeTo); if (c) { rName = `${c.firstName} ${c.lastName}`; rId = c.consultantId; rRole = "consultant"; } } }
        const tid = selectedThread || genId("thread");
        const subj = composeSubject || (selInfo ? `Re: ${selInfo.subject}` : "Message from Admin");
        const msg: Message = { id: genId("msg"), threadId: tid, from: { name: adminName, email: adminEmail, role: "admin" }, to: { name: rName || rEmail, email: rEmail, role: rRole, id: rId }, subject: subj, body: composeBody, timestamp: new Date().toISOString(), read: true, starred: false, archived: false, deleted: false, clientId: rRole === "client" ? rId : undefined };
        const updated = [...messages, msg]; saveMessages(updated);
        if (rId || rEmail) { const key = rRole === "client" ? `timely_client_messages_${rId}` : `timely_consultant_messages_${rId}`; if (rId) { const existing = JSON.parse(localStorage.getItem(key) || "[]"); existing.push({ ...msg, read: false }); localStorage.setItem(key, JSON.stringify(existing)); } }
        showToast("Sent!"); setComposeBody(""); setComposeSubject(""); setComposeTo(""); setShowCompose(false); setSending(false); setSelectedThread(tid);
    };

    const stats = useMemo(() => ({ unread: messages.filter(m => m.from && !m.read && (m.from.role === "client" || m.from.role === "consultant") && !m.archived && !m.deleted).length, starred: threads.filter(t => t.starred).length, total: threads.length }), [messages, threads]);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [threadMsgs]);
    useEffect(() => { if (selectedThread) markRead(selectedThread); }, [selectedThread]);

    return (
        <div className="space-y-6">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            {/* Compose Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
                    <div className={`${n.modal} border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}><h3 className={`text-lg font-semibold ${n.text}`}>New Message</h3><button onClick={() => setShowCompose(false)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Send To</label>
                                <div className="flex gap-2 mb-2"><button onClick={() => { setComposeToType("client"); setComposeTo(""); }} className={`px-3 py-1.5 rounded-xl text-sm ${composeToType === "client" ? "bg-emerald-600 text-white" : n.btnSecondary}`}><Users className="w-3.5 h-3.5 inline mr-1" />Client</button><button onClick={() => { setComposeToType("consultant"); setComposeTo(""); }} className={`px-3 py-1.5 rounded-xl text-sm ${composeToType === "consultant" ? "bg-blue-600 text-white" : n.btnSecondary}`}><Briefcase className="w-3.5 h-3.5 inline mr-1" />Consultant</button></div>
                                <select value={composeTo} onChange={e => setComposeTo(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select {composeToType}...</option>{composeToType === "client" ? clients.map(c => <option key={c.customerId} value={c.email}>{c.firstName} {c.lastName} ({c.email})</option>) : consultants.map(c => <option key={c.consultantId} value={c.email}>{c.firstName} {c.lastName} ({c.email})</option>)}</select>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Subject *</label><input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject..." className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Message *</label><textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Type your message..." rows={8} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => setShowCompose(false)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={sendMessage} disabled={sending || !composeTo || !composeSubject.trim() || !composeBody.trim()} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50`}>{sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div><h2 className={`text-lg font-semibold ${n.strong}`}>Messages</h2><p className={`text-sm ${n.secondary}`}>{stats.unread > 0 ? `${stats.unread} unread` : "All caught up"} · {stats.total} conversations</p></div>
                <div className="flex items-center gap-2">
                    <button onClick={loadMessages} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${loading ? "animate-spin" : ""}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                    <button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl text-sm flex items-center gap-2`}><Plus className="w-4 h-4" />New</button>
                </div>
            </div>

            {/* Main */}
            <div className={`${n.card} overflow-hidden`}>
                <div className="flex h-[600px]">
                    {/* Nav */}
                    <div className={`w-44 border-r ${n.divider} p-2 space-y-1`}>
                        {[{ id: "inbox" as ViewType, l: "Inbox", icon: Inbox, count: stats.unread }, { id: "starred" as ViewType, l: "Starred", icon: Star, count: stats.starred }, { id: "archived" as ViewType, l: "Archived", icon: Archive, count: 0 }].map(item => (
                            <button key={item.id} onClick={() => { setCurrentView(item.id); setSelectedThread(null); }} className={`w-full flex items-center justify-between px-3 py-2.5 transition-all duration-200 ${currentView === item.id ? n.pressed : `${n.edgeHoverFlat}`}`}>
                                <div className="flex items-center gap-2.5"><item.icon className={`w-4 h-4 ${currentView === item.id ? n.label : n.tertiary}`} /><span className={`text-sm ${currentView === item.id ? n.text : n.secondary}`}>{item.l}</span></div>
                                {item.count > 0 && <span className="w-5 h-5 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">{item.count}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Thread List */}
                    <div className={`w-72 border-r ${n.divider} flex flex-col`}>
                        <div className="p-2"><div className={`${n.flat} flex items-center gap-2 px-3 py-2`}><Search className={`w-3.5 h-3.5 ${n.tertiary}`} /><input type="text" placeholder="Search..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} /></div></div>
                        <div className="flex-1 overflow-y-auto space-y-0.5 p-1">
                            {loading ? <div className="flex items-center justify-center py-8"><RefreshCw className={`w-5 h-5 ${n.tertiary} animate-spin`} /></div> : filteredThreads.length === 0 ? (
                                <div className="text-center py-8"><MessageCircle className={`w-8 h-8 ${n.tertiary} mx-auto mb-2 opacity-30`} /><p className={`${n.secondary} text-sm`}>No messages</p><button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-3 py-1.5 rounded-xl text-xs mt-3`}>Send first</button></div>
                            ) : filteredThreads.map(thread => (
                                <div key={thread.id} onClick={() => setSelectedThread(thread.id)} className={`p-3 cursor-pointer transition-all duration-200 rounded-lg ${selectedThread === thread.id ? n.pressed : n.edgeHoverFlat} ${thread.unreadCount > 0 ? `border-l-2 border-l-blue-500` : ""}`}>
                                    <div className="flex items-start gap-2.5">
                                        <div className={`w-9 h-9 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary} flex-shrink-0`}>{thread.senderName.split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase()}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5"><p className={`font-medium ${n.text} text-sm truncate`}>{thread.senderName}</p><span className={`text-[10px] ${n.tertiary} ml-1 shrink-0`}>{fmtTime(thread.lastMessageTime)}</span></div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadge(thread.senderRole)}`}>{thread.senderRole}</span>
                                            <p className={`text-xs ${thread.unreadCount > 0 ? `font-medium ${n.text}` : n.secondary} truncate mt-0.5`}>{thread.subject}</p>
                                            <div className="flex items-center gap-2 mt-1">{thread.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}{thread.unreadCount > 0 && <span className="w-4 h-4 bg-blue-500 text-white text-[9px] rounded-full flex items-center justify-center">{thread.unreadCount}</span>}<span className={`text-[10px] ${n.tertiary}`}>{thread.messageCount} msg</span></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message View */}
                    <div className="flex-1 flex flex-col">
                        {!selectedThread ? (
                            <div className="flex-1 flex items-center justify-center"><div className="text-center"><Mail className={`w-10 h-10 ${n.tertiary} mx-auto mb-3 opacity-30`} /><p className={`${n.secondary} text-sm`}>Select a conversation</p><button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-4 py-2 rounded-xl mt-4 text-sm inline-flex items-center gap-2`}><Plus className="w-4 h-4" />New</button></div></div>
                        ) : (<>
                            {/* Header */}
                            <div className={`p-4 border-b ${n.divider} flex items-center justify-between`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{selInfo?.senderName.split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase()}</div>
                                    <div className="min-w-0"><div className="flex items-center gap-2"><h3 className={`font-semibold ${n.text} text-sm`}>{selInfo?.senderName}</h3><span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadge(selInfo?.senderRole || "client")}`}>{selInfo?.senderRole}</span></div><p className={`text-[11px] ${n.tertiary}`}>{selInfo?.senderEmail}</p></div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => toggleStar(selectedThread)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`}><Star className={`w-4 h-4 ${selInfo?.starred ? "text-amber-400 fill-amber-400" : n.tertiary}`} /></button>
                                    <button onClick={() => archiveThread(selectedThread)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`}><Archive className={`w-4 h-4 ${n.tertiary}`} /></button>
                                    <button onClick={() => deleteThread(selectedThread)} className="p-2 rounded-lg hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
                                </div>
                            </div>
                            {/* Subject */}
                            <div className={`px-4 py-2 border-b ${n.divider}`}><p className={`text-xs ${n.tertiary}`}>Subject: <span className={n.text}>{threadMsgs[0]?.subject || selInfo?.subject || "—"}</span></p></div>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {threadMsgs.length === 0 ? <div className="text-center py-8"><p className={`${n.tertiary} text-sm`}>No messages</p></div> : threadMsgs.map(msg => {
                                    const own = msg.from.role === "admin";
                                    return (
                                        <div key={msg.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                                            <div className="max-w-[80%]">
                                                {!own && <div className="flex items-center gap-2 mb-1"><div className={`w-5 h-5 ${n.inset} rounded-full flex items-center justify-center text-[8px] font-semibold ${n.tertiary}`}>{msg.from.name[0]?.toUpperCase()}</div><span className={`text-xs font-medium ${n.text}`}>{msg.from.name}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadge(msg.from.role)}`}>{msg.from.role}</span><span className={`text-[10px] ${n.tertiary}`}>{fmtTime(msg.timestamp)}</span></div>}
                                                <div className={`p-3 rounded-xl ${own ? `${n.msgOwn} text-white` : n.msgOther}`}><p className={`text-sm whitespace-pre-wrap ${own ? "text-white" : n.text}`}>{msg.body}</p></div>
                                                {own && <div className="flex items-center justify-end gap-1 mt-1"><span className={`text-[10px] ${n.tertiary}`}>{fmtTime(msg.timestamp)}</span><CheckCheck className="w-3 h-3 text-blue-400" /></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={endRef} />
                            </div>
                            {/* Reply */}
                            <div className={`p-3 border-t ${n.divider}`}>
                                <div className="flex gap-2"><textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Type reply..." rows={2} className={`flex-1 px-3 py-2 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (composeBody.trim()) sendMessage(); } }} /><button onClick={sendMessage} disabled={!composeBody.trim() || sending} className={`${n.btnPrimary} px-4 rounded-xl disabled:opacity-50`}>{sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></div>
                            </div>
                        </>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminMessages;