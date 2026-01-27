import jwt, { SignOptions } from "jsonwebtoken";

export type JwtPayload = {
  sub: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
};

export function signAccessToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");

  const decoded = jwt.verify(token, secret);

  // jwt.verify can return string | object, so we validate shape:
  if (typeof decoded !== "object" || decoded === null) throw new Error("Invalid token");

  const p = decoded as Partial<JwtPayload>;
  if (!p.sub || !p.role) throw new Error("Invalid token payload");

  return { sub: String(p.sub), role: p.role };
}


