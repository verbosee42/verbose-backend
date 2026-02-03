import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middlewares";
import { pool } from "./config/db";
import authRoutes from "./routes/auth.routes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";
import adminProvidersRoutes from "./routes/admin.providers.routes";
import blacklistRoutes from "./routes/blacklist.routes";
import adminBlacklistRoutes from "./routes/admin.blacklist.routes";
import feedsRoutes from "./routes/feeds.routes";
import chatsRoutes from "./routes/chats.routes";
import providersRoutes from "./routes/providers.routes";
import favouritesRoutes from "./routes/favourites.routes";

export const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Health check endpoint (app-level)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// API info endpoint
app.get("/api/v1", (_req, res) => {
  res.json({
    name: "verbose-api",
    version: "v1",
  });
});

app.get("/", (_req, res) => res.json({ ok: true, message: "Verbose API" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminProvidersRoutes);
app.use("/api/v1/blacklist", blacklistRoutes);
app.use("/api/v1/admin", adminBlacklistRoutes);
app.use("/api/v1/feeds", feedsRoutes);
app.use("/api/v1/chats", chatsRoutes);
app.use("/api/v1/providers", providersRoutes);
app.use("/api/v1/favorites", favouritesRoutes);

// Root endpoint
app.get("/", (_req, res) => {
  res.status(200).json({ message: "Verbose backend running" });
});

// DB health check
app.get("/db-health", async (_req, res, next) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) {
    next(e);
  }
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);
