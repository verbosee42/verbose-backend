// src/middlewares/rateLimit.ts
import rateLimit from "express-rate-limit";

/**
 * BASIC (in-memory) limiters.
 * Note: counters reset on server restart and don't scale across multiple instances.
 */

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Try again later." },
});
