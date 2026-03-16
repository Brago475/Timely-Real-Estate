// src/ClientPortal_views/ClientMessages.tsx
// Project-centric messaging: conversations tied to projects, text + file + system messages

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Send, Search, X, RefreshCw, CheckCheck, AlertCircle,
    CheckCircle, Info, Plus, Users, Paperclip, FileText,
    Image as ImageIcon, File, Download, MoreVertical,
    MessageCircle, FolderOpen, Smile, ChevronRight,
    ChevronLeft, Star, Trash2, Reply,
} from "lucide-react";

const API_BASE = "/api";
const STORAGE_KEY = "timely_client_messages_v2";
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientMessagesProps = { userName?: string; userEmail?: string; customerId?: string; };

type MsgType = "text" | "file" | "image" | "system";

interface Attachment {
    id: string; name: string; size: number;
    type: string; base64?: string;
}

interface Message {
    id: string; conversationId: string;
    senderName: string; senderEmail: string; senderRole: string;
    type: MsgType; body: string;
    attachment?: Attachment;
    timestamp: string; read: boolean;
    replyToId?: string; replyToBody?: string;
    deleted?: boolean; starred?: boolean;
}

interface Conversation {
    id: string;
    projectId?: string; projectName?: string;
    title: string; subtitle: string;
    participants: { name: string; role: string }[];
    lastMessage: string; lastMessageTime: string;
    unreadCount: number; type: "project" | "direct" | "support";
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
};

const fmtTime = (ts: string) => {
    const d = new Date(ts); const now = new Date(); const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtFull = (ts: string) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const fileIcon = (type: string, name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (type.startsWith("image/") || ["jpg","jpeg","png","gif","webp"].includes(ext)) return { icon: ImageIcon, color: "text-pink-400" };
    if (ext === "pdf") return { icon: FileText, color: "text-red-400" };
    return { icon: File, color: "text-blue-400" };
};

// ─── Component ────────────────────────────────────────────────────────────────

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
        input:     isDark ? "bg-transparent border-gray-700 text-white placeholder-gray-600" : "bg-transparent border-gray-300 text-gray-900 placeholder-gray-400",
        btnPrimary:"bg-blue-600 hover:bg-blue-500 text-white",
        rowHover:  isDark ? "hover:bg-gray-800/60" : "hover:bg-gray-50",
        activeRow: isDark ? "bg-blue-600/10 border-l-2 border-l-blue-500" : "bg-blue-50/80 border-l-2 border-l-blue-500",
        msgInput:  isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200",
        sysBg:     isDark ? "bg-gray-800/40 text-gray-400" : "bg-gray-100 text-gray-500",
    };

    const [conversations,     setConversations]     = useState<Conversation[]>([]);
    const [messages,          setMessages]          = useState<Message[]>([]);
    const [loading,           setLoading]           = useState(true);
    const [loadingMsgs,       setLoadingMsgs]       = useState(false);
    const [selectedConvId,    setSelectedConvId]    = useState<string | null>(null);
    const [searchQuery,       setSearchQuery]       = useState("");
    const [toasts,            setToasts]            = useState<Toast[]>([]);
    const [replyText,         setReplyText]         = useState("");
    const [sending,           setSending]           = useState(false);
    const [replyingTo,        setReplyingTo]        = useState<Message | null>(null);
    const [showFilesPanel,    setShowFilesPanel]    = useState(false);
    const [msgMenu,           setMsgMenu]           = useState<{ id: string; x: number; y: number } | null>(null);
    const [attachPending,     setAttachPending]     = useState<Attachment | null>(null);
    const [attachPreview,     setAttachPreview]     = useState<string | null>(null);

    const msgEndRef   = useRef<HTMLDivElement>(null);
    const fileRef     = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const showToast = (msg: string, type: Toast["type"] = "success") => {
        const id = genId("t");
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    // ── Load conversations from projects ──────────────────────────────────────
    useEffect(() => { loadConversations(); }, [customerId]);

    const loadConversations = async () => {
        setLoading(true);
        try {
            // Get client's assigned projects
            const pcRaw = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
            const projectIds: string[] = pcRaw
                .filter((x: any) => String(x.clientId) === String(customerId))
                .map((x: any) => String(x.projectId));

            const prRes = await fetch(`${API_BASE}/projects`);
            const prData = prRes.ok ? await prRes.json() : { data: [] };
            const localProjects: any[] = JSON.parse(localStorage.getItem("timely_projects") || "[]");
            const allProjects = [...(prData.data || []), ...localProjects];

            const convos: Conversation[] = allProjects
                .filter(p => projectIds.includes(String(p.projectId)))
                .map(p => {
                    const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_conv_${p.projectId}`) || "{}");
                    return {
                        id: `proj_${p.projectId}`,
                        projectId: String(p.projectId),
                        projectName: p.projectName,
                        title: p.projectName,
                        subtitle: [p.address, p.city].filter(Boolean).join(", ") || p.projectCode || "",
                        participants: [{ name: userName, role: "client" }],
                        lastMessage: stored.lastMessage || "No messages yet",
                        lastMessageTime: stored.lastMessageTime || p.createdAt || new Date().toISOString(),
                        unreadCount: stored.unreadCount || 0,
                        type: "project" as const,
                    };
                });

            // Support conversation always available
            convos.push({
                id: "support",
                title: "Timely Support",
                subtitle: "General questions & help",
                participants: [{ name: userName, role: "client" }, { name: "Timely Support", role: "support" }],
                lastMessage: JSON.parse(localStorage.getItem(`${STORAGE_KEY}_conv_support`) || "{}").lastMessage || "Welcome! How can we help?",
                lastMessageTime: new Date().toISOString(),
                unreadCount: 0,
                type: "support" as const,
            });

            setConversations(convos.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()));

            // Auto-select first
            if (convos.length > 0 && !selectedConvId) {
                setTimeout(() => setSelectedConvId(convos[0].id), 100);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // ── Load messages for selected conversation ───────────────────────────────
    useEffect(() => {
        if (!selectedConvId) return;
        setLoadingMsgs(true);
        setReplyingTo(null); setReplyText(""); setAttachPending(null); setAttachPreview(null);
        try {
            const stored = localStorage.getItem(`${STORAGE_KEY}_msgs_${selectedConvId}`);
            if (stored) {
                const msgs: Message[] = JSON.parse(stored);
                setMessages(msgs);
                // Mark as read
                const updated = msgs.map(m => ({ ...m, read: true }));
                localStorage.setItem(`${STORAGE_KEY}_msgs_${selectedConvId}`, JSON.stringify(updated));
                setMessages(updated);
                // Update unread count
                updateConvMeta(selectedConvId, { unreadCount: 0 });
            } else {
                // Seed with welcome system message for project convos
                const conv = conversations.find(c => c.id === selectedConvId);
                if (conv) {
                    const seed: Message[] = [{
                        id: genId("msg"), conversationId: selectedConvId,
                        senderName: "Timely", senderEmail: "system@timely.com", senderRole: "system",
                        type: "system",
                        body: conv.type === "project"
                            ? `Conversation started for project "${conv.title}". Your consultant will be in touch soon.`
                            : "Welcome to Timely Support! How can we help you today?",
                        timestamp: new Date().toISOString(), read: true,
                    }];
                    localStorage.setItem(`${STORAGE_KEY}_msgs_${selectedConvId}`, JSON.stringify(seed));
                    setMessages(seed);
                }
            }
        } catch {} finally { setLoadingMsgs(false); }
    }, [selectedConvId]);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Close context menu on click outside
    useEffect(() => {
        const h = () => setMsgMenu(null);
        document.addEventListener("click", h);
        return () => document.removeEventListener("click", h);
    }, []);

    const updateConvMeta = (convId: string, meta: { lastMessage?: string; lastMessageTime?: string; unreadCount?: number }) => {
        const existing = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_conv_${convId}`) || "{}");
        localStorage.setItem(`${STORAGE_KEY}_conv_${convId}`, JSON.stringify({ ...existing, ...meta }));
        setConversations(p => p.map(c => c.id === convId ? { ...c, ...meta } : c));
    };

    const saveMessages = (msgs: Message[]) => {
        setMessages(msgs);
        localStorage.setItem(`${STORAGE_KEY}_msgs_${selectedConvId}`, JSON.stringify(msgs));
    };

    // ── File handling ─────────────────────────────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast("File must be under 10MB", "error"); return; }
        const b64 = await new Promise<string>(res => {
            const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(file);
        });
        const att: Attachment = { id: genId("att"), name: file.name, size: file.size, type: file.type, base64: b64 };
        setAttachPending(att);
        if (file.type.startsWith("image/")) setAttachPreview(b64);
        else setAttachPreview(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const sendMessage = () => {
        if ((!replyText.trim() && !attachPending) || !selectedConvId) return;
        setSending(true);

        const type: MsgType = attachPending
            ? (attachPending.type.startsWith("image/") ? "image" : "file")
            : "text";

        const msg: Message = {
            id: genId("msg"), conversationId: selectedConvId,
            senderName: userName, senderEmail: userEmail, senderRole: "client",
            type, body: replyText.trim(),
            attachment: attachPending || undefined,
            timestamp: new Date().toISOString(), read: true,
            replyToId: replyingTo?.id,
            replyToBody: replyingTo?.body.slice(0, 80),
        };

        const updated = [...messages, msg];
        saveMessages(updated);
        updateConvMeta(selectedConvId, {
            lastMessage: type === "text" ? msg.body : `Uploaded: ${attachPending?.name}`,
            lastMessageTime: msg.timestamp,
        });

        // Also write to global inbox for admin/consultant visibility
        const global = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
        localStorage.setItem("timely_global_messages", JSON.stringify([...global, { ...msg, clientId: customerId, clientName: userName }]));

        setReplyText(""); setAttachPending(null); setAttachPreview(null);
        setReplyingTo(null); setSending(false);
        if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage(); }
    };

    const deleteMsg = (msgId: string) => {
        saveMessages(messages.map(m => m.id === msgId ? { ...m, deleted: true, body: "Message deleted" } : m));
        setMsgMenu(null);
    };

    const starMsg = (msgId: string) => {
        saveMessages(messages.map(m => m.id === msgId ? { ...m, starred: !m.starred } : m));
        setMsgMenu(null);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const selectedConv = useMemo(() => conversations.find(c => c.id === selectedConvId), [conversations, selectedConvId]);

    const filteredConvs = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(c => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
    }, [conversations, searchQuery]);

    const sharedFiles = useMemo(() =>
        messages.filter(m => m.type === "file" || m.type === "image").map(m => m.attachment!).filter(Boolean),
        [messages]);

    const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);

    const convTypeIcon = (type: string) => {
        if (type === "project") return <FolderOpen className="w-4 h-4" />;
        return <Users className="w-4 h-4" />;
    };

    const convTypeBg = (type: string) => {
        if (type === "project") return "bg-blue-600";
        if (type === "support") return "bg-emerald-600";
        return "bg-gray-600";
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
                <div className={`fixed z-[9998] ${isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200"} border rounded-xl shadow-xl overflow-hidden`}
                    style={{ top: msgMenu.y, left: msgMenu.x, minWidth: 160 }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => { const m = messages.find(x => x.id === msgMenu.id); if (m) setReplyingTo(m); setMsgMenu(null); textareaRef.current?.focus(); }}
                        className={`w-full px-4 py-2.5 text-left text-sm ${n.secondary} ${n.rowHover} flex items-center gap-2`}>
                        <Reply className="w-3.5 h-3.5" />Reply
                    </button>
                    <button onClick={() => starMsg(msgMenu.id)}
                        className={`w-full px-4 py-2.5 text-left text-sm ${n.secondary} ${n.rowHover} flex items-center gap-2`}>
                        <Star className="w-3.5 h-3.5" />Star
                    </button>
                    <button onClick={() => deleteMsg(msgMenu.id)}
                        className={`w-full px-4 py-2.5 text-left text-sm text-red-400 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} flex items-center gap-2`}>
                        <Trash2 className="w-3.5 h-3.5" />Delete
                    </button>
                </div>
            )}

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" onChange={handleFileSelect} className="hidden" />

            {/* ── Page header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Messages</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>
                        {totalUnread > 0 ? `${totalUnread} unread` : "All conversations"}
                    </p>
                </div>
            </div>

            {/* ── Main panel ── */}
            <div className={`${n.card} rounded-2xl overflow-hidden flex`} style={{ height: 680 }}>

                {/* ── Col 1: Conversation list ── */}
                <div className={`w-72 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                    {/* Search */}
                    <div className="p-3">
                        <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                            <Search className={`w-3.5 h-3.5 ${n.tertiary} flex-shrink-0`} />
                            <input type="text" placeholder="Search conversations…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className={`w-full bg-transparent ${n.text} text-xs focus:outline-none`} />
                            {searchQuery && <button onClick={() => setSearchQuery("")}><X className={`w-3 h-3 ${n.tertiary}`} /></button>}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center py-10"><RefreshCw className={`w-6 h-6 ${n.label} animate-spin`} /></div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="text-center py-16">
                                <MessageCircle className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                <p className={`${n.secondary} text-sm`}>No conversations yet</p>
                                <p className={`${n.tertiary} text-xs mt-1`}>Projects will appear here</p>
                            </div>
                        ) : filteredConvs.map(conv => {
                            const active = selectedConvId === conv.id;
                            const isUnread = conv.unreadCount > 0;
                            return (
                                <div key={conv.id} onClick={() => setSelectedConvId(conv.id)}
                                    className={`px-4 py-4 cursor-pointer transition-all relative group
                                        ${active ? n.activeRow : `border-l-2 border-transparent ${n.rowHover}`}`}>
                                    <div className="flex items-start gap-3">
                                        {/* Conversation icon */}
                                        <div className={`w-10 h-10 ${convTypeBg(conv.type)} rounded-xl flex items-center justify-center flex-shrink-0 text-white`}>
                                            {convTypeIcon(conv.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <p className={`text-sm truncate ${isUnread ? `font-bold ${n.text}` : `font-medium ${n.secondary}`}`}>{conv.title}</p>
                                                <span className={`text-[10px] flex-shrink-0 ${n.tertiary}`}>{fmtTime(conv.lastMessageTime)}</span>
                                            </div>
                                            {conv.subtitle && <p className={`text-[11px] ${n.tertiary} truncate mb-0.5`}>{conv.subtitle}</p>}
                                            <p className={`text-xs truncate ${isUnread ? `font-semibold ${n.text}` : n.tertiary}`}>{conv.lastMessage}</p>
                                            {isUnread && (
                                                <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white font-bold">{conv.unreadCount} new</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Col 2: Message feed ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!selectedConvId || !selectedConv ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className={`w-16 h-16 ${n.flat} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                                    <MessageCircle className={`w-8 h-8 ${n.tertiary}`} strokeWidth={1.5} />
                                </div>
                                <p className={`font-semibold ${n.secondary} text-sm`}>Select a conversation</p>
                                <p className={`text-xs ${n.tertiary} mt-1`}>Your project conversations will appear on the left</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Conversation header */}
                            <div className={`px-5 py-3.5 border-b ${n.divider} flex items-center justify-between flex-shrink-0`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 ${convTypeBg(selectedConv.type)} rounded-xl flex items-center justify-center flex-shrink-0 text-white`}>
                                        {convTypeIcon(selectedConv.type)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-semibold ${n.text} text-sm truncate`}>{selectedConv.title}</p>
                                        <p className={`text-[11px] ${n.tertiary}`}>{selectedConv.subtitle || `${selectedConv.type === "project" ? "Project conversation" : "Support"}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {sharedFiles.length > 0 && (
                                        <button onClick={() => setShowFilesPanel(!showFilesPanel)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                                                ${showFilesPanel ? "bg-blue-600 text-white" : `${n.flat} ${n.secondary}`}`}>
                                            <Paperclip className="w-3.5 h-3.5" />{sharedFiles.length} files
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Message area + optional files panel */}
                            <div className="flex flex-1 overflow-hidden">

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                                    {loadingMsgs ? (
                                        <div className="flex justify-center py-10"><RefreshCw className={`w-6 h-6 ${n.label} animate-spin`} /></div>
                                    ) : messages.map((msg, idx) => {
                                        const isOwn = msg.senderEmail === userEmail;
                                        const isSystem = msg.type === "system";
                                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                                        const showName = !prevMsg || prevMsg.senderEmail !== msg.senderEmail;

                                        if (isSystem) return (
                                            <div key={msg.id} className="flex justify-center my-2">
                                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${n.sysBg}`}>
                                                    <Info className="w-3 h-3" />
                                                    <span>{msg.body}</span>
                                                </div>
                                            </div>
                                        );

                                        return (
                                            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-3 group/msg`}>
                                                {/* Other avatar */}
                                                {!isOwn && (
                                                    <div className="flex-shrink-0 self-end w-8">
                                                        {showName && (
                                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                                                {msg.senderName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="max-w-[70%]">
                                                    {showName && !isOwn && (
                                                        <div className="flex items-center gap-2 mb-1.5 ml-1">
                                                            <span className={`text-xs font-semibold ${n.text}`}>{msg.senderName}</span>
                                                            <span className={`text-[10px] capitalize ${n.tertiary}`}>{msg.senderRole}</span>
                                                        </div>
                                                    )}

                                                    {/* Reply preview */}
                                                    {msg.replyToBody && !msg.deleted && (
                                                        <div className={`ml-1 mb-1 px-3 py-1.5 rounded-lg border-l-2 border-blue-500 ${isDark ? "bg-gray-800/60 text-gray-400" : "bg-gray-100 text-gray-500"} text-xs truncate`}>
                                                            {msg.replyToBody}
                                                        </div>
                                                    )}

                                                    <div className="relative group/bubble">
                                                        {/* Text or file message */}
                                                        {(msg.type === "text" || msg.deleted) && (
                                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                                                                ${isOwn
                                                                    ? `bg-blue-600 text-white rounded-br-sm ${msg.deleted ? "opacity-50 italic" : ""}`
                                                                    : `${n.flat} ${n.text} rounded-bl-sm ${msg.deleted ? "opacity-50 italic" : ""}`}`}>
                                                                {msg.deleted ? "Message deleted" : msg.body}
                                                                {msg.starred && !msg.deleted && <Star className="inline w-3 h-3 text-amber-400 fill-amber-400 ml-1.5" />}
                                                            </div>
                                                        )}

                                                        {/* File attachment */}
                                                        {(msg.type === "file" || msg.type === "image") && msg.attachment && !msg.deleted && (
                                                            <div className={`rounded-2xl overflow-hidden ${isOwn ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                                                                {msg.type === "image" && msg.attachment.base64 ? (
                                                                    <div>
                                                                        <img src={msg.attachment.base64} alt={msg.attachment.name}
                                                                            className="max-w-xs max-h-48 object-cover rounded-2xl" />
                                                                        {msg.body && <p className={`mt-1 text-xs ${n.tertiary}`}>{msg.body}</p>}
                                                                    </div>
                                                                ) : (
                                                                    <div className={`flex items-center gap-3 px-4 py-3 ${isOwn ? "bg-blue-600" : n.flat} rounded-2xl`}>
                                                                        {(() => { const { icon: I, color } = fileIcon(msg.attachment.type, msg.attachment.name); return <I className={`w-5 h-5 ${isOwn ? "text-white/80" : color} flex-shrink-0`} />; })()}
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className={`text-sm font-medium truncate ${isOwn ? "text-white" : n.text}`}>{msg.attachment.name}</p>
                                                                            <p className={`text-xs ${isOwn ? "text-white/60" : n.tertiary}`}>{fmtSize(msg.attachment.size)}</p>
                                                                        </div>
                                                                        {msg.attachment.base64 && (
                                                                            <a href={msg.attachment.base64} download={msg.attachment.name}
                                                                                onClick={e => e.stopPropagation()}
                                                                                className={`w-7 h-7 flex items-center justify-center rounded-lg ${isOwn ? "bg-white/20 hover:bg-white/30" : `${n.inset} hover:bg-blue-500 hover:text-white`} transition-colors`}>
                                                                                <Download className={`w-3.5 h-3.5 ${isOwn ? "text-white" : n.secondary}`} />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Message actions */}
                                                        {!msg.deleted && (
                                                            <button onClick={e => { e.stopPropagation(); setMsgMenu({ id: msg.id, x: e.clientX - 170, y: e.clientY }); }}
                                                                className={`absolute ${isOwn ? "-left-8" : "-right-8"} top-1 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover/bubble:opacity-100 transition-opacity ${isDark ? "hover:bg-gray-700 bg-gray-800" : "hover:bg-gray-200 bg-gray-100"}`}>
                                                                <MoreVertical className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Timestamp */}
                                                    {isOwn && !msg.deleted && (
                                                        <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                                                            <span className={`text-[10px] ${n.tertiary}`}>{fmtFull(msg.timestamp)}</span>
                                                            <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                                        </div>
                                                    )}
                                                    {!isOwn && !isSystem && showName && (
                                                        <p className={`text-[10px] ${n.tertiary} ml-1 mt-0.5`}>{fmtFull(msg.timestamp)}</p>
                                                    )}
                                                </div>

                                                {isOwn && <div className="w-8 flex-shrink-0" />}
                                            </div>
                                        );
                                    })}
                                    <div ref={msgEndRef} />
                                </div>

                                {/* ── Files panel ── */}
                                {showFilesPanel && (
                                    <div className={`w-64 border-l ${n.divider} flex flex-col flex-shrink-0`}>
                                        <div className={`px-4 py-3.5 border-b ${n.divider} flex items-center justify-between`}>
                                            <p className={`text-sm font-semibold ${n.text}`}>Shared Files</p>
                                            <button onClick={() => setShowFilesPanel(false)} className={`p-1 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
                                                <X className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                            {sharedFiles.map(att => {
                                                const { icon: I, color } = fileIcon(att.type, att.name);
                                                return (
                                                    <div key={att.id} className={`${n.flat} rounded-xl p-3 flex items-center gap-3`}>
                                                        {att.type.startsWith("image/") && att.base64 ? (
                                                            <img src={att.base64} alt={att.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className={`w-10 h-10 ${n.inset} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                                                <I className={`w-5 h-5 ${color}`} />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-medium ${n.text} truncate`}>{att.name}</p>
                                                            <p className={`text-[10px] ${n.tertiary}`}>{fmtSize(att.size)}</p>
                                                        </div>
                                                        {att.base64 && (
                                                            <a href={att.base64} download={att.name}
                                                                className={`w-7 h-7 flex items-center justify-center rounded-lg ${n.inset} hover:bg-blue-600 hover:text-white transition-colors`}>
                                                                <Download className={`w-3.5 h-3.5 ${n.secondary}`} />
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Input bar ── */}
                            <div className={`px-4 py-3 border-t ${n.divider} flex-shrink-0`}>

                                {/* Reply preview */}
                                {replyingTo && (
                                    <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border-l-2 border-blue-500 ${isDark ? "bg-gray-800/60" : "bg-blue-50"}`}>
                                        <Reply className={`w-3.5 h-3.5 ${n.label} flex-shrink-0`} />
                                        <p className={`text-xs ${n.secondary} truncate flex-1`}>{replyingTo.body.slice(0, 80)}</p>
                                        <button onClick={() => setReplyingTo(null)} className={`flex-shrink-0 ${n.tertiary}`}><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}

                                {/* Attachment preview */}
                                {attachPending && (
                                    <div className={`flex items-center gap-2 mb-2 px-3 py-2 ${n.flat} rounded-xl`}>
                                        {attachPreview
                                            ? <img src={attachPreview} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                            : (() => { const { icon: I, color } = fileIcon(attachPending.type, attachPending.name); return <I className={`w-5 h-5 ${color} flex-shrink-0`} />; })()
                                        }
                                        <p className={`text-xs ${n.text} flex-1 truncate`}>{attachPending.name}</p>
                                        <p className={`text-[10px] ${n.tertiary} flex-shrink-0`}>{fmtSize(attachPending.size)}</p>
                                        <button onClick={() => { setAttachPending(null); setAttachPreview(null); }} className={`flex-shrink-0 ${n.tertiary}`}><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}

                                {/* Input */}
                                <div className={`flex items-end gap-3 ${n.msgInput} border rounded-2xl px-4 py-3`}>
                                    <textarea
                                        ref={textareaRef}
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={attachPending ? "Add a caption… (optional)" : "Type a message… (⌘ + Enter to send)"}
                                        rows={1}
                                        style={{ minHeight: "36px", maxHeight: "120px" }}
                                        className={`flex-1 bg-transparent ${n.text} text-sm resize-none focus:outline-none leading-relaxed`}
                                        onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 120)}px`; }}
                                    />
                                    <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                                        <button onClick={() => fileRef.current?.click()}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl ${n.rowHover} transition-colors`}>
                                            <Paperclip className={`w-4 h-4 ${attachPending ? n.label : n.tertiary}`} />
                                        </button>
                                        <button
                                            onClick={sendMessage}
                                            disabled={sending || (!replyText.trim() && !attachPending)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl ${n.btnPrimary} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}>
                                            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <p className={`text-[10px] ${n.tertiary} mt-1.5 ml-1`}>⌘ + Enter to send · Attach images, PDFs, and more</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientMessages;