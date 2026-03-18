import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/listings — Publish a project as a public listing (owner/admin only)
router.post("/listings", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const {
    projectId, title, description, price, propertyType,
    bedrooms, bathrooms, sqft, address, city, state, zip,
    lat, lng, photos, amenities,
  } = req.body || {};

  if (!projectId || !title) {
    return res.status(400).json({ error: "projectId and title are required." });
  }

  try {
    // Verify project belongs to this org
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    // Check if listing already exists for this project
    const existing = await prisma.listing.findFirst({
      where: { projectId: Number(projectId), organizationId: orgId },
    });
    if (existing) {
      return res.status(400).json({ error: "A listing already exists for this project. Update it instead." });
    }

    const listing = await prisma.listing.create({
      data: {
        code: "TEMP",
        projectId: Number(projectId),
        organizationId: orgId,
        title,
        description: description || "",
        price: price ? parseFloat(price) : null,
        propertyType: propertyType || "",
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        sqft: sqft ? Number(sqft) : null,
        address: address || "",
        city: city || "",
        state: state || "",
        zip: zip || "",
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        status: "active",
        photos: photos || [],
        amenities: amenities || [],
        publishedAt: new Date(),
      },
    });

    const code = formatCode("LS", listing.id);
    await prisma.listing.update({ where: { id: listing.id }, data: { code } });

    await appendAuditLog(
      orgId, "CREATE_LISTING", "listing", code,
      req.user?.email || "unknown",
      `Listing published: ${title} (project ${project.code})`
    );

    return res.json({ success: true, listingId: listing.id, listingCode: code });
  } catch (err) {
    console.error("Error creating listing:", err);
    return res.status(500).json({ error: "Failed to create listing." });
  }
});

// PATCH /api/listings/:listingId — Update a listing
router.patch("/listings/:listingId", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: Number(listingId), organizationId: orgId },
    });
    if (!listing) return res.status(404).json({ error: "Listing not found in this organization." });

    const {
      title, description, price, propertyType,
      bedrooms, bathrooms, sqft, address, city, state, zip,
      lat, lng, status, photos, amenities,
    } = req.body || {};

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price ? parseFloat(price) : null;
    if (propertyType !== undefined) data.propertyType = propertyType;
    if (bedrooms !== undefined) data.bedrooms = bedrooms ? Number(bedrooms) : null;
    if (bathrooms !== undefined) data.bathrooms = bathrooms ? Number(bathrooms) : null;
    if (sqft !== undefined) data.sqft = sqft ? Number(sqft) : null;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (zip !== undefined) data.zip = zip;
    if (lat !== undefined) data.lat = lat ? parseFloat(lat) : null;
    if (lng !== undefined) data.lng = lng ? parseFloat(lng) : null;
    if (photos !== undefined) data.photos = photos;
    if (amenities !== undefined) data.amenities = amenities;

    if (status !== undefined) {
      data.status = status;
      if (status === "active" && !listing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    await prisma.listing.update({ where: { id: listing.id }, data });

    await appendAuditLog(
      orgId, "UPDATE_LISTING", "listing", listing.code,
      req.user?.email || "unknown",
      `Listing updated: ${listing.title}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating listing:", err);
    return res.status(500).json({ error: "Failed to update listing." });
  }
});

// DELETE /api/listings/:listingId — Unpublish/delete a listing
router.delete("/listings/:listingId", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: Number(listingId), organizationId: orgId },
    });
    if (!listing) return res.status(404).json({ error: "Listing not found in this organization." });

    await prisma.listing.delete({ where: { id: listing.id } });

    await appendAuditLog(
      orgId, "DELETE_LISTING", "listing", listing.code,
      req.user?.email || "unknown",
      `Listing deleted: ${listing.title}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting listing:", err);
    return res.status(500).json({ error: "Failed to delete listing." });
  }
});

// GET /api/listings — List all listings for current org (authenticated)
router.get("/listings", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;

  try {
    const listings = await prisma.listing.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true, code: true } },
      },
    });

    const data = listings.map((l) => ({
      listingId: l.id,
      listingCode: l.code,
      projectId: l.projectId,
      projectName: l.project.name,
      projectCode: l.project.code,
      title: l.title,
      description: l.description,
      price: l.price ? Number(l.price) : null,
      propertyType: l.propertyType,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      sqft: l.sqft,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      status: l.status,
      photos: l.photos,
      amenities: l.amenities,
      publishedAt: l.publishedAt?.toISOString() || null,
      createdAt: l.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading listings:", err);
    return res.status(500).json({ error: "Failed to read listings." });
  }
});

// ============================================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================================

// GET /api/public/listings/:orgSlug — Public listings page for a firm
router.get("/public/listings/:orgSlug", async (req: Request, res: Response) => {
  const { orgSlug } = req.params;
  const { propertyType, minPrice, maxPrice, city, bedrooms } = req.query;

  try {
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return res.status(404).json({ error: "Organization not found." });

    const where: any = {
      organizationId: org.id,
      status: "active",
    };

    if (propertyType) where.propertyType = String(propertyType);
    if (city) where.city = { contains: String(city), mode: "insensitive" };
    if (bedrooms) where.bedrooms = { gte: Number(bedrooms) };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(String(minPrice));
      if (maxPrice) where.price.lte = parseFloat(String(maxPrice));
    }

    const listings = await prisma.listing.findMany({
      where,
      orderBy: { publishedAt: "desc" },
    });

    const data = listings.map((l) => ({
      listingId: l.id,
      listingCode: l.code,
      title: l.title,
      description: l.description,
      price: l.price ? Number(l.price) : null,
      propertyType: l.propertyType,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      sqft: l.sqft,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      photos: l.photos,
      amenities: l.amenities,
      publishedAt: l.publishedAt?.toISOString() || null,
    }));

    return res.json({
      org: { name: org.name, slug: org.slug, logoUrl: org.logoUrl },
      data,
    });
  } catch (err) {
    console.error("Error reading public listings:", err);
    return res.status(500).json({ error: "Failed to read listings." });
  }
});

// GET /api/public/listings/:orgSlug/:listingId — Single public listing
router.get("/public/listings/:orgSlug/:listingId", async (req: Request, res: Response) => {
  const { orgSlug, listingId } = req.params;

  try {
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return res.status(404).json({ error: "Organization not found." });

    const listing = await prisma.listing.findFirst({
      where: { id: Number(listingId), organizationId: org.id, status: "active" },
    });
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    return res.json({
      org: { name: org.name, slug: org.slug, logoUrl: org.logoUrl },
      data: {
        listingId: listing.id,
        listingCode: listing.code,
        title: listing.title,
        description: listing.description,
        price: listing.price ? Number(listing.price) : null,
        propertyType: listing.propertyType,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        sqft: listing.sqft,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        lat: listing.lat ? Number(listing.lat) : null,
        lng: listing.lng ? Number(listing.lng) : null,
        photos: listing.photos,
        amenities: listing.amenities,
        publishedAt: listing.publishedAt?.toISOString() || null,
      },
    });
  } catch (err) {
    console.error("Error reading listing:", err);
    return res.status(500).json({ error: "Failed to read listing." });
  }
});

export default router;