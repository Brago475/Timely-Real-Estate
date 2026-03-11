// src/Tabs/AdminMessages.tsx
// Admin messaging center - view and respond to messages from clients AND consultants
// Standalone version for sidebar navigation

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    MessageCircle, Send, Search, Inbox, Star, Trash2, Archive,
    X, RefreshCw, CheckCheck, Mail, Plus, AlertCircle, CheckCircle,
    Users, Briefcase
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

// Generate unique ID
const generateId = (prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Format time helper
const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface Message {
    id: string;
    threadId: string;
    from: {
        name: string;
        email: string;
        role: "client" | "consultant" | "admin" | "system";
        id?: string;
    };
    to: {
        name: string;
        email: string;
        role?: string;
        id?: string;
    };
    subject: string;
    body: string;
    timestamp: string;
    read: boolean;
    starred: boolean;
    archived: boolean;
    deleted: boolean;
    clientId?: string;
    clientName?: string;
}

interface Client {
    customerId: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface Consultant {
    consultantId: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
}

interface Thread {
    id: string;
    subject: string;
    senderName: string;
    senderEmail: string;
    senderRole: string;
    senderId: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    starred: boolean;
    messageCount: number;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

type ViewType = "inbox" | "starred" | "archived";

interface AdminMessagesProps {
    adminEmail?: string;
    adminName?: string;
    onNavigate?: (page: string) => void;
}

const AdminMessages: React.FC<AdminMessagesProps> = ({
    adminEmail = "",
    adminName = "Admin",
    onNavigate,
}) => {
    const { isDark } = useTheme();

    const s = {
        card: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200",
        cardInner: isDark ? "bg-slate-900" : "bg-gray-50",
        cardHover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-100",
        cardActive: isDark ? "bg-slate-700" : "bg-blue-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-500",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        input: isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        button: isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
    };

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewType>("inbox");
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Compose state
    const [showCompose, setShowCompose] = useState(false);
    const [composeTo, setComposeTo] = useState("");
    const [composeToType, setComposeToType] = useState<"client" | "consultant">("client");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [sending, setSending] = useState(false);

    const messageEndRef = useRef<HTMLDivElement>(null);

    // Toast
    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = generateId("toast");
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    // Load data
    useEffect(() => {
        loadMessages();
        loadClients();
        loadConsultants();
    }, []);

    const loadClients = async () => {
        try {
            const res = await fetch(`${API_BASE}/users-report`);
            if (res.ok) {
                const data = await res.json();
                setClients(data.data || []);
            }
        } catch (e) {
            console.error("Error loading clients:", e);
        }
    };

    const loadConsultants = async () => {
        try {
            const res = await fetch(`${API_BASE}/consultants`);
            if (res.ok) {
                const data = await res.json();
                // Filter out admins - only get consultants
                const consultantList = (data.data || []).filter((c: Consultant) =>
                    c.role !== "admin" && c.role !== "Admin"
                );
                setConsultants(consultantList);
            }
        } catch (e) {
            console.error("Error loading consultants:", e);
        }
    };

    const loadMessages = () => {
        setLoading(true);
        try {
            // Load from multiple sources
            const globalMsgs = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
            const adminMsgs = JSON.parse(localStorage.getItem("timely_admin_messages") || "[]");

            // Combine and deduplicate by ID
            const allMessages = [...globalMsgs, ...adminMsgs];
            const seen = new Set<string>();
            const uniqueMessages = allMessages.filter((msg) => {
                if (seen.has(msg.id)) return false;
                seen.add(msg.id);
                return true;
            });

            console.log("Loaded messages:", uniqueMessages.length, uniqueMessages);
            setMessages(uniqueMessages);
        } catch (e) {
            console.error("Error loading messages:", e);
        } finally {
            setLoading(false);
        }
    };

    const saveMessages = (newMessages: Message[]) => {
        setMessages(newMessages);
        localStorage.setItem("timely_global_messages", JSON.stringify(newMessages));
        localStorage.setItem("timely_admin_messages", JSON.stringify(newMessages));
    };

    // Get avatar color based on role
    const getAvatarColor = (role: string) => {
        switch (role) {
            case "client": return "bg-emerald-600";
            case "consultant": return "bg-blue-600";
            case "admin": return "bg-purple-600";
            default: return "bg-gray-600";
        }
    };

    // Get role icon
    const getRoleIcon = (role: string) => {
        switch (role) {
            case "client": return <Users className="w-3 h-3" />;
            case "consultant": return <Briefcase className="w-3 h-3" />;
            default: return null;
        }
    };

    // Get threads grouped by conversation partner (client or consultant)
    const threads = useMemo(() => {
        const threadMap = new Map<string, Thread>();

        messages.forEach((msg) => {
            if (msg.deleted && currentView !== "archived") return;
            if (msg.archived && currentView !== "archived") return;

            // Determine if this message involves admin
            const isFromAdmin = msg.from.role === "admin";
            const isToAdmin = msg.to.role === "admin";

            // For admin view, show messages FROM clients/consultants OR sent BY admin
            const isFromClientOrConsultant = msg.from.role === "client" || msg.from.role === "consultant";

            // Skip system messages and messages not involving admin
            if (msg.from.role === "system") return;
            if (!isFromAdmin && !isToAdmin && !isFromClientOrConsultant) return;

            // Determine the "other party" (the person admin is talking with)
            let otherPartyEmail: string;
            let otherPartyName: string;
            let otherPartyRole: string;
            let otherPartyId: string;

            if (isFromAdmin) {
                // Admin sent this message - other party is the recipient
                otherPartyEmail = msg.to.email;
                otherPartyName = msg.to.name;
                otherPartyRole = msg.to.role || "client";
                otherPartyId = msg.to.id || msg.clientId || msg.to.email;
            } else {
                // Someone sent TO admin - other party is the sender
                otherPartyEmail = msg.from.email;
                otherPartyName = msg.from.name;
                otherPartyRole = msg.from.role;
                otherPartyId = msg.from.id || msg.clientId || msg.from.email;
            }

            const threadKey = msg.threadId || otherPartyEmail;
            const existing = threadMap.get(threadKey);

            if (!existing) {
                threadMap.set(threadKey, {
                    id: threadKey,
                    subject: msg.subject,
                    senderName: otherPartyName,
                    senderEmail: otherPartyEmail,
                    senderRole: otherPartyRole,
                    senderId: otherPartyId || "",
                    lastMessage: msg.body.substring(0, 100),
                    lastMessageTime: msg.timestamp,
                    unreadCount: (!msg.read && !isFromAdmin) ? 1 : 0,
                    starred: msg.starred,
                    messageCount: 1,
                });
            } else {
                if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = msg.body.substring(0, 100);
                    existing.lastMessageTime = msg.timestamp;
                }
                if (!msg.read && !isFromAdmin) existing.unreadCount++;
                if (msg.starred) existing.starred = true;
                existing.messageCount++;
            }
        });

        return Array.from(threadMap.values()).sort(
            (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
    }, [messages, currentView]);

    // Filter threads
    const filteredThreads = useMemo(() => {
        let result = threads;

        switch (currentView) {
            case "starred":
                result = result.filter((t) => t.starred);
                break;
            case "archived":
                result = threads.filter((t) =>
                    messages.some((m) => m.threadId === t.id && (m.deleted || m.archived))
                );
                break;
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.subject.toLowerCase().includes(query) ||
                    t.lastMessage.toLowerCase().includes(query) ||
                    t.senderName.toLowerCase().includes(query) ||
                    t.senderEmail.toLowerCase().includes(query)
            );
        }

        return result;
    }, [threads, currentView, searchQuery, messages]);

    // Get messages for selected thread
    const threadMessages = useMemo(() => {
        if (!selectedThread) return [];
        const thread = threads.find(t => t.id === selectedThread);
        if (!thread) return [];

        return messages
            .filter((m) => {
                // Match by threadId
                if (m.threadId === selectedThread) return true;
                // Or match by email of other party
                if (m.from.email === thread.senderEmail || m.to.email === thread.senderEmail) return true;
                return false;
            })
            .filter(m => !m.deleted)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [messages, selectedThread, threads]);

    // Get selected thread info
    const selectedThreadInfo = useMemo(() => {
        return threads.find(t => t.id === selectedThread);
    }, [threads, selectedThread]);

    // Mark thread as read
    const markThreadAsRead = (threadId: string) => {
        const updated = messages.map((m) =>
            m.threadId === threadId ? { ...m, read: true } : m
        );
        saveMessages(updated);
    };

    // Toggle star
    const toggleStar = (threadId: string) => {
        const updated = messages.map((m) =>
            m.threadId === threadId ? { ...m, starred: !m.starred } : m
        );
        saveMessages(updated);
    };

    // Archive thread
    const archiveThread = (threadId: string) => {
        const updated = messages.map((m) =>
            m.threadId === threadId ? { ...m, archived: true } : m
        );
        saveMessages(updated);
        showToast("Thread archived", "success");
        setSelectedThread(null);
    };

    // Delete thread
    const deleteThread = (threadId: string) => {
        const updated = messages.map((m) =>
            m.threadId === threadId ? { ...m, deleted: true } : m
        );
        saveMessages(updated);
        showToast("Thread deleted", "success");
        setSelectedThread(null);
    };

    // Send message
    const handleSendMessage = () => {
        if (!composeBody.trim()) {
            showToast("Please enter a message", "error");
            return;
        }

        // For new messages, require recipient
        if (!selectedThread && !composeTo) {
            showToast("Please select a recipient", "error");
            return;
        }

        setSending(true);

        // Find recipient info
        let recipientName = "";
        let recipientEmail = "";
        let recipientId = "";
        let recipientRole: "client" | "consultant" = "client";

        if (selectedThreadInfo) {
            // Replying to existing thread
            recipientName = selectedThreadInfo.senderName;
            recipientEmail = selectedThreadInfo.senderEmail;
            recipientId = selectedThreadInfo.senderId;
            recipientRole = selectedThreadInfo.senderRole as "client" | "consultant";
        } else {
            // New message
            recipientEmail = composeTo;
            if (composeToType === "client") {
                const client = clients.find(c => c.email === composeTo);
                if (client) {
                    recipientName = `${client.firstName} ${client.lastName}`;
                    recipientId = client.customerId;
                    recipientRole = "client";
                }
            } else {
                const consultant = consultants.find(c => c.email === composeTo);
                if (consultant) {
                    recipientName = `${consultant.firstName} ${consultant.lastName}`;
                    recipientId = consultant.consultantId;
                    recipientRole = "consultant";
                }
            }
        }

        const threadId = selectedThread || generateId("thread");
        const messageSubject = composeSubject || (selectedThreadInfo ? `Re: ${selectedThreadInfo.subject}` : "Message from Admin");

        const newMessage: Message = {
            id: generateId("msg"),
            threadId,
            from: {
                name: adminName,
                email: adminEmail,
                role: "admin",
            },
            to: {
                name: recipientName || recipientEmail,
                email: recipientEmail,
                role: recipientRole,
                id: recipientId,
            },
            subject: messageSubject,
            body: composeBody,
            timestamp: new Date().toISOString(),
            read: true,
            starred: false,
            archived: false,
            deleted: false,
            clientId: recipientRole === "client" ? recipientId : undefined,
        };

        // Save to admin messages
        const updatedMessages = [...messages, newMessage];
        saveMessages(updatedMessages);

        // Also save to recipient's messages
        if (recipientId || recipientEmail) {
            if (recipientRole === "client" && recipientId) {
                const clientMsgsKey = `timely_client_messages_${recipientId}`;
                const clientMsgs = JSON.parse(localStorage.getItem(clientMsgsKey) || "[]");
                clientMsgs.push({ ...newMessage, read: false });
                localStorage.setItem(clientMsgsKey, JSON.stringify(clientMsgs));
            } else if (recipientRole === "consultant" && recipientId) {
                const consultantMsgsKey = `timely_consultant_messages_${recipientId}`;
                const consultantMsgs = JSON.parse(localStorage.getItem(consultantMsgsKey) || "[]");
                consultantMsgs.push({ ...newMessage, read: false });
                localStorage.setItem(consultantMsgsKey, JSON.stringify(consultantMsgs));
            }
        }

        showToast("Message sent!", "success");

        // Reset compose state
        setComposeBody("");
        setComposeSubject("");
        setComposeTo("");
        setShowCompose(false);
        setSending(false);

        // Select the new/current thread
        setSelectedThread(threadId);
    };

    // Stats - count unread from both clients and consultants
    const stats = useMemo(() => ({
        unread: messages.filter((m) => !m.read && (m.from.role === "client" || m.from.role === "consultant") && !m.archived && !m.deleted).length,
        starred: threads.filter((t) => t.starred).length,
        total: threads.length,
    }), [messages, threads]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [threadMessages]);

    // Mark as read when opening thread
    useEffect(() => {
        if (selectedThread) {
            markThreadAsRead(selectedThread);
        }
    }, [selectedThread]);

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${s.card}`}>
                        {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === "info" && <AlertCircle className="w-5 h-5 text-blue-500" />}
                        <span className={s.text}>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className={`${s.card} border rounded-xl w-full max-w-2xl overflow-hidden`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <h3 className={`text-lg font-semibold ${s.text}`}>New Message</h3>
                            <button onClick={() => setShowCompose(false)} className={`p-2 rounded-lg ${s.cardHover}`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Recipient Type */}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Send To</label>
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={() => { setComposeToType("client"); setComposeTo(""); }}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${composeToType === "client" ? "bg-emerald-600 text-white" : s.button}`}
                                    >
                                        <Users className="w-4 h-4 inline mr-1" /> Client
                                    </button>
                                    <button
                                        onClick={() => { setComposeToType("consultant"); setComposeTo(""); }}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${composeToType === "consultant" ? "bg-blue-600 text-white" : s.button}`}
                                    >
                                        <Briefcase className="w-4 h-4 inline mr-1" /> Consultant
                                    </button>
                                </div>
                                <select
                                    value={composeTo}
                                    onChange={(e) => setComposeTo(e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                >
                                    <option value="">Select {composeToType}...</option>
                                    {composeToType === "client"
                                        ? clients.map((c) => (
                                            <option key={c.customerId} value={c.email}>
                                                {c.firstName} {c.lastName} ({c.email})
                                            </option>
                                        ))
                                        : consultants.map((c) => (
                                            <option key={c.consultantId} value={c.email}>
                                                {c.firstName} {c.lastName} ({c.email})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Subject *</label>
                                <input
                                    type="text"
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                    placeholder="Enter subject..."
                                    className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                />
                            </div>

                            {/* Body */}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Message *</label>
                                <textarea
                                    value={composeBody}
                                    onChange={(e) => setComposeBody(e.target.value)}
                                    placeholder="Type your message..."
                                    rows={8}
                                    className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none`}
                                />
                            </div>
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-2`}>
                            <button onClick={() => setShowCompose(false)} className={`${s.button} px-4 py-2 rounded-lg`}>
                                Cancel
                            </button>
                            <button
                                onClick={handleSendMessage}
                                disabled={sending || !composeTo || !composeSubject.trim() || !composeBody.trim()}
                                className={`${s.buttonPrimary} px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50`}
                            >
                                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className={`text-xl font-semibold ${s.text}`}>Messages</h2>
                    <p className={s.textMuted}>
                        {stats.unread > 0 ? `${stats.unread} unread` : "All caught up!"} • {stats.total} conversation{stats.total !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadMessages} className={`${s.card} border px-3 py-2 rounded-lg ${s.cardHover}`}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => setShowCompose(true)} className={`${s.buttonPrimary} px-4 py-2 rounded-lg flex items-center gap-2`}>
                        <Plus className="w-4 h-4" /> New Message
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`${s.card} border rounded-xl overflow-hidden`}>
                <div className="flex h-[600px]">
                    {/* Sidebar */}
                    <div className={`w-48 border-r ${s.divider} flex flex-col`}>
                        <nav className="p-3 space-y-1">
                            {[
                                { id: "inbox", label: "Inbox", icon: Inbox, count: stats.unread },
                                { id: "starred", label: "Starred", icon: Star, count: stats.starred },
                                { id: "archived", label: "Archived", icon: Archive },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => { setCurrentView(item.id as ViewType); setSelectedThread(null); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${currentView === item.id ? s.cardActive : s.cardHover}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className={`w-4 h-4 ${currentView === item.id ? "text-blue-500" : s.textMuted}`} />
                                        <span className={`text-sm ${currentView === item.id ? s.text : s.textMuted}`}>{item.label}</span>
                                    </div>
                                    {item.count && item.count > 0 && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500 text-white">{item.count}</span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Thread List */}
                    <div className={`w-80 border-r ${s.divider} flex flex-col`}>
                        {/* Search */}
                        <div className="p-3">
                            <div className="relative">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textMuted}`} />
                                <input
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full pl-9 pr-4 py-2 rounded-lg border ${s.input} focus:outline-none text-sm`}
                                />
                            </div>
                        </div>

                        {/* Thread List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className={`w-6 h-6 ${s.textMuted} animate-spin`} />
                                </div>
                            ) : filteredThreads.length === 0 ? (
                                <div className="text-center py-8">
                                    <MessageCircle className={`w-10 h-10 ${s.textSubtle} mx-auto mb-2`} />
                                    <p className={s.textMuted}>No messages yet</p>
                                    <button onClick={() => setShowCompose(true)} className={`${s.buttonPrimary} px-3 py-1.5 rounded-lg text-sm mt-3`}>
                                        Send your first message
                                    </button>
                                </div>
                            ) : (
                                filteredThreads.map((thread) => (
                                    <div
                                        key={thread.id}
                                        onClick={() => setSelectedThread(thread.id)}
                                        className={`p-3 border-b ${s.divider} cursor-pointer transition-colors ${selectedThread === thread.id ? s.cardActive : s.cardHover} ${thread.unreadCount > 0 ? "border-l-2 border-l-blue-500" : ""}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 ${getAvatarColor(thread.senderRole)} rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0`}>
                                                {thread.senderName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`font-medium ${s.text} text-sm truncate`}>{thread.senderName}</p>
                                                        {getRoleIcon(thread.senderRole)}
                                                    </div>
                                                    <span className={`text-xs ${s.textSubtle} ml-2 shrink-0`}>{formatTime(thread.lastMessageTime)}</span>
                                                </div>
                                                <p className={`text-xs ${s.textMuted} mb-0.5 flex items-center gap-1`}>
                                                    <span className={`px-1.5 py-0.5 rounded text-xs ${thread.senderRole === "client" ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500"}`}>
                                                        {thread.senderRole}
                                                    </span>
                                                </p>
                                                <p className={`text-sm ${thread.unreadCount > 0 ? `font-medium ${s.text}` : s.textMuted} truncate`}>
                                                    {thread.subject}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {thread.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                    {thread.unreadCount > 0 && (
                                                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">{thread.unreadCount}</span>
                                                    )}
                                                    <span className={`text-xs ${s.textSubtle}`}>{thread.messageCount} msg</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Message View */}
                    <div className="flex-1 flex flex-col">
                        {!selectedThread ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <Mail className={`w-12 h-12 ${s.textSubtle} mx-auto mb-3`} />
                                    <p className={s.textMuted}>Select a conversation to view messages</p>
                                    <button onClick={() => setShowCompose(true)} className={`${s.buttonPrimary} px-4 py-2 rounded-lg mt-4 inline-flex items-center gap-2`}>
                                        <Plus className="w-4 h-4" /> New Message
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Thread Header */}
                                <div className={`p-4 border-b ${s.divider} flex items-center justify-between`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 ${getAvatarColor(selectedThreadInfo?.senderRole || "client")} rounded-full flex items-center justify-center text-white font-medium`}>
                                            {selectedThreadInfo?.senderName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold ${s.text}`}>{selectedThreadInfo?.senderName}</h3>
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${selectedThreadInfo?.senderRole === "client" ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500"}`}>
                                                    {selectedThreadInfo?.senderRole}
                                                </span>
                                            </div>
                                            <p className={`text-xs ${s.textMuted}`}>{selectedThreadInfo?.senderEmail}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => toggleStar(selectedThread)} className={`p-2 rounded-lg ${s.cardHover}`}>
                                            <Star className={`w-4 h-4 ${selectedThreadInfo?.starred ? "text-amber-500 fill-amber-500" : s.textMuted}`} />
                                        </button>
                                        <button onClick={() => archiveThread(selectedThread)} className={`p-2 rounded-lg ${s.cardHover}`}>
                                            <Archive className={`w-4 h-4 ${s.textMuted}`} />
                                        </button>
                                        <button onClick={() => deleteThread(selectedThread)} className={`p-2 rounded-lg ${s.cardHover}`}>
                                            <Trash2 className={`w-4 h-4 ${s.textMuted}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Subject */}
                                <div className={`px-4 py-2 border-b ${s.divider}`}>
                                    <p className={`text-sm ${s.textMuted}`}>Subject: <span className={s.text}>{threadMessages[0]?.subject || selectedThreadInfo?.subject || "No Subject"}</span></p>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {threadMessages.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className={s.textMuted}>No messages in this thread</p>
                                        </div>
                                    ) : (
                                        threadMessages.map((msg) => {
                                            const isOwn = msg.from.role === "admin";
                                            return (
                                                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[80%]`}>
                                                        {!isOwn && (
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className={`w-6 h-6 ${getAvatarColor(msg.from.role)} rounded-full flex items-center justify-center text-white text-xs`}>
                                                                    {msg.from.name[0]?.toUpperCase()}
                                                                </div>
                                                                <span className={`text-sm font-medium ${s.text}`}>{msg.from.name}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${msg.from.role === "client" ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500"}`}>
                                                                    {msg.from.role}
                                                                </span>
                                                                <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                            </div>
                                                        )}
                                                        <div className={`p-3 rounded-xl ${isOwn ? "bg-purple-600 text-white" : s.cardInner}`}>
                                                            <p className={`text-sm whitespace-pre-wrap ${isOwn ? "text-white" : s.text}`}>{msg.body}</p>
                                                        </div>
                                                        {isOwn && (
                                                            <div className="flex items-center justify-end gap-1 mt-1">
                                                                <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                                <CheckCheck className="w-3 h-3 text-purple-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messageEndRef} />
                                </div>

                                {/* Reply Box */}
                                <div className={`p-4 border-t ${s.divider}`}>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={composeBody}
                                            onChange={(e) => setComposeBody(e.target.value)}
                                            placeholder="Type your reply..."
                                            rows={2}
                                            className={`flex-1 px-4 py-2 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none`}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (composeBody.trim()) {
                                                        handleSendMessage();
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!composeBody.trim() || sending}
                                            className={`${s.buttonPrimary} px-4 rounded-lg disabled:opacity-50`}
                                        >
                                            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminMessages;