import { Request, Response, NextFunction } from "express";
import passport from "passport";

import { AuthService } from "../services/auth.service";
import { env } from "../config/env";
import { RequestWithUser } from "../types/common.types";
import { AuthError } from "../utils/errors";

const authService = new AuthService();

/**
 * Initiates Google OAuth flow.
 */
const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(
    req,
    res,
    next
  );
};

/**
 * Handles Google OAuth callback and issues a JWT.
 */
const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", { session: false }, async (err, profile) => {
    if (err) {
      return next(err);
    }

    try {
      const user = await authService.findOrCreateUser(profile);
      const token = authService.generateJWT(user);
      const redirectUrl = new URL(env.FRONTEND_URL);
      redirectUrl.pathname = "/auth/callback";
      redirectUrl.searchParams.set("token", token);
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
};

/**
 * Logs out the current user.
 */
const logout = (req: Request, res: Response) => {
  if (typeof req.logout === "function") {
    req.logout(() => {
      res.status(200).json({ success: true });
    });
    return;
  }
  res.status(200).json({ success: true });
};

/**
 * Returns the authenticated user.
 */
const getCurrentUser = (req: RequestWithUser, res: Response) => {
  if (!req.user?.userId) {
    throw new AuthError("Missing authentication token", "AUTH_MISSING");
  }
  res.status(200).json({ success: true, data: req.user });
};

export { googleAuth, googleCallback, logout, getCurrentUser };
