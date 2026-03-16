// src/ClientPortal_views/ClientAssignmentService.ts
// Single source of truth for resolving which projects are assigned to a client.
// Checks every localStorage format that Timely has ever written — no duplicates.

const API_BASE = "/api";

// ─── Get assigned project IDs for a client ───────────────────────────────────

export const getAssignedProjectIds = (customerId: string): string[] => {
    const ids = new Set<string>();

    // Format 1 — timely_project_clients  [ { clientId, projectId } ]
    try {
        const raw: any[] = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
        raw.filter(x => String(x.clientId) === String(customerId))
           .forEach(x => ids.add(String(x.projectId)));
    } catch {}

    // Format 2 — timely_assignments  { projectClients: [ { clientId, projectId } ] }
    try {
        const data = JSON.parse(localStorage.getItem("timely_assignments") || "{}");
        (data.projectClients || [])
            .filter((x: any) => String(x.clientId) === String(customerId))
            .forEach((x: any) => ids.add(String(x.projectId)));
    } catch {}

    // Format 3 — timely_project_clients_<projectId>  [ { clientId } ]
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith("timely_project_clients_"))
            .forEach(k => {
                const projectId = k.replace("timely_project_clients_", "");
                const arr: any[] = JSON.parse(localStorage.getItem(k) || "[]");
                if (arr.some(x => String(x.clientId) === String(customerId)))
                    ids.add(projectId);
            });
    } catch {}

    return Array.from(ids);
};

// ─── Get assigned projects (full objects, deduplicated) ───────────────────────

export const getAssignedProjects = async (customerId: string): Promise<any[]> => {
    const assignedIds = getAssignedProjectIds(customerId);
    if (assignedIds.length === 0) return [];

    // Merge API + localStorage, deduplicate by projectId
    const projectMap = new Map<string, any>();

    try {
        const res = await fetch(`${API_BASE}/projects`);
        if (res.ok) {
            const data = await res.json();
            (data.data || []).forEach((p: any) => projectMap.set(String(p.projectId), p));
        }
    } catch {}

    try {
        const local: any[] = JSON.parse(localStorage.getItem("timely_projects") || "[]");
        local.forEach(p => {
            const id = String(p.projectId);
            projectMap.set(id, { ...(projectMap.get(id) || {}), ...p });
        });
    } catch {}

    return Array.from(projectMap.values())
        .filter(p => assignedIds.includes(String(p.projectId)));
};

// ─── Check if a single project is assigned to a client ───────────────────────

export const isProjectAssigned = (customerId: string, projectId: string): boolean =>
    getAssignedProjectIds(customerId).includes(String(projectId));