// src/services/AssignmentService.ts
// Centralized service for managing assignments between projects, clients, and consultants
// This ensures bidirectional sync - assign once, appears everywhere

const API_BASE = 'http://localhost:4000/api';

const STORAGE_KEYS = {
    projectConsultants: 'timely_project_consultants',
    projectClients: 'timely_project_clients',
    clientConsultants: 'timely_client_consultants_local',
};

// Types
export interface ProjectConsultant {
    projectId: string;
    consultantId: string;
    createdAt: string;
}

export interface ProjectClient {
    projectId: string;
    clientId: string;
    createdAt: string;
}

export interface ClientConsultant {
    clientId: string;
    consultantId: string;
    createdAt: string;
}

// Event system for cross-component updates
type AssignmentEventType = 'project-consultant' | 'project-client' | 'client-consultant' | 'refresh-all';
type AssignmentEventListener = (type: AssignmentEventType, data?: any) => void;

const listeners: Set<AssignmentEventListener> = new Set();

export const AssignmentService = {
    // ==================== EVENT SYSTEM ====================
    subscribe(listener: AssignmentEventListener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    notify(type: AssignmentEventType, data?: any): void {
        listeners.forEach(listener => listener(type, data));
        window.dispatchEvent(new CustomEvent('assignment-change', { detail: { type, data } }));
    },

    // ==================== PROJECT-CONSULTANT ====================
    getProjectConsultants(): ProjectConsultant[] {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.projectConsultants) || '[]');
        } catch {
            return [];
        }
    },

    saveProjectConsultants(data: ProjectConsultant[]): void {
        localStorage.setItem(STORAGE_KEYS.projectConsultants, JSON.stringify(data));
        this.notify('project-consultant', data);
    },

    assignConsultantToProject(projectId: string, consultantId: string, autoSync: boolean = true): boolean {
        const pid = String(projectId);
        const cid = String(consultantId);
        const existing = this.getProjectConsultants();
        if (existing.find(pc => String(pc.projectId) === pid && String(pc.consultantId) === cid)) {
            return false;
        }

        const newAssignment: ProjectConsultant = {
            projectId: pid,
            consultantId: cid,
            createdAt: new Date().toISOString()
        };

        this.saveProjectConsultants([...existing, newAssignment]);

        // Auto-sync: Link consultant to all clients on this project
        if (autoSync) {
            const projectClientIds = this.getClientsForProject(pid);
            projectClientIds.forEach(clientId => {
                this.assignConsultantToClient(clientId, cid, false);
            });
        }

        this.notify('refresh-all');
        return true;
    },

    removeConsultantFromProject(projectId: string, consultantId: string): void {
        const existing = this.getProjectConsultants();
        this.saveProjectConsultants(existing.filter(pc =>
            !(pc.projectId === projectId && pc.consultantId === consultantId)
        ));
        this.notify('refresh-all');
    },

    getConsultantsForProject(projectId: string): string[] {
        const pid = String(projectId);
        return this.getProjectConsultants()
            .filter(pc => String(pc.projectId) === pid)
            .map(pc => String(pc.consultantId));
    },

    getProjectsForConsultant(consultantId: string): string[] {
        const cid = String(consultantId);
        return this.getProjectConsultants()
            .filter(pc => String(pc.consultantId) === cid)
            .map(pc => String(pc.projectId));
    },

    // ==================== PROJECT-CLIENT ====================
    getProjectClients(): ProjectClient[] {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.projectClients) || '[]');
        } catch {
            return [];
        }
    },

    saveProjectClients(data: ProjectClient[]): void {
        localStorage.setItem(STORAGE_KEYS.projectClients, JSON.stringify(data));
        this.notify('project-client', data);
    },

    assignClientToProject(projectId: string, clientId: string, autoSync: boolean = true): boolean {
        const pid = String(projectId);
        const cid = String(clientId);
        const existing = this.getProjectClients();
        if (existing.find(pc => String(pc.projectId) === pid && String(pc.clientId) === cid)) {
            return false;
        }

        const newAssignment: ProjectClient = {
            projectId: pid,
            clientId: cid,
            createdAt: new Date().toISOString()
        };

        this.saveProjectClients([...existing, newAssignment]);

        // Auto-sync: Link client to all consultants on this project
        if (autoSync) {
            const projectConsultantIds = this.getConsultantsForProject(pid);
            projectConsultantIds.forEach(consultantId => {
                this.assignConsultantToClient(cid, consultantId, false);
            });
        }

        this.notify('refresh-all');
        return true;
    },

    removeClientFromProject(projectId: string, clientId: string): void {
        const existing = this.getProjectClients();
        this.saveProjectClients(existing.filter(pc =>
            !(pc.projectId === projectId && pc.clientId === clientId)
        ));
        this.notify('refresh-all');
    },

    getClientsForProject(projectId: string): string[] {
        const pid = String(projectId);
        return this.getProjectClients()
            .filter(pc => String(pc.projectId) === pid)
            .map(pc => String(pc.clientId));
    },

    getProjectsForClient(clientId: string): string[] {
        const cid = String(clientId);
        return this.getProjectClients()
            .filter(pc => String(pc.clientId) === cid)
            .map(pc => String(pc.projectId));
    },

    // ==================== CLIENT-CONSULTANT ====================
    getClientConsultants(): ClientConsultant[] {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.clientConsultants) || '[]');
        } catch {
            return [];
        }
    },

    saveClientConsultants(data: ClientConsultant[]): void {
        localStorage.setItem(STORAGE_KEYS.clientConsultants, JSON.stringify(data));
        this.notify('client-consultant', data);
    },

    assignConsultantToClient(clientId: string, consultantId: string, shouldNotify: boolean = true): boolean {
        const clid = String(clientId);
        const coid = String(consultantId);
        const existing = this.getClientConsultants();
        if (existing.find(cc => String(cc.clientId) === clid && String(cc.consultantId) === coid)) {
            return false;
        }

        const newAssignment: ClientConsultant = {
            clientId: clid,
            consultantId: coid,
            createdAt: new Date().toISOString()
        };

        this.saveClientConsultants([...existing, newAssignment]);

        if (shouldNotify) {
            this.notify('refresh-all');
        }

        return true;
    },

    removeConsultantFromClient(clientId: string, consultantId: string): void {
        const existing = this.getClientConsultants();
        this.saveClientConsultants(existing.filter(cc =>
            !(cc.clientId === clientId && cc.consultantId === consultantId)
        ));
        this.notify('refresh-all');
    },

    getConsultantsForClient(clientId: string): string[] {
        const cid = String(clientId);
        return this.getClientConsultants()
            .filter(cc => String(cc.clientId) === cid)
            .map(cc => String(cc.consultantId));
    },

    getClientsForConsultant(consultantId: string): string[] {
        const cid = String(consultantId);
        return this.getClientConsultants()
            .filter(cc => String(cc.consultantId) === cid)
            .map(cc => String(cc.clientId));
    },

    // ==================== BULK OPERATIONS ====================

    setupProjectAssignments(projectId: string, consultantIds: string[], clientIds: string[]): void {
        // Assign all consultants to project
        consultantIds.forEach(cid => {
            this.assignConsultantToProject(projectId, cid, false);
        });

        // Assign all clients to project
        clientIds.forEach(cid => {
            this.assignClientToProject(projectId, cid, false);
        });

        // Now create all client-consultant links
        clientIds.forEach(clientId => {
            consultantIds.forEach(consultantId => {
                this.assignConsultantToClient(clientId, consultantId, false);
            });
        });

        this.notify('refresh-all');
    },

    cleanupProjectAssignments(projectId: string): void {
        const projectConsultants = this.getProjectConsultants();
        this.saveProjectConsultants(projectConsultants.filter(pc => pc.projectId !== projectId));

        const projectClients = this.getProjectClients();
        this.saveProjectClients(projectClients.filter(pc => pc.projectId !== projectId));

        this.notify('refresh-all');
    },

    cleanupConsultantAssignments(consultantId: string): void {
        const projectConsultants = this.getProjectConsultants();
        this.saveProjectConsultants(projectConsultants.filter(pc => pc.consultantId !== consultantId));

        const clientConsultants = this.getClientConsultants();
        this.saveClientConsultants(clientConsultants.filter(cc => cc.consultantId !== consultantId));

        this.notify('refresh-all');
    },

    cleanupClientAssignments(clientId: string): void {
        const projectClients = this.getProjectClients();
        this.saveProjectClients(projectClients.filter(pc => pc.clientId !== clientId));

        const clientConsultants = this.getClientConsultants();
        this.saveClientConsultants(clientConsultants.filter(cc => cc.clientId !== clientId));

        this.notify('refresh-all');
    },

    // ==================== API SYNC ====================

    async syncClientConsultantsFromAPI(): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/client-consultants`);
            if (!response.ok) return;

            const data = await response.json();
            if (!data.data) return;

            const apiData: ClientConsultant[] = data.data;
            const local = this.getClientConsultants();

            // Merge: API is source of truth, preserve local-only entries
            const merged = [...apiData];
            local.forEach(localItem => {
                if (!merged.find(m =>
                    m.clientId === localItem.clientId &&
                    m.consultantId === localItem.consultantId
                )) {
                    merged.push(localItem);
                }
            });

            this.saveClientConsultants(merged);
        } catch (e) {
            console.log('Could not sync client-consultants from API');
        }
    },

    async assignConsultantToClientViaAPI(clientId: string, consultantId: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE}/client-consultants/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, consultantId, performedBy: 'admin' })
            });

            if (response.ok) {
                // Also save locally for immediate sync
                this.assignConsultantToClient(clientId, consultantId, true);
                return true;
            }
            return false;
        } catch {
            // Fall back to local-only
            return this.assignConsultantToClient(clientId, consultantId, true);
        }
    },

    // ==================== UTILITY ====================

    getProjectRelationships(projectId: string) {
        return {
            consultantIds: this.getConsultantsForProject(projectId),
            clientIds: this.getClientsForProject(projectId)
        };
    },

    getConsultantRelationships(consultantId: string) {
        return {
            projectIds: this.getProjectsForConsultant(consultantId),
            clientIds: this.getClientsForConsultant(consultantId)
        };
    },

    getClientRelationships(clientId: string) {
        return {
            projectIds: this.getProjectsForClient(clientId),
            consultantIds: this.getConsultantsForClient(clientId)
        };
    },

    // Force refresh all pages
    refreshAll(): void {
        this.notify('refresh-all');
    }
};

export default AssignmentService;