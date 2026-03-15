// src/services/ListingService.ts

const INQUIRY_KEY = 'timely_inquiries';

export interface Inquiry {
    id: string;
    projectId: string;
    listingSlug: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    createdAt: string;
    read: boolean;
}

class ListingService {
    private getAll(): Inquiry[] {
        try { return JSON.parse(localStorage.getItem(INQUIRY_KEY) || '[]'); }
        catch { return []; }
    }

    private saveAll(data: Inquiry[]): void {
        localStorage.setItem(INQUIRY_KEY, JSON.stringify(data));
    }

    getInquiries(): Inquiry[] {
        return this.getAll().sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    getInquiriesForProject(projectId: string): Inquiry[] {
        return this.getInquiries().filter(i => i.projectId === projectId);
    }

    addInquiry(data: Omit<Inquiry, 'id' | 'createdAt' | 'read'>): Inquiry {
        const inquiry: Inquiry = {
            ...data,
            id: `inq_${Date.now()}`,
            createdAt: new Date().toISOString(),
            read: false,
        };
        this.saveAll([...this.getAll(), inquiry]);
        return inquiry;
    }

    markRead(id: string): void {
        this.saveAll(this.getAll().map(i => i.id === id ? { ...i, read: true } : i));
    }

    markAllReadForProject(projectId: string): void {
        this.saveAll(this.getAll().map(i =>
            i.projectId === projectId ? { ...i, read: true } : i
        ));
    }

    deleteInquiry(id: string): void {
        this.saveAll(this.getAll().filter(i => i.id !== id));
    }

    getUnreadCount(projectId?: string): number {
        const all = this.getAll();
        return projectId
            ? all.filter(i => i.projectId === projectId && !i.read).length
            : all.filter(i => !i.read).length;
    }

    getTotalCount(projectId?: string): number {
        const all = this.getAll();
        return projectId
            ? all.filter(i => i.projectId === projectId).length
            : all.length;
    }

    generateSlug(projectName: string, projectId: string): string {
        const base = projectName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${base}-${projectId.slice(-6)}`;
    }
}

export default new ListingService();