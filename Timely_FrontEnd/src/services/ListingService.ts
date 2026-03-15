// src/services/ListingService.ts
//
// Listings are private — only accessible by authenticated users with
// project assignments. No public inquiries; clients message through
// the existing ConsultantMessages system.

class ListingService {
    generateSlug(projectName: string, projectId: string): string {
        const base = projectName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${base}-${projectId.slice(-6)}`;
    }

    getPublicUrl(slug: string): string {
        return `${window.location.origin}/listing/${slug}`;
    }
}

export default new ListingService();