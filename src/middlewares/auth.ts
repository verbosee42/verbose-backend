import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};

type AuthedRequest = Request & {
  auth?: AuthUser;
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);

    req.auth = { id: payload.sub, role: payload.role };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Array<"GUEST" | "PROVIDER" | "ADMIN">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ message: "Forbidden" });
    return next();
  };
}
