import { Request, Response, NextFunction } from "express";

type AuthUser = { id: string; role: "GUEST" | "PROVIDER" | "ADMIN"; email?: string };
type AuthedRequest = Request & { auth?: AuthUser };

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  if (req.auth.role !== "ADMIN") return res.status(403).json({ message: "Admin only" });
  return next();
}
