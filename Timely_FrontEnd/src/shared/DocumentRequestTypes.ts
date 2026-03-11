// src/shared/DocumentRequestTypes.ts
// Shared types and utilities for the document request system between admin and clients

export type DocumentRequestStatus = "pending" | "uploaded" | "approved" | "rejected";
export type DocumentRequestPriority = "low" | "medium" | "high" | "urgent";

export interface DocumentRequest {
    id: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    requestedBy: string;          // admin email
    requestedByName: string;      // admin name
    documentName: string;         // what document is being requested
    description: string;          // detailed description of what's needed
    category: string;             // e.g., "Tax", "Legal", "Financial", "Identity", "Other"
    priority: DocumentRequestPriority;
    status: DocumentRequestStatus;
    dueDate?: string;             // optional deadline
    createdAt: string;
    updatedAt: string;
    // when client uploads
    uploadedDocumentId?: string;
    uploadedDocumentName?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    // admin review
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
    // for tracking
    projectId?: string;
    projectName?: string;
}

export interface DocumentUpload {
    id: string;
    requestId?: string;           // linked to a request (optional)
    clientId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedBy: string;
    uploadedAt: string;
    base64?: string;
    status: "pending_review" | "approved" | "rejected";
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    projectId?: string;
    projectName?: string;
    category?: string;
}

// Storage keys
export const STORAGE_KEYS = {
    DOCUMENT_REQUESTS: "timely_document_requests",
    DOCUMENT_UPLOADS: "timely_document_uploads",
    CLIENT_MESSAGES: "timely_client_messages",
};

// Helper functions
export const generateId = (prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

export const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const getRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
};

export const getPriorityColor = (priority: DocumentRequestPriority): { bg: string; text: string } => {
    switch (priority) {
        case "urgent": return { bg: "bg-red-500/20", text: "text-red-500" };
        case "high": return { bg: "bg-orange-500/20", text: "text-orange-500" };
        case "medium": return { bg: "bg-yellow-500/20", text: "text-yellow-500" };
        case "low": return { bg: "bg-green-500/20", text: "text-green-500" };
        default: return { bg: "bg-gray-500/20", text: "text-gray-500" };
    }
};

export const getStatusColor = (status: DocumentRequestStatus): { bg: string; text: string } => {
    switch (status) {
        case "pending": return { bg: "bg-amber-500/20", text: "text-amber-500" };
        case "uploaded": return { bg: "bg-blue-500/20", text: "text-blue-500" };
        case "approved": return { bg: "bg-emerald-500/20", text: "text-emerald-500" };
        case "rejected": return { bg: "bg-red-500/20", text: "text-red-500" };
        default: return { bg: "bg-gray-500/20", text: "text-gray-500" };
    }
};

// Document request API helpers (localStorage-based for now)
export const DocumentRequestAPI = {
    // Get all requests
    getAll: (): DocumentRequest[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]");
        } catch {
            return [];
        }
    },

    // Get requests for a specific client
    getForClient: (clientId: string): DocumentRequest[] => {
        return DocumentRequestAPI.getAll().filter(r => r.clientId === clientId);
    },

    // Get pending requests for a client
    getPendingForClient: (clientId: string): DocumentRequest[] => {
        return DocumentRequestAPI.getForClient(clientId).filter(r => r.status === "pending");
    },

    // Create a new request
    create: (request: Omit<DocumentRequest, "id" | "createdAt" | "updatedAt" | "status">): DocumentRequest => {
        const newRequest: DocumentRequest = {
            ...request,
            id: generateId("docreq"),
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const all = DocumentRequestAPI.getAll();
        all.push(newRequest);
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all));
        return newRequest;
    },

    // Update a request
    update: (id: string, updates: Partial<DocumentRequest>): DocumentRequest | null => {
        const all = DocumentRequestAPI.getAll();
        const index = all.findIndex(r => r.id === id);
        if (index === -1) return null;

        all[index] = {
            ...all[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all));
        return all[index];
    },

    // Mark as uploaded
    markAsUploaded: (id: string, uploadInfo: { documentId: string; documentName: string; uploadedBy: string }): DocumentRequest | null => {
        return DocumentRequestAPI.update(id, {
            status: "uploaded",
            uploadedDocumentId: uploadInfo.documentId,
            uploadedDocumentName: uploadInfo.documentName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: uploadInfo.uploadedBy,
        });
    },

    // Approve upload
    approve: (id: string, reviewedBy: string, notes?: string): DocumentRequest | null => {
        return DocumentRequestAPI.update(id, {
            status: "approved",
            reviewedAt: new Date().toISOString(),
            reviewedBy,
            reviewNotes: notes,
        });
    },

    // Reject upload
    reject: (id: string, reviewedBy: string, notes: string): DocumentRequest | null => {
        return DocumentRequestAPI.update(id, {
            status: "rejected",
            reviewedAt: new Date().toISOString(),
            reviewedBy,
            reviewNotes: notes,
        });
    },

    // Delete request
    delete: (id: string): boolean => {
        const all = DocumentRequestAPI.getAll();
        const filtered = all.filter(r => r.id !== id);
        if (filtered.length === all.length) return false;
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(filtered));
        return true;
    },
};

// Document uploads API helpers
export const DocumentUploadAPI = {
    getAll: (): DocumentUpload[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_UPLOADS) || "[]");
        } catch {
            return [];
        }
    },

    getForClient: (clientId: string): DocumentUpload[] => {
        return DocumentUploadAPI.getAll().filter(u => u.clientId === clientId);
    },

    getPendingReview: (): DocumentUpload[] => {
        return DocumentUploadAPI.getAll().filter(u => u.status === "pending_review");
    },

    create: (upload: Omit<DocumentUpload, "id" | "uploadedAt" | "status">): DocumentUpload => {
        const newUpload: DocumentUpload = {
            ...upload,
            id: generateId("docup"),
            uploadedAt: new Date().toISOString(),
            status: "pending_review",
        };
        const all = DocumentUploadAPI.getAll();
        all.push(newUpload);
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(all));
        return newUpload;
    },

    update: (id: string, updates: Partial<DocumentUpload>): DocumentUpload | null => {
        const all = DocumentUploadAPI.getAll();
        const index = all.findIndex(u => u.id === id);
        if (index === -1) return null;

        all[index] = { ...all[index], ...updates };
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(all));
        return all[index];
    },

    approve: (id: string, reviewedBy: string, notes?: string): DocumentUpload | null => {
        return DocumentUploadAPI.update(id, {
            status: "approved",
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes,
        });
    },

    reject: (id: string, reviewedBy: string, notes: string): DocumentUpload | null => {
        return DocumentUploadAPI.update(id, {
            status: "rejected",
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes,
        });
    },

    delete: (id: string): boolean => {
        const all = DocumentUploadAPI.getAll();
        const filtered = all.filter(u => u.id !== id);
        if (filtered.length === all.length) return false;
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(filtered));
        return true;
    },
};

// Category options
export const DOCUMENT_CATEGORIES = [
    { value: "tax", label: "Tax Documents" },
    { value: "legal", label: "Legal Documents" },
    { value: "financial", label: "Financial Records" },
    { value: "identity", label: "Identity Verification" },
    { value: "contract", label: "Contracts & Agreements" },
    { value: "report", label: "Reports" },
    { value: "other", label: "Other" },
];