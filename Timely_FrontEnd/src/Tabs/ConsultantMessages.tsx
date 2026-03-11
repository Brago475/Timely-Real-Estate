// src/Tabs/ConsultantMessages.tsx
// Consultant messaging - can message ONLY assigned clients, other consultants, and admins
// Messages sync with client and admin inboxes via localStorage

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    MessageCircle, Send, Search, Inbox, Star, Trash2, Archive,
    X, ChevronLeft, RefreshCw, CheckCheck, Mail, Reply,
    AlertCircle, CheckCircle, Plus, Users, User, Clock,
    Shield, Briefcase
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

interface Contact {
    id: string;
    name: string;
    email: string;
    role: "client" | "consultant" | "admin";
}

interface Thread {
    id: string;
    subject: string;
    participantName: string;
    participantEmail: string;
    participantRole: string;
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

interface ConsultantMessagesProps {
    consultantId?: string;
    consultantEmail?: string;
    consultantName?: string;
}

const ConsultantMessages: React.FC<ConsultantMessagesProps> = ({
    consultantId = "",
    consultantEmail = "",
    consultantName = "Consultant",
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
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewType>("inbox");
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Contacts
    const [assignedClients, setAssignedClients] = useState<Contact[]>([]);
    const [otherConsultants, setOtherConsultants] = useState<Contact[]>([]);
    const [admins, setAdmins] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);

    // Compose state
    const [showCompose, setShowCompose] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [composeTo, setComposeTo] = useState("");
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
        loadContacts();
    }, [consultantId]);

    const loadContacts = async () => {
        setLoadingContacts(true);
        const clients: Contact[] = [];
        const consultants: Contact[] = [];
        const adminList: Contact[] = [];

        try {
            // 1. Get assigned clients for this consultant
            const ccRes = await fetch(`${API_BASE}/client-consultants?consultantId=${consultantId}`);
            if (ccRes.ok) {
                const ccData = await ccRes.json();
                const assignedClientIds = new Set((ccData.data || []).map((cc: any) => cc.clientId));

                // Get client details
                if (assignedClientIds.size > 0) {
                    const usersRes = await fetch(`${API_BASE}/users-report`);
                    if (usersRes.ok) {
                        const usersData = await usersRes.json();
                        (usersData.data || []).forEach((u: any) => {
                            if (assignedClientIds.has(u.customerId)) {
                                clients.push({
                                    id: u.customerId,
                                    name: `${u.firstName} ${u.lastName}`,
                                    email: u.email,
                                    role: "client",
                                });
                            }
                        });
                    }
                }
            }

            // 2. Get other consultants
            const consultantsRes = await fetch(`${API_BASE}/consultants`);
            if (consultantsRes.ok) {
                const consultantsData = await consultantsRes.json();
                (consultantsData.data || []).forEach((c: any) => {
                    // Exclude self
                    if (c.consultantId !== consultantId) {
                        // Check if admin
                        if (c.role === "admin" || c.role === "Admin") {
                            adminList.push({
                                id: c.consultantId,
                                name: `${c.firstName} ${c.lastName}`,
                                email: c.email,
                                role: "admin",
                            });
                        } else {
                            consultants.push({
                                id: c.consultantId,
                                name: `${c.firstName} ${c.lastName}`,
                                email: c.email,
                                role: "consultant",
                            });
                        }
                    }
                });
            }

            // 3. Get admins from users-report
            const usersRes = await fetch(`${API_BASE}/users-report`);
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                (usersData.data || []).forEach((u: any) => {
                    if (u.role === "admin") {
                        // Check if already added
                        const exists = adminList.some(a => a.email === u.email);
                        if (!exists) {
                            adminList.push({
                                id: u.customerId,
                                name: `${u.firstName} ${u.lastName}`,
                                email: u.email,
                                role: "admin",
                            });
                        }
                    }
                });
            }

        } catch (e) {
            console.error("Error loading contacts:", e);
        }

        setAssignedClients(clients);
        setOtherConsultants(consultants);
        setAdmins(adminList);
        setLoadingContacts(false);
    };

    const loadMessages = () => {
        setLoading(true);
        try {
            // Load consultant's messages
            const stored = localStorage.getItem(`timely_consultant_messages_${consultantId}`);
            if (stored) {
                setMessages(JSON.parse(stored));
            } else {
                // Welcome message
                const welcomeMessage: Message = {
                    id: generateId("msg"),
                    threadId: "thread_welcome",
                    from: {
                        name: "Timely",
                        email: "system@timely.com",
                        role: "system",
                    },
                    to: {
                        name: consultantName,
                        email: consultantEmail,
                    },
                    subject: "Welcome to Timely Messages",
                    body: `Hi ${consultantName.split(" ")[0]},\n\nWelcome to Timely Messages! Here you can:\n\n• Message your assigned clients directly\n• Communicate with other consultants\n• Contact administrators\n\nAll messages are stored securely within the platform.\n\nBest regards,\nTimely`,
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

    const saveMessages = (newMessages: Message[]) => {
        setMessages(newMessages);
        localStorage.setItem(`timely_consultant_messages_${consultantId}`, JSON.stringify(newMessages));
    };

    // Save to recipient's inbox
    const saveToRecipientInbox = (message: Message, recipient: Contact) => {
        if (recipient.role === "client") {
            // Save to client's messages
            const clientMsgsKey = `timely_client_messages_${recipient.id}`;
            const clientMsgs = JSON.parse(localStorage.getItem(clientMsgsKey) || "[]");
            clientMsgs.push({ ...message, read: false });
            localStorage.setItem(clientMsgsKey, JSON.stringify(clientMsgs));
        } else if (recipient.role === "admin") {
            // Save to admin messages
            const adminMsgs = JSON.parse(localStorage.getItem("timely_admin_messages") || "[]");
            adminMsgs.push({ ...message, read: false });
            localStorage.setItem("timely_admin_messages", JSON.stringify(adminMsgs));

            // Also to global
            const globalMsgs = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
            globalMsgs.push({ ...message, read: false });
            localStorage.setItem("timely_global_messages", JSON.stringify(globalMsgs));
        } else if (recipient.role === "consultant") {
            // Save to other consultant's messages
            const consultantMsgsKey = `timely_consultant_messages_${recipient.id}`;
            const consultantMsgs = JSON.parse(localStorage.getItem(consultantMsgsKey) || "[]");
            consultantMsgs.push({ ...message, read: false });
            localStorage.setItem(consultantMsgsKey, JSON.stringify(consultantMsgs));
        }
    };

    // Get threads
    const threads = useMemo(() => {
        const threadMap = new Map<string, Thread>();

        messages.forEach((msg) => {
            if (msg.deleted && currentView !== "archived") return;
            if (msg.archived && currentView !== "archived") return;

            const existing = threadMap.get(msg.threadId);

            // Determine other participant
            const isFromMe = msg.from.email === consultantEmail;
            const participantName = isFromMe ? msg.to.name : msg.from.name;
            const participantEmail = isFromMe ? msg.to.email : msg.from.email;
            const participantRole = isFromMe ? (msg.to.role || "unknown") : msg.from.role;

            if (!existing) {
                threadMap.set(msg.threadId, {
                    id: msg.threadId,
                    subject: msg.subject,
                    participantName,
                    participantEmail,
                    participantRole,
                    lastMessage: msg.body.substring(0, 100),
                    lastMessageTime: msg.timestamp,
                    unreadCount: msg.read ? 0 : 1,
                    starred: msg.starred,
                    messageCount: 1,
                });
            } else {
                if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = msg.body.substring(0, 100);
                    existing.lastMessageTime = msg.timestamp;
                }
                if (!msg.read) existing.unreadCount++;
                if (msg.starred) existing.starred = true;
                existing.messageCount++;
            }
        });

        return Array.from(threadMap.values()).sort(
            (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
    }, [messages, currentView, consultantEmail]);

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
            case "inbox":
            default:
                result = result.filter((t) => !messages.some((m) => m.threadId === t.id && m.archived));
                break;
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.subject.toLowerCase().includes(query) ||
                    t.lastMessage.toLowerCase().includes(query) ||
                    t.participantName.toLowerCase().includes(query)
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

    // Find contact by email
    const findContact = (email: string): Contact | undefined => {
        return [...assignedClients, ...otherConsultants, ...admins].find(c => c.email === email);
    };

    // Send message
    const handleSendMessage = () => {
        if (!composeBody.trim()) {
            showToast("Please enter a message", "error");
            return;
        }

        if (!selectedThread && !composeTo) {
            showToast("Please select a recipient", "error");
            return;
        }

        setSending(true);

        // Find recipient from contacts or construct from thread info
        let recipient = composeTo ? findContact(composeTo) : findContact(selectedThreadInfo?.participantEmail || "");

        // If recipient not found in contacts but we have thread info, construct recipient object
        if (!recipient && selectedThreadInfo) {
            recipient = {
                id: selectedThreadInfo.participantEmail, // Use email as fallback ID
                name: selectedThreadInfo.participantName,
                email: selectedThreadInfo.participantEmail,
                role: selectedThreadInfo.participantRole as "client" | "consultant" | "admin",
            };
        }

        if (!recipient && !selectedThread) {
            showToast("Invalid recipient", "error");
            setSending(false);
            return;
        }

        const threadId = replyingTo?.threadId || selectedThread || generateId("thread");

        const newMessage: Message = {
            id: generateId("msg"),
            threadId,
            from: {
                name: consultantName,
                email: consultantEmail,
                role: "consultant",
                id: consultantId,
            },
            to: {
                name: recipient?.name || selectedThreadInfo?.participantName || "",
                email: recipient?.email || selectedThreadInfo?.participantEmail || "",
                role: recipient?.role || selectedThreadInfo?.participantRole as any,
                id: recipient?.id,
            },
            subject: replyingTo
                ? `Re: ${replyingTo.subject.replace(/^Re: /, "")}`
                : composeSubject || `Message from ${consultantName}`,
            body: composeBody,
            timestamp: new Date().toISOString(),
            read: true,
            starred: false,
            archived: false,
            deleted: false,
        };

        // Save to own messages
        const updatedMessages = [...messages, newMessage];
        saveMessages(updatedMessages);

        // Save to recipient's inbox - always save if we have recipient info
        if (recipient) {
            saveToRecipientInbox(newMessage, recipient);
        }

        showToast("Message sent!", "success");

        // Reset
        setComposeBody("");
        setComposeSubject("");
        setComposeTo("");
        setShowCompose(false);
        setReplyingTo(null);
        setSending(false);

        if (!selectedThread) {
            setSelectedThread(threadId);
        }
    };

    // Get avatar color
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
            case "client": return Users;
            case "consultant": return Briefcase;
            case "admin": return Shield;
            default: return User;
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

    // All contacts combined
    const allContacts = [...assignedClients, ...otherConsultants, ...admins];

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
                            <h3 className={`text-lg font-semibold ${s.text}`}>
                                {replyingTo ? "Reply" : "New Message"}
                            </h3>
                            <button onClick={() => { setShowCompose(false); setReplyingTo(null); }} className={`p-2 rounded-lg ${s.cardHover}`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* To */}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>To *</label>
                                <select
                                    value={composeTo}
                                    onChange={(e) => setComposeTo(e.target.value)}
                                    disabled={!!replyingTo}
                                    className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${replyingTo ? "opacity-60" : ""}`}
                                >
                                    <option value="">Select recipient...</option>
                                    {assignedClients.length > 0 && (
                                        <optgroup label="Your Assigned Clients">
                                            {assignedClients.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name} (Client)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {otherConsultants.length > 0 && (
                                        <optgroup label="Other Consultants">
                                            {otherConsultants.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name} (Consultant)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {admins.length > 0 && (
                                        <optgroup label="Administrators">
                                            {admins.map((c) => (
                                                <option key={c.id} value={c.email}>
                                                    {c.name} (Admin)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {assignedClients.length === 0 && (
                                    <p className={`text-xs ${s.textMuted} mt-1`}>
                                        No clients assigned to you yet.
                                    </p>
                                )}
                            </div>

                            {/* Subject */}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Subject *</label>
                                <input
                                    type="text"
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                    placeholder="Enter subject..."
                                    disabled={!!replyingTo}
                                    className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${replyingTo ? "opacity-60" : ""}`}
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
                            <button onClick={() => { setShowCompose(false); setReplyingTo(null); }} className={`${s.button} px-4 py-2 rounded-lg`}>
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
                        {stats.unread > 0 ? `${stats.unread} unread message${stats.unread > 1 ? "s" : ""}` : "All caught up!"}
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
                    <div className={`w-56 border-r ${s.divider} flex flex-col`}>
                        {/* Navigation */}
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

                        {/* Contacts */}
                        <div className={`p-3 border-t ${s.divider} flex-1 overflow-y-auto`}>
                            <p className={`text-xs font-medium ${s.textMuted} uppercase mb-2`}>Quick Message</p>
                            {loadingContacts ? (
                                <div className="flex items-center justify-center py-4">
                                    <RefreshCw className={`w-4 h-4 ${s.textMuted} animate-spin`} />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {/* Assigned Clients */}
                                    {assignedClients.length > 0 && (
                                        <>
                                            <p className={`text-xs ${s.textSubtle} mt-2 mb-1 flex items-center gap-1`}>
                                                <Users className="w-3 h-3" /> Clients
                                            </p>
                                            {assignedClients.slice(0, 3).map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.cardHover} text-left`}
                                                >
                                                    <div className={`w-6 h-6 ${getAvatarColor(c.role)} rounded-full flex items-center justify-center text-white text-xs`}>
                                                        {c.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                                    </div>
                                                    <span className={`text-xs ${s.text} truncate`}>{c.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* Other Consultants */}
                                    {otherConsultants.length > 0 && (
                                        <>
                                            <p className={`text-xs ${s.textSubtle} mt-3 mb-1 flex items-center gap-1`}>
                                                <Briefcase className="w-3 h-3" /> Consultants
                                            </p>
                                            {otherConsultants.slice(0, 3).map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.cardHover} text-left`}
                                                >
                                                    <div className={`w-6 h-6 ${getAvatarColor(c.role)} rounded-full flex items-center justify-center text-white text-xs`}>
                                                        {c.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                                    </div>
                                                    <span className={`text-xs ${s.text} truncate`}>{c.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* Admins */}
                                    {admins.length > 0 && (
                                        <>
                                            <p className={`text-xs ${s.textSubtle} mt-3 mb-1 flex items-center gap-1`}>
                                                <Shield className="w-3 h-3" /> Admins
                                            </p>
                                            {admins.slice(0, 3).map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { setComposeTo(c.email); setShowCompose(true); }}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.cardHover} text-left`}
                                                >
                                                    <div className={`w-6 h-6 ${getAvatarColor(c.role)} rounded-full flex items-center justify-center text-white text-xs`}>
                                                        {c.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                                    </div>
                                                    <span className={`text-xs ${s.text} truncate`}>{c.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {assignedClients.length === 0 && otherConsultants.length === 0 && admins.length === 0 && (
                                        <p className={`text-xs ${s.textMuted} text-center py-4`}>
                                            No contacts available
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
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
                                    <p className={s.textMuted}>No messages</p>
                                    <button onClick={() => setShowCompose(true)} className={`${s.buttonPrimary} px-3 py-1.5 rounded-lg text-sm mt-3`}>
                                        Start a conversation
                                    </button>
                                </div>
                            ) : (
                                filteredThreads.map((thread) => {
                                    const RoleIcon = getRoleIcon(thread.participantRole);
                                    return (
                                        <div
                                            key={thread.id}
                                            onClick={() => setSelectedThread(thread.id)}
                                            className={`p-3 border-b ${s.divider} cursor-pointer transition-colors ${selectedThread === thread.id ? s.cardActive : s.cardHover} ${thread.unreadCount > 0 ? "border-l-2 border-l-blue-500" : ""}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 ${getAvatarColor(thread.participantRole)} rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0`}>
                                                    {thread.participantName.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <p className={`font-medium ${s.text} text-sm truncate`}>{thread.participantName}</p>
                                                        <span className={`text-xs ${s.textSubtle} ml-2 shrink-0`}>{formatTime(thread.lastMessageTime)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <RoleIcon className={`w-3 h-3 ${s.textSubtle}`} />
                                                        <span className={`text-xs ${s.textSubtle} capitalize`}>{thread.participantRole}</span>
                                                    </div>
                                                    <p className={`text-sm ${thread.unreadCount > 0 ? `font-medium ${s.text}` : s.textMuted} truncate`}>
                                                        {thread.subject}
                                                    </p>
                                                    <p className={`text-xs ${s.textMuted} truncate mt-0.5`}>{thread.lastMessage}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {thread.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                        {thread.unreadCount > 0 && (
                                                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">{thread.unreadCount}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
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
                                        <div className={`w-10 h-10 ${getAvatarColor(selectedThreadInfo?.participantRole || "")} rounded-full flex items-center justify-center text-white font-medium`}>
                                            {selectedThreadInfo?.participantName.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className={`font-semibold ${s.text}`}>{selectedThreadInfo?.participantName}</h3>
                                            <p className={`text-xs ${s.textMuted} capitalize`}>{selectedThreadInfo?.participantRole}</p>
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
                                    <p className={`text-sm ${s.textMuted}`}>Subject: <span className={s.text}>{threadMessages[0]?.subject || "No Subject"}</span></p>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {threadMessages.map((msg) => {
                                        const isOwn = msg.from.email === consultantEmail;
                                        return (
                                            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                                <div className={`max-w-[80%]`}>
                                                    {!isOwn && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={`w-6 h-6 ${getAvatarColor(msg.from.role)} rounded-full flex items-center justify-center text-white text-xs`}>
                                                                {msg.from.name[0]}
                                                            </div>
                                                            <span className={`text-sm font-medium ${s.text}`}>{msg.from.name}</span>
                                                            <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`p-3 rounded-xl ${isOwn ? "bg-blue-600 text-white" : s.cardInner}`}>
                                                        <p className={`text-sm whitespace-pre-wrap ${isOwn ? "text-white" : s.text}`}>{msg.body}</p>
                                                    </div>
                                                    {isOwn && (
                                                        <div className="flex items-center justify-end gap-1 mt-1">
                                                            <span className={`text-xs ${s.textSubtle}`}>{formatTime(msg.timestamp)}</span>
                                                            <CheckCheck className="w-3 h-3 text-blue-500" />
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
                                                        setReplyingTo(threadMessages[threadMessages.length - 1]);
                                                        handleSendMessage();
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (composeBody.trim()) {
                                                    setReplyingTo(threadMessages[threadMessages.length - 1]);
                                                    handleSendMessage();
                                                }
                                            }}
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

export default ConsultantMessages;