// src/ClientPortal_views/ClientMessages.tsx
// Client messaging system - send/receive messages with assigned consultants and admins
// Messages are stored in localStorage and visible to both parties

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    MessageCircle, Send, Search, Inbox, Star, Trash2, Archive,
    Paperclip, X, ChevronLeft, RefreshCw, CheckCheck, Mail, Reply,
    AlertCircle, CheckCircle, Plus, Users, Shield, Briefcase, Info,
    MoreVertical, Clock, Smile
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

type ClientMessagesProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
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
    attachments?: { name: string; size: number; base64?: string }[];
    replyTo?: string;
}

interface Thread {
    id: string;
    subject: string;
    participants: { name: string; email: string; role: string }[];
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    starred: boolean;
    archived: boolean;
}

interface Contact {
    id: string;
    name: string;
    email: string;
    role: "consultant" | "admin" | "support";
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

type ViewType = "inbox" | "starred" | "archived" | "trash";

const STORAGE_KEY = "timely_client_messages";

// Generate unique ID
const generateId = (prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const ClientMessages: React.FC<ClientMessagesProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800/80" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        cardActive: isDark ? "bg-blue-600/20" : "bg-blue-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-800" : "border-gray-200",
        button: isDark ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
        buttonDanger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white",
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
        // Interactive
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200",
    };

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewType>("inbox");
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showCompose, setShowCompose] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Compose state
    const [composeTo, setComposeTo] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [sending, setSending] = useState(false);

    // Contacts - consultants and admins
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);

    const messageEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Toast notification
    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = generateId("toast");
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    // Load messages and contacts
    useEffect(() => {
        loadMessages();
        loadContacts();
    }, [customerId]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const stored = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            if (stored) {
                setMessages(JSON.parse(stored));
            } else {
                // Welcome message
                const welcomeMessage: Message = {
                    id: generateId("msg"),
                    threadId: "thread_welcome",
                    from: {
                        name: "Timely Support",
                        email: "support@timely.com",
                        role: "system",
                    },
                    to: {
                        name: userName,
                        email: userEmail,
                    },
                    subject: "Welcome to Timely Client Portal",
                    body: `Hi ${userName.split(" ")[0]},\n\nWelcome to the Timely Client Portal! This is your secure messaging center where you can communicate directly with your assigned consultant and our admin team.\n\nHow to use Messages:\n• Click "Compose" to start a new conversation\n• Select a consultant or admin from your contacts\n• All messages are securely stored and visible to both parties\n\nFeel free to reach out if you have any questions about your projects or documents.\n\nBest regards,\nThe Timely Team`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    starred: false,
                    archived: false,
                    deleted: false,
                };
                setMessages([welcomeMessage]);
                saveMessages([welcomeMessage]);
            }
        } catch (e) {
            console.error("Error loading messages:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadContacts = async () => {
        setLoadingContacts(true);
        const contactsList: Contact[] = [];

        try {
            // 1. Get assigned consultants for this client
            const clientConsultantsRes = await fetch(`${API_BASE}/client-consultants?clientId=${customerId}`);
            if (clientConsultantsRes.ok) {
                const ccData = await clientConsultantsRes.json();
                const assignedConsultantIds = new Set((ccData.data || []).map((cc: any) => String(cc.consultantId)));

                // Get consultant details
                if (assignedConsultantIds.size > 0) {
                    const consultantsRes = await fetch(`${API_BASE}/consultants`);
                    if (consultantsRes.ok) {
                        const consultantsData = await consultantsRes.json();
                        (consultantsData.data || []).forEach((c: any) => {
                            if (assignedConsultantIds.has(String(c.consultantId))) {
                                contactsList.push({
                                    id: c.consultantId,
                                    name: `${c.firstName} ${c.lastName}`,
                                    email: c.email,
                                    role: "consultant",
                                });
                            }
                        });
                    }
                }
            }

            // 2. Get all admins from users-report (role = admin)
            const usersRes = await fetch(`${API_BASE}/users-report`);
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                (usersData.data || []).forEach((u: any) => {
                    if (u.role === "admin") {
                        contactsList.push({
                            id: u.customerId,
                            name: `${u.firstName} ${u.lastName}`,
                            email: u.email,
                            role: "admin",
                        });
                    }
                });
            }

            // 3. Also check consultants with admin role
            const consultantsRes = await fetch(`${API_BASE}/consultants`);
            if (consultantsRes.ok) {
                const consultantsData = await consultantsRes.json();
                (consultantsData.data || []).forEach((c: any) => {
                    if (c.role === "admin" || c.role === "Admin") {
                        // Check if already added
                        const exists = contactsList.some(contact => contact.email === c.email);
                        if (!exists) {
                            contactsList.push({
                                id: c.consultantId,
                                name: `${c.firstName} ${c.lastName}`,
                                email: c.email,
                                role: "admin",
                            });
                        }
                    }
                });
            }

        } catch (e) {
            console.error("Error loading contacts:", e);
        }

        // Always add support as fallback
        contactsList.push({
            id: "support",
            name: "Timely Support",
            email: "support@timely.com",
            role: "support" as any,
        });

        setContacts(contactsList);
        setLoadingContacts(false);
    };

    const saveMessages = (newMessages: Message[]) => {
        setMessages(newMessages);
        localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(newMessages));
    };

    // Also save to recipient's inbox (for admin/consultant to see)
    const saveToRecipientInbox = (message: Message, recipientId: string, recipientRole: string) => {
        // For admins, save to admin notifications
        if (recipientRole === "admin") {
            const adminNotifs = JSON.parse(localStorage.getItem("timely_admin_messages") || "[]");
            adminNotifs.push({
                ...message,
                clientId: customerId,
                clientName: userName,
                recipientId,
            });
            localStorage.setItem("timely_admin_messages", JSON.stringify(adminNotifs));
        }

        // For consultants, save to consultant messages
        if (recipientRole === "consultant") {
            const consultantMsgs = JSON.parse(localStorage.getItem(`timely_consultant_messages_${recipientId}`) || "[]");
            consultantMsgs.push({
                ...message,
                clientId: customerId,
                clientName: userName,
            });
            localStorage.setItem(`timely_consultant_messages_${recipientId}`, JSON.stringify(consultantMsgs));
        }

        // Also save to a global inbox for easy admin viewing
        const globalInbox = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
        globalInbox.push({
            ...message,
            clientId: customerId,
            clientName: userName,
            recipientId,
            recipientRole,
        });
        localStorage.setItem("timely_global_messages", JSON.stringify(globalInbox));
    };

    // Get threads from messages
    const threads = useMemo(() => {
        const threadMap = new Map<string, Thread>();

        messages.forEach((msg) => {
            if (msg.deleted && currentView !== "trash") return;
            if (msg.archived && currentView !== "archived" && currentView !== "trash") return;

            const existing = threadMap.get(msg.threadId);
            if (!existing) {
                threadMap.set(msg.threadId, {
                    id: msg.threadId,
                    subject: msg.subject,
                    participants: [msg.from, msg.to],
                    lastMessage: msg.body.substring(0, 100),
                    lastMessageTime: msg.timestamp,
                    unreadCount: msg.read ? 0 : 1,
                    starred: msg.starred,
                    archived: msg.archived,
                });
            } else {
                if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = msg.body.substring(0, 100);
                    existing.lastMessageTime = msg.timestamp;
                }
                if (!msg.read) existing.unreadCount++;
                if (msg.starred) existing.starred = true;
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
                result = result.filter((t) => messages.some((m) => m.threadId === t.id && m.archived && !m.deleted));
                break;
            case "trash":
                result = threads.filter((t) => messages.some((m) => m.threadId === t.id && m.deleted));
                break;
            case "inbox":
            default:
                result = result.filter((t) => !t.archived);
                break;
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.subject.toLowerCase().includes(query) ||
                    t.lastMessage.toLowerCase().includes(query) ||
                    t.participants.some((p) => p.name.toLowerCase().includes(query))
            );
        }

        return result;
    }, [threads, currentView, searchQuery, messages]);

    // Get messages for selected thread
    const threadMessages = useMemo(() => {
        if (!selectedThread) return [];
        return messages
            .filter((m) => m.threadId === selectedThread)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [messages, selectedThread]);

    // Mark thread as read
    const markThreadAsRead = (threadId: string) => {
        const updated = messages.map((m) => (m.threadId === threadId ? { ...m, read: true } : m));
        saveMessages(updated);
    };

    // Toggle star
    const toggleStar = (threadId: string) => {
        const updated = messages.map((m) => (m.threadId === threadId ? { ...m, starred: !m.starred } : m));
        saveMessages(updated);
    };

    // Archive thread
    const archiveThread = (threadId: string) => {
        const updated = messages.map((m) => (m.threadId === threadId ? { ...m, archived: true } : m));
        saveMessages(updated);
        showToast("Thread archived", "success");
        setSelectedThread(null);
    };

    // Delete thread
    const deleteThread = (threadId: string) => {
        const updated = messages.map((m) => (m.threadId === threadId ? { ...m, deleted: true } : m));
        saveMessages(updated);
        showToast("Thread moved to trash", "success");
        setSelectedThread(null);
    };

    // Permanently delete
    const permanentlyDelete = (threadId: string) => {
        if (confirm("Permanently delete this conversation? This cannot be undone.")) {
            const updated = messages.filter((m) => m.threadId !== threadId);
            saveMessages(updated);
            showToast("Thread permanently deleted", "success");
            setSelectedThread(null);
        }
    };

    // Restore from trash
    const restoreThread = (threadId: string) => {
        const updated = messages.map((m) => (m.threadId === threadId ? { ...m, deleted: false, archived: false } : m));
        saveMessages(updated);
        showToast("Thread restored", "success");
    };

    // Send message
    const handleSend = () => {
        if (!composeTo || !composeSubject.trim() || !composeBody.trim()) {
            showToast("Please fill in all fields", "error");
            return;
        }

        setSending(true);

        const contact = contacts.find((c) => c.email === composeTo);
        if (!contact) {
            showToast("Invalid recipient", "error");
            setSending(false);
            return;
        }

        const threadId = replyingTo?.threadId || generateId("thread");

        const newMessage: Message = {
            id: generateId("msg"),
            threadId,
            from: {
                name: userName,
                email: userEmail,
                role: "client",
                id: customerId,
            },
            to: {
                name: contact.name,
                email: contact.email,
                role: contact.role,
                id: contact.id,
            },
            subject: replyingTo ? `Re: ${replyingTo.subject.replace(/^Re: /, "")}` : composeSubject,
            body: composeBody,
            timestamp: new Date().toISOString(),
            read: true,
            starred: false,
            archived: false,
            deleted: false,
            replyTo: replyingTo?.id,
        };

        // Save to client's messages
        saveMessages([...messages, newMessage]);

        // Save to recipient's inbox
        saveToRecipientInbox(newMessage, contact.id, contact.role);

        // Create notification for recipient
        const notifKey = contact.role === "admin" ? "timely_admin_notifications" : `timely_consultant_notifications_${contact.id}`;
        const notifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
        notifs.push({
            id: generateId("notif"),
            type: "new_message",
            from: userName,
            fromEmail: userEmail,
            clientId: customerId,
            subject: newMessage.subject,
            preview: composeBody.substring(0, 100),
            threadId: newMessage.threadId,
            timestamp: new Date().toISOString(),
            read: false,
        });
        localStorage.setItem(notifKey, JSON.stringify(notifs));

        showToast("Message sent!", "success");

        // Reset compose
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        setShowCompose(false);
        setReplyingTo(null);
        setSending(false);
        setSelectedThread(threadId);
    };

    // Open reply
    const handleReply = (message: Message) => {
        setReplyingTo(message);
        setComposeTo(message.from.email === userEmail ? message.to.email : message.from.email);
        setComposeSubject(`Re: ${message.subject.replace(/^Re: /, "")}`);
        setComposeBody("");
        setShowCompose(true);
    };

    // Format time
    const formatTime = (ts: string) => {
        const date = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 86400000) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (diff < 604800000) return date.toLocaleDateString("en-US", { weekday: "short" });
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    // Get avatar gradient based on role
    const getAvatarGradient = (role: string) => {
        switch (role) {
            case "consultant": return "from-blue-500 to-blue-600";
            case "admin": return "from-purple-500 to-purple-600";
            case "system": return "from-emerald-500 to-emerald-600";
            case "support": return "from-emerald-500 to-emerald-600";
            case "client": return "from-amber-500 to-amber-600";
            default: return "from-gray-500 to-gray-600";
        }
    };

    // Get avatar shadow based on role
    const getAvatarShadow = (role: string) => {
        switch (role) {
            case "consultant": return "shadow-blue-500/30";
            case "admin": return "shadow-purple-500/30";
            case "system": return "shadow-emerald-500/30";
            case "support": return "shadow-emerald-500/30";
            case "client": return "shadow-amber-500/30";
            default: return "shadow-gray-500/30";
        }
    };

    // Get role icon
    const getRoleIcon = (role: string) => {
        switch (role) {
            case "consultant": return Briefcase;
            case "admin": return Shield;
            default: return Users;
        }
    };

    // Stats
    const stats = useMemo(() => ({
        unread: messages.filter((m) => !m.read && !m.archived && !m.deleted).length,
        starred: threads.filter((t) => t.starred).length,
        total: threads.length,
    }), [messages, threads]);

    // Scroll to bottom
    useEffect(() => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [threadMessages]);

    // Mark as read when opening
    useEffect(() => {
        if (selectedThread) {
            markThreadAsRead(selectedThread);
        }
    }, [selectedThread]);

    // Group contacts by role
    const consultants = contacts.filter(c => c.role === "consultant");
    const admins = contacts.filter(c => c.role === "admin");
    const support = contacts.filter(c => c.role === "support");

    return (
        <div className={`${s.bg} min-h-full`}>
            {/* Toast Notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${s.card} animate-in slide-in-from-right duration-300`}
                    >
                        {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === "info" && <Info className="w-5 h-5 text-blue-500" />}
                        <span className={s.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={`ml-2 ${s.textMuted} hover:${s.text}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`${s.card} border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    {replyingTo ? <Reply className="w-5 h-5 text-white" /> : <Mail className="w-5 h-5 text-white" />}
                                </div>
                                <h3 className={`text-lg font-bold ${s.text}`}>
                                    {replyingTo ? "Reply to Message" : "New Message"}
                                </h3>
                            </div>
                            <button
                                onClick={() => { setShowCompose(false); setReplyingTo(null); }}
                                className={`p-2 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                            >
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* To */}
                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>To *</label>
                                <select
                                    value={composeTo}
                                    onChange={(e) => setComposeTo(e.target.value)}
                                    disabled={!!replyingTo}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${replyingTo ? "opacity-60" : ""}`}
                                >
                                    <option value="">Select recipient...</option>
                                    {consultants.length > 0 && (
                                        <optgroup label="Your Consultants">
                                            {consultants.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name} (Consultant)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {admins.length > 0 && (
                                        <optgroup label="Admins">
                                            {admins.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name} (Admin)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {support.length > 0 && (
                                        <optgroup label="Support">
                                            {support.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {contacts.length === 1 && contacts[0].role === "support" && (
                                    <p className={`text-xs ${s.textMuted} mt-2`}>
                                        No consultants assigned yet. Contact support for assistance.
                                    </p>
                                )}
                            </div>

                            {/* Subject */}
                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>Subject *</label>
                                <input
                                    type="text"
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                    placeholder="Enter subject..."
                                    disabled={!!replyingTo}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${replyingTo ? "opacity-60" : ""}`}
                                />
                            </div>

                            {/* Body */}
                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>Message *</label>
                                <textarea
                                    value={composeBody}
                                    onChange={(e) => setComposeBody(e.target.value)}
                                    placeholder="Type your message..."
                                    rows={8}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all duration-200`}
                                />
                            </div>
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-3`}>
                            <button
                                onClick={() => { setShowCompose(false); setReplyingTo(null); }}
                                className={`${s.button} px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending || !composeTo || !composeSubject.trim() || !composeBody.trim()}
                                className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0`}
                            >
                                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? "Sending..." : "Send Message"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className={`text-2xl font-bold ${s.text}`}>Messages</h1>
                        <p className={`text-sm ${s.textMuted} mt-1`}>
                            {stats.unread > 0 ? `${stats.unread} unread message${stats.unread > 1 ? 's' : ''}` : "All caught up!"}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCompose(true)}
                        className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                    >
                        <Plus className="w-4 h-4" /> Compose
                    </button>
                </div>

                <div className={`${s.card} border rounded-2xl overflow-hidden shadow-xl`}>
                    <div className="flex h-[600px]">
                        {/* Sidebar */}
                        <div className={`w-64 border-r ${s.divider} flex flex-col`}>
                            {/* Navigation */}
                            <nav className="p-3 space-y-1">
                                {[
                                    { id: "inbox", label: "Inbox", icon: Inbox, count: stats.unread, color: "blue" },
                                    { id: "starred", label: "Starred", icon: Star, count: stats.starred, color: "amber" },
                                    { id: "archived", label: "Archived", icon: Archive, color: "gray" },
                                    { id: "trash", label: "Trash", icon: Trash2, color: "red" },
                                ].map((item) => {
                                    const isActive = currentView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { setCurrentView(item.id as ViewType); setSelectedThread(null); }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] group ${isActive
                                                    ? `${s.cardActive} shadow-md`
                                                    : s.cardHover
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive
                                                        ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                                                        : `${isDark ? "bg-slate-700" : "bg-gray-100"} group-hover:scale-105`
                                                    }`}>
                                                    <item.icon className={`w-4 h-4 ${isActive ? "text-white" : s.textMuted}`} />
                                                </div>
                                                <span className={`font-medium ${isActive ? s.text : s.textMuted}`}>{item.label}</span>
                                            </div>
                                            {item.count !== undefined && item.count > 0 && (
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isActive
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-red-500 text-white"
                                                    }`}>
                                                    {item.count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>

                            {/* Contacts */}
                            <div className={`p-3 border-t ${s.divider} flex-1 overflow-y-auto`}>
                                <p className={`text-xs font-bold ${s.textMuted} uppercase tracking-wider mb-3`}>Contacts</p>
                                {loadingContacts ? (
                                    <div className="flex items-center justify-center py-8">
                                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {/* Consultants */}
                                        {consultants.length > 0 && (
                                            <>
                                                <p className={`text-xs ${s.textSubtle} mt-2 mb-2 flex items-center gap-1.5 font-medium`}>
                                                    <Briefcase className="w-3 h-3" /> Your Consultants
                                                </p>
                                                {consultants.map((contact, index) => (
                                                    <button
                                                        key={contact.id}
                                                        onClick={() => { setComposeTo(contact.email); setShowCompose(true); }}
                                                        style={{ animationDelay: `${index * 50}ms` }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-[0.98] group animate-in fade-in slide-in-from-left`}
                                                    >
                                                        <div className={`w-9 h-9 bg-gradient-to-br ${getAvatarGradient(contact.role)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg ${getAvatarShadow(contact.role)} group-hover:scale-105 transition-transform`}>
                                                            {contact.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                                                        </div>
                                                        <div className="text-left min-w-0">
                                                            <p className={`text-sm font-medium ${s.text} truncate group-hover:text-blue-500 transition-colors`}>{contact.name}</p>
                                                            <p className={`text-xs ${s.textMuted}`}>Consultant</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* Admins */}
                                        {admins.length > 0 && (
                                            <>
                                                <p className={`text-xs ${s.textSubtle} mt-4 mb-2 flex items-center gap-1.5 font-medium`}>
                                                    <Shield className="w-3 h-3" /> Admins
                                                </p>
                                                {admins.map((contact, index) => (
                                                    <button
                                                        key={contact.id}
                                                        onClick={() => { setComposeTo(contact.email); setShowCompose(true); }}
                                                        style={{ animationDelay: `${(consultants.length + index) * 50}ms` }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-[0.98] group animate-in fade-in slide-in-from-left`}
                                                    >
                                                        <div className={`w-9 h-9 bg-gradient-to-br ${getAvatarGradient(contact.role)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg ${getAvatarShadow(contact.role)} group-hover:scale-105 transition-transform`}>
                                                            {contact.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                                                        </div>
                                                        <div className="text-left min-w-0">
                                                            <p className={`text-sm font-medium ${s.text} truncate group-hover:text-purple-500 transition-colors`}>{contact.name}</p>
                                                            <p className={`text-xs ${s.textMuted}`}>Admin</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* Support */}
                                        {support.map((contact, index) => (
                                            <button
                                                key={contact.id}
                                                onClick={() => { setComposeTo(contact.email); setShowCompose(true); }}
                                                style={{ animationDelay: `${(consultants.length + admins.length + index) * 50}ms` }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.cardHover} mt-4 transition-all duration-200 hover:shadow-md active:scale-[0.98] group animate-in fade-in slide-in-from-left`}
                                            >
                                                <div className={`w-9 h-9 bg-gradient-to-br ${getAvatarGradient(contact.role)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg ${getAvatarShadow(contact.role)} group-hover:scale-105 transition-transform`}>
                                                    TS
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <p className={`text-sm font-medium ${s.text} truncate group-hover:text-emerald-500 transition-colors`}>{contact.name}</p>
                                                    <p className={`text-xs ${s.textMuted}`}>Support</p>
                                                </div>
                                            </button>
                                        ))}

                                        {consultants.length === 0 && admins.length === 0 && (
                                            <div className={`text-center py-6 ${s.cardInner} rounded-xl`}>
                                                <Users className={`w-8 h-8 ${s.textSubtle} mx-auto mb-2`} />
                                                <p className={`text-xs ${s.textMuted}`}>
                                                    No consultants assigned yet
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Thread List / Message View */}
                        <div className="flex-1 flex">
                            {/* Thread List */}
                            <div className={`w-80 border-r ${s.divider} flex flex-col`}>
                                {/* Search */}
                                <div className="p-3">
                                    <div className="relative group">
                                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textMuted} group-focus-within:text-blue-500 transition-colors`} />
                                        <input
                                            type="text"
                                            placeholder="Search messages..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200`}
                                        />
                                    </div>
                                </div>

                                {/* Thread List */}
                                <div className="flex-1 overflow-y-auto">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                            <p className={s.textMuted}>Loading messages...</p>
                                        </div>
                                    ) : filteredThreads.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className={`w-16 h-16 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-4`}>
                                                <MessageCircle className={`w-8 h-8 ${s.textSubtle}`} />
                                            </div>
                                            <p className={`font-semibold ${s.text} mb-1`}>No messages</p>
                                            <p className={`text-sm ${s.textMuted}`}>Start a conversation!</p>
                                        </div>
                                    ) : (
                                        <div className={`divide-y ${s.divider}`}>
                                            {filteredThreads.map((thread, index) => {
                                                const isSelected = selectedThread === thread.id;
                                                const participant = thread.participants.find((p) => p.email !== userEmail);
                                                return (
                                                    <div
                                                        key={thread.id}
                                                        onClick={() => setSelectedThread(thread.id)}
                                                        style={{ animationDelay: `${index * 30}ms` }}
                                                        className={`p-4 cursor-pointer transition-all duration-200 group animate-in fade-in slide-in-from-left ${isSelected
                                                                ? `${s.cardActive} border-l-4 border-l-blue-500`
                                                                : `${s.cardHover} border-l-4 border-l-transparent hover:border-l-blue-500/50`
                                                            } ${thread.unreadCount > 0 ? "bg-blue-500/5" : ""}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarGradient(participant?.role || 'system')} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg ${getAvatarShadow(participant?.role || 'system')} group-hover:scale-105 transition-transform shrink-0`}>
                                                                {participant?.name[0] || "?"}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <p className={`font-semibold ${s.text} text-sm truncate`}>
                                                                        {participant?.name || "Unknown"}
                                                                    </p>
                                                                    <span className={`text-xs ${s.textSubtle} ml-2 shrink-0`}>{formatTime(thread.lastMessageTime)}</span>
                                                                </div>
                                                                <p className={`text-sm ${thread.unreadCount > 0 ? `font-semibold ${s.text}` : s.textMuted} truncate`}>
                                                                    {thread.subject}
                                                                </p>
                                                                <p className={`text-xs ${s.textMuted} truncate mt-0.5`}>{thread.lastMessage}</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    {thread.starred && (
                                                                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                    )}
                                                                    {thread.unreadCount > 0 && (
                                                                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white animate-pulse">
                                                                            {thread.unreadCount}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Message View */}
                            <div className="flex-1 flex flex-col">
                                {!selectedThread ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className={`w-20 h-20 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-4`}>
                                                <Mail className={`w-10 h-10 ${s.textSubtle}`} />
                                            </div>
                                            <p className={`font-semibold ${s.text} mb-2`}>Select a conversation</p>
                                            <p className={`text-sm ${s.textMuted} mb-4`}>Choose a message to read or start a new one</p>
                                            <button
                                                onClick={() => setShowCompose(true)}
                                                className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                                            >
                                                <Plus className="w-4 h-4" /> Start New Conversation
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Thread Header */}
                                        <div className={`p-4 border-b ${s.divider} flex items-center justify-between`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <button onClick={() => setSelectedThread(null)} className={`p-2 rounded-xl ${s.cardHover} md:hidden transition-all duration-200 active:scale-95`}>
                                                    <ChevronLeft className={`w-5 h-5 ${s.textMuted}`} />
                                                </button>
                                                <div className="min-w-0">
                                                    <h3 className={`font-bold ${s.text} truncate`}>{threadMessages[0]?.subject || "No Subject"}</h3>
                                                    <p className={`text-xs ${s.textMuted} flex items-center gap-1`}>
                                                        <Clock className="w-3 h-3" />
                                                        {threadMessages.length} message{threadMessages.length !== 1 ? "s" : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => toggleStar(selectedThread)}
                                                    className={`p-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95 ${threads.find((t) => t.id === selectedThread)?.starred ? "bg-amber-500/20" : s.cardHover
                                                        }`}
                                                >
                                                    <Star className={`w-4 h-4 ${threads.find((t) => t.id === selectedThread)?.starred ? "text-amber-500 fill-amber-500" : s.textMuted}`} />
                                                </button>
                                                <button
                                                    onClick={() => archiveThread(selectedThread)}
                                                    className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                                                >
                                                    <Archive className={`w-4 h-4 ${s.textMuted}`} />
                                                </button>
                                                {currentView === "trash" ? (
                                                    <>
                                                        <button
                                                            onClick={() => restoreThread(selectedThread)}
                                                            className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                                                        >
                                                            <RefreshCw className={`w-4 h-4 ${s.textMuted}`} />
                                                        </button>
                                                        <button
                                                            onClick={() => permanentlyDelete(selectedThread)}
                                                            className={`p-2.5 rounded-xl hover:bg-red-500/20 transition-all duration-200 hover:shadow-md active:scale-95`}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => deleteThread(selectedThread)}
                                                        className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95 hover:text-red-500`}
                                                    >
                                                        <Trash2 className={`w-4 h-4 ${s.textMuted}`} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                            {threadMessages.map((msg, index) => {
                                                const isOwn = msg.from.email === userEmail;
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        style={{ animationDelay: `${index * 50}ms` }}
                                                        className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom duration-300`}
                                                    >
                                                        <div className={`max-w-[80%] ${isOwn ? "order-2" : ""}`}>
                                                            {!isOwn && (
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarGradient(msg.from.role)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg ${getAvatarShadow(msg.from.role)}`}>
                                                                        {msg.from.name[0]}
                                                                    </div>
                                                                    <span className={`text-sm font-semibold ${s.text}`}>{msg.from.name}</span>
                                                                    <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                                </div>
                                                            )}
                                                            <div className={`p-4 rounded-2xl transition-all duration-200 hover:shadow-md ${isOwn
                                                                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 rounded-br-md"
                                                                    : `${s.cardInner} border ${s.divider} rounded-bl-md`
                                                                }`}>
                                                                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isOwn ? "text-white" : s.text}`}>{msg.body}</p>
                                                            </div>
                                                            {isOwn && (
                                                                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                                                    <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                                    <CheckCheck className="w-4 h-4 text-blue-500" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messageEndRef} />
                                        </div>

                                        {/* Reply Box */}
                                        <div className={`p-4 border-t ${s.divider}`}>
                                            <button
                                                onClick={() => handleReply(threadMessages[threadMessages.length - 1])}
                                                className={`w-full ${s.cardInner} border ${s.divider} rounded-xl px-4 py-4 text-left transition-all duration-200 hover:shadow-md hover:border-blue-500/50 active:scale-[0.99] flex items-center gap-3 group`}
                                            >
                                                <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform`}>
                                                    <Reply className="w-5 h-5 text-white" />
                                                </div>
                                                <span className={`${s.textMuted} group-hover:${s.text} transition-colors`}>Click to reply to this conversation...</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientMessages;