import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import consultantRoutes from "./routes/consultants.js";
import projectRoutes from "./routes/projects.js";
import clientConsultantRoutes from "./routes/clientConsultants.js";
import hoursRoutes from "./routes/hours.js";
import projectCommentRoutes from "./routes/projectComments.js";
import projectAttachmentRoutes from "./routes/projectAttachments.js";
import teamFeedRoutes from "./routes/teamFeed.js";
import emailRoutes from "./routes/emails.js";
import auditRoutes from "./routes/audit.js";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", consultantRoutes);
app.use("/api", projectRoutes);
app.use("/api", clientConsultantRoutes);
app.use("/api", hoursRoutes);
app.use("/api", projectCommentRoutes);
app.use("/api", projectAttachmentRoutes);
app.use("/api", teamFeedRoutes);
app.use("/api", emailRoutes);
app.use("/api", auditRoutes);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Timely API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 All 33 endpoints active`);
});

export default app;