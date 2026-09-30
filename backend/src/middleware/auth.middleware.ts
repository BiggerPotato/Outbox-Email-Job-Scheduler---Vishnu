import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AuthError } from "../utils/errors";
import { JWTPayload } from "../types/common.types";

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
};

/**
 * Enforces JWT authentication and attaches user to the request.
 */
const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next(new AuthError("Missing authentication token", "AUTH_MISSING"));
    }
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    if (error instanceof AuthError) {
      return next(error);
    }
    return next(new AuthError("Invalid or expired token", "AUTH_INVALID"));
  }
};

/**
 * Attempts JWT authentication if present and continues otherwise.
 */
const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    if (error instanceof AuthError) {
      return next(error);
    }
    return next(new AuthError("Invalid or expired token", "AUTH_INVALID"));
  }
};

export { requireAuth, optionalAuth };
