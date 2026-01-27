import "express-serve-static-core";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthUser;
  }
}
