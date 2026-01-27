import type { UserSession } from "./index";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
      auth?: AuthUser;
    }
  }
}

export {};
