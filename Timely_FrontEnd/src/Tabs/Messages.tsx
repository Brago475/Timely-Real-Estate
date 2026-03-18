import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    MessageCircle, Send, Search, X, RefreshCw, CheckCheck,
    Mail, Plus, AlertCircle, CheckCircle, Info, Users,
    Shield, Briefcase, User, FolderOpen,
} from "lucide-react";

const API_BASE = "/api";

interface Participant { userId: number; name: string; email: string; role: string; }
interface LastMessage { body: string; senderName: string; senderId: number; createdAt: string; }
interface Conversation { conversationId: number; title: string; type: string; projectId: number | null; participants: Participant[]; lastMessage: LastMessage | null; unreadCount: number; updatedAt: string; createdAt: string; }
interface Message { messageId: number; conversationId: number; senderId: number; senderName: string; senderEmail: string; senderRole: string; body: string; type: string; createdAt: string; isOwn: boolean; }
interface Contact { userId: number; name: string; email: string; role: string; actualRole: string; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const genId = () => `t_${Date.now()}`;

const fmtTime = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "Now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const roleColor = (role: string) => {
    if (role === "client") return "bg-emerald-600";
    if (role === "consultant") return "bg-blue-600";
    if (role === "admin" || role === "owner") return "bg-purple-600";
    return "bg-gray-600";
};

const roleBadge = (role: string, isDark: boolean) => {
    if (role === "client") return isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700";
    if (role === "consultant") return isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700";
    return isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700";
};

const roleIcon = (role: string) => {
    if (role === "client") return Users;
    if (role === "consultant") return Briefcase;
    if (role === "admin" || role === "owner") return Shield;
    return User;
};

const roleLabel = (role: string) => {
    if (role === "owner") return "Admin";
    return role.charAt(0).toUpperCase() + role.slice(1);
};

interface MessagesProps {
    userRole?: string;
}

const Messages: React.FC<MessagesProps> = ({ userRole = "admin" }) => {
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
        divider: isDark ? "border-gray-800" : "border-gray-200",
        input: isDark
            ? "bg-transparent border-gray-700 text-white placeholder-gray-600"
            : "bg-transparent border-gray-300 text-gray-900 placeholder-gray-400",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        rowHover: isDark ? "hover:bg-gray-800/60" : "hover:bg-gray-50",
        activeRow: isDark ? "bg-blue-600/10 border-l-2 border-l-blue-500" : "bg-blue-50/80 border-l-2 border-l-blue-500",
        msgOwn: "bg-blue-600 text-white",
        msgOther: isDark ? "bg-[#161616]" : "bg-[#e8e8e8]",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200",
    };

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [composeTo, setComposeTo] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);

    const msgEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = genId();
        setToasts((p) => [...p, { id, message, type }]);
        setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
    };

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/conversations`);
            if (!res.ok) return;
            const data = await res.json();
            setConversations(data.data || []);
        } catch (err) {
            console.error("Error loading conversations:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load contacts
    const loadContacts = useCallback(async () => {
        setLoadingContacts(true);
        try {
            const res = await fetch(`${API_BASE}/conversations/contacts`);
            if (!res.ok) return;
            const data = await res.json();
            setContacts(data.data || []);
        } catch (err) {
            console.error("Error loading contacts:", err);
        } finally {
            setLoadingContacts(false);
        }
    }, []);

    // Load messages for selected conversation
    const loadMessages = useCallback(async (convId: number) => {
        setLoadingMsgs(true);
        try {
            const res = await fetch(`${API_BASE}/conversations/${convId}/messages`);
            if (!res.ok) return;
            const data = await res.json();
            setMessages(data.data || []);
            // Mark as read
            fetch(`${API_BASE}/conversations/${convId}/read`, { method: "POST" }).catch(() => {});
            // Update local unread count
            setConversations((prev) =>
                prev.map((c) => c.conversationId === convId ? { ...c, unreadCount: 0 } : c)
            );
        } catch (err) {
            console.error("Error loading messages:", err);
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    useEffect(() => { loadConversations(); loadContacts(); }, [loadConversations, loadContacts]);
    useEffect(() => { if (selectedConvId) loadMessages(selectedConvId); }, [selectedConvId, loadMessages]);
    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Poll for new messages every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadConversations();
            if (selectedConvId) loadMessages(selectedConvId);
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedConvId, loadConversations, loadMessages]);

    // Send message
    const handleSend = async () => {
        if (!replyText.trim() || !selectedConvId) return;
        setSending(true);
        try {
            const res = await fetch(`${API_BASE}/conversations/${selectedConvId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: replyText.trim() }),
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            if (data.message) setMessages((prev) => [...prev, data.message]);
            setReplyText("");
            if (textareaRef.current) textareaRef.current.style.height = "auto";
            loadConversations();
        } catch {
            showToast("Failed to send", "error");
        } finally {
            setSending(false);
        }
    };

    // Start new conversation
    const handleNewConversation = async () => {
        if (!composeTo) { showToast("Select a recipient", "error"); return; }
        try {
            const res = await fetch(`${API_BASE}/conversations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientId: Number(composeTo) }),
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            setShowCompose(false);
            setComposeTo("");
            await loadConversations();
            setSelectedConvId(data.conversation.conversationId);
        } catch {
            showToast("Failed to create conversation", "error");
        }
    };

    // Derived
    const selectedConv = useMemo(
        () => conversations.find((c) => c.conversationId === selectedConvId),
        [conversations, selectedConvId]
    );

    const filteredConvs = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c) => c.title.toLowerCase().includes(q) ||
                c.participants.some((p) => p.name.toLowerCase().includes(q))
        );
    }, [conversations, searchQuery]);

    const totalUnread = useMemo(
        () => conversations.reduce((s, c) => s + c.unreadCount, 0),
        [conversations]
    );

    const groupedContacts = useMemo(() => {
        const admins = contacts.filter((c) => c.role === "admin");
        const consultants = contacts.filter((c) => c.role === "consultant");
        const clients = contacts.filter((c) => c.role === "client");
        return { admins, consultants, clients };
    }, [contacts]);

    return (
        <div className="space-y-5">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none">
                {toasts.map((t) => (
                    <div key={t.id} className={`${n.card} pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm shadow-lg`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}><X className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>
                    </div>
                ))}
            </div>

            {/* New Conversation Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
                    <div className={`${n.modal} border rounded-2xl w-full max-w-md`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between`}>
                            <h3 className={`text-lg font-semibold ${n.text}`}>New Conversation</h3>
                            <button onClick={() => { setShowCompose(false); setComposeTo(""); }} className={`p-2 rounded-lg ${n.rowHover}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={`${n.label} text-[11px] block mb-2`}>Select recipient</label>
                                {loadingContacts ? (
                                    <div className="flex justify-center py-4"><RefreshCw className={`w-4 h-4 ${n.tertiary} animate-spin`} /></div>
                                ) : (
                                    <div className={`${n.inset} rounded-xl max-h-64 overflow-y-auto p-2 space-y-1`}>
                                        {groupedContacts.admins.length > 0 && (
                                            <>
                                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} px-2 pt-2 pb-1`}>Admins</p>
                                                {groupedContacts.admins.map((c) => (
                                                    <button key={c.userId} onClick={() => setComposeTo(String(c.userId))}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${composeTo === String(c.userId) ? n.activeRow : n.rowHover}`}>
                                                        <div className={`w-8 h-8 ${roleColor(c.actualRole)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>{initials(c.name)}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium ${n.text} truncate`}>{c.name}</p>
                                                            <p className={`text-[11px] ${n.tertiary} truncate`}>{c.email}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {groupedContacts.consultants.length > 0 && (
                                            <>
                                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} px-2 pt-3 pb-1`}>Consultants</p>
                                                {groupedContacts.consultants.map((c) => (
                                                    <button key={c.userId} onClick={() => setComposeTo(String(c.userId))}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${composeTo === String(c.userId) ? n.activeRow : n.rowHover}`}>
                                                        <div className={`w-8 h-8 ${roleColor(c.actualRole)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>{initials(c.name)}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium ${n.text} truncate`}>{c.name}</p>
                                                            <p className={`text-[11px] ${n.tertiary} truncate`}>{c.email}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {groupedContacts.clients.length > 0 && (
                                            <>
                                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} px-2 pt-3 pb-1`}>Clients</p>
                                                {groupedContacts.clients.map((c) => (
                                                    <button key={c.userId} onClick={() => setComposeTo(String(c.userId))}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${composeTo === String(c.userId) ? n.activeRow : n.rowHover}`}>
                                                        <div className={`w-8 h-8 ${roleColor(c.actualRole)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>{initials(c.name)}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium ${n.text} truncate`}>{c.name}</p>
                                                            <p className={`text-[11px] ${n.tertiary} truncate`}>{c.email}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {contacts.length === 0 && (
                                            <p className={`text-sm ${n.tertiary} text-center py-6`}>No contacts available</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setShowCompose(false); setComposeTo(""); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button>
                                <button onClick={handleNewConversation} disabled={!composeTo} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>Start</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Messages</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>
                        {totalUnread > 0 ? `${totalUnread} unread` : "All conversations"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { loadConversations(); if (selectedConvId) loadMessages(selectedConvId); }}
                        className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""} ${n.secondary}`} />
                    </button>
                    <button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl text-sm flex items-center gap-2`}>
                        <Plus className="w-4 h-4" /> New
                    </button>
                </div>
            </div>

            {/* Main Panel */}
            <div className={`${n.card} rounded-2xl overflow-hidden flex`} style={{ height: 640 }}>

                {/* Conversation List */}
                <div className={`w-80 border-r ${n.divider} flex flex-col flex-shrink-0`}>
                    {/* Search */}
                    <div className="p-3">
                        <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                            <Search className={`w-3.5 h-3.5 ${n.tertiary} flex-shrink-0`} />
                            <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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
                                <button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-3 py-1.5 rounded-xl text-xs mt-3`}>Start one</button>
                            </div>
                        ) : filteredConvs.map((conv) => {
                            const active = selectedConvId === conv.conversationId;
                            const other = conv.participants[0];
                            const isUnread = conv.unreadCount > 0;
                            const RIcon = other ? roleIcon(other.role) : User;

                            return (
                                <div key={conv.conversationId} onClick={() => setSelectedConvId(conv.conversationId)}
                                    className={`px-4 py-4 cursor-pointer transition-all relative
                                        ${active ? n.activeRow : `border-l-2 border-transparent ${n.rowHover}`}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 ${other ? roleColor(other.role) : "bg-gray-600"} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}>
                                            {other ? initials(other.name) : "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <p className={`text-sm truncate ${isUnread ? `font-bold ${n.text}` : `font-medium ${n.secondary}`}`}>
                                                    {other?.name || conv.title}
                                                </p>
                                                <span className={`text-[10px] flex-shrink-0 ${n.tertiary}`}>
                                                    {conv.lastMessage ? fmtTime(conv.lastMessage.createdAt) : ""}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <RIcon className={`w-3 h-3 ${n.tertiary}`} />
                                                <span className={`text-[10px] ${n.tertiary} capitalize`}>{other ? roleLabel(other.role) : ""}</span>
                                            </div>
                                            <p className={`text-xs truncate ${isUnread ? `font-semibold ${n.text}` : n.tertiary}`}>
                                                {conv.lastMessage
                                                    ? `${conv.lastMessage.senderName.split(" ")[0]}: ${conv.lastMessage.body}`
                                                    : "No messages yet"}
                                            </p>
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

                {/* Message View */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!selectedConvId || !selectedConv ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className={`w-16 h-16 ${n.flat} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                                    <Mail className={`w-8 h-8 ${n.tertiary}`} strokeWidth={1.5} />
                                </div>
                                <p className={`font-semibold ${n.secondary} text-sm`}>Select a conversation</p>
                                <p className={`text-xs ${n.tertiary} mt-1`}>Or start a new one</p>
                                <button onClick={() => setShowCompose(true)} className={`${n.btnPrimary} px-4 py-2 rounded-xl mt-4 text-sm inline-flex items-center gap-2`}>
                                    <Plus className="w-4 h-4" /> New Message
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Conversation Header */}
                            <div className={`px-5 py-3.5 border-b ${n.divider} flex items-center justify-between flex-shrink-0`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 ${selectedConv.participants[0] ? roleColor(selectedConv.participants[0].role) : "bg-gray-600"} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}>
                                        {selectedConv.participants[0] ? initials(selectedConv.participants[0].name) : "?"}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-semibold ${n.text} text-sm truncate`}>
                                            {selectedConv.participants[0]?.name || selectedConv.title}
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedConv.participants[0] ? roleBadge(selectedConv.participants[0].role, isDark) : ""}`}>
                                                {selectedConv.participants[0] ? roleLabel(selectedConv.participants[0].role) : ""}
                                            </span>
                                            <span className={`text-[11px] ${n.tertiary}`}>
                                                {selectedConv.participants[0]?.email || ""}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                                {loadingMsgs ? (
                                    <div className="flex justify-center py-10"><RefreshCw className={`w-6 h-6 ${n.label} animate-spin`} /></div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-16">
                                        <MessageCircle className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                        <p className={`${n.secondary} text-sm`}>No messages yet</p>
                                        <p className={`text-xs ${n.tertiary} mt-1`}>Send the first message below</p>
                                    </div>
                                ) : messages.map((msg, idx) => {
                                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                                    const showName = !prevMsg || prevMsg.senderId !== msg.senderId;

                                    return (
                                        <div key={msg.messageId} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"} gap-3`}>
                                            {/* Avatar for others */}
                                            {!msg.isOwn && (
                                                <div className="flex-shrink-0 self-end w-8">
                                                    {showName && (
                                                        <div className={`w-8 h-8 ${roleColor(msg.senderRole)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                                                            {initials(msg.senderName)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="max-w-[70%]">
                                                {showName && !msg.isOwn && (
                                                    <div className="flex items-center gap-2 mb-1.5 ml-1">
                                                        <span className={`text-xs font-semibold ${n.text}`}>{msg.senderName}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadge(msg.senderRole, isDark)}`}>
                                                            {roleLabel(msg.senderRole)}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                                                    ${msg.isOwn
                                                        ? `${n.msgOwn} rounded-br-sm`
                                                        : `${n.msgOther} ${n.text} rounded-bl-sm`}`}>
                                                    {msg.body}
                                                </div>

                                                <div className={`flex items-center ${msg.isOwn ? "justify-end" : "justify-start"} gap-1 mt-1 mx-1`}>
                                                    <span className={`text-[10px] ${n.tertiary}`}>{fmtTime(msg.createdAt)}</span>
                                                    {msg.isOwn && <CheckCheck className="w-3.5 h-3.5 text-blue-400" />}
                                                </div>
                                            </div>

                                            {msg.isOwn && <div className="w-8 flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                                <div ref={msgEndRef} />
                            </div>

                            {/* Input Bar */}
                            <div className={`px-4 py-3 border-t ${n.divider} flex-shrink-0`}>
                                <div className={`flex items-end gap-3 ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"} border rounded-2xl px-4 py-3`}>
                                    <textarea
                                        ref={textareaRef}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
                                        }}
                                        placeholder="Type a message... (Cmd + Enter to send)"
                                        rows={1}
                                        style={{ minHeight: "36px", maxHeight: "120px" }}
                                        className={`flex-1 bg-transparent ${n.text} text-sm resize-none focus:outline-none leading-relaxed`}
                                        onInput={(e) => {
                                            const t = e.currentTarget;
                                            t.style.height = "auto";
                                            t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={sending || !replyText.trim()}
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl ${n.btnPrimary} disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0`}>
                                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className={`text-[10px] ${n.tertiary} mt-1.5 ml-1`}>Cmd + Enter to send</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;