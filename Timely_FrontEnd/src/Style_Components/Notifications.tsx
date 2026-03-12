// src/Style_Components/Notifications.tsx
// Standalone notification logic — imported by Navbar

import { useState, useEffect, useCallback } from "react";

export type NotificationType = "success" | "warning" | "info" | "error";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    time: string;
    read: boolean;
}

const formatTime = (ts: string): string => {
    if (!ts) return "Just now";
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const formatAction = (actionType: string): { title: string; type: NotificationType } => {
    const map: Record<string, { title: string; type: NotificationType }> = {
        LOGIN: { title: "User Login", type: "info" },
        CREATE_CLIENT: { title: "Client Created", type: "success" },
        DELETE_CLIENT: { title: "Client Deleted", type: "warning" },
        CREATE_CONSULTANT: { title: "Consultant Created", type: "success" },
        DELETE_CONSULTANT: { title: "Consultant Deleted", type: "warning" },
        CREATE_PROJECT: { title: "Project Created", type: "success" },
        DELETE_PROJECT: { title: "Project Deleted", type: "warning" },
        UPDATE_PROJECT_DETAILS: { title: "Project Updated", type: "info" },
        ASSIGN_PROJECT: { title: "Project Assigned", type: "success" },
        ASSIGN_CONSULTANT: { title: "Consultant Assigned", type: "success" },
        LOG_HOURS: { title: "Hours Logged", type: "info" },
        DELETE_HOURS_LOG: { title: "Hours Deleted", type: "warning" },
        CREATE_COMMENT: { title: "Comment Added", type: "info" },
        UPLOAD_ATTACHMENT: { title: "File Uploaded", type: "success" },
        CREATE_POST: { title: "Post Created", type: "info" },
        DELETE_POST: { title: "Post Deleted", type: "warning" },
    };
    return map[actionType] || { title: actionType?.replace(/_/g, " ") || "Activity", type: "info" };
};

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/audit-logs/latest?limit=15");
            if (!res.ok) return;
            const data = await res.json();

            if (data.data) {
                const notifs: Notification[] = data.data.map((log: any, i: number) => {
                    const { title, type } = formatAction(log.actionType);
                    return {
                        id: `notif_${log.timestamp}_${i}`,
                        type,
                        title,
                        message: log.details || log.entityId || "",
                        time: formatTime(log.timestamp),
                        read: false,
                    };
                });
                setNotifications(notifs);
            }
        } catch (err) {
            console.error("Failed to load notifications:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
        notifications,
        unreadCount,
        isLoading,
        markAllRead,
        markRead,
        refresh: fetchNotifications,
    };
}