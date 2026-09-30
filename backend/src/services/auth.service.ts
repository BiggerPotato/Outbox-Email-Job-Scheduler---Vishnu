import { User } from "@prisma/client";
import jwt from "jsonwebtoken";

import { prisma } from "../config/database";
import { env } from "../config/env";
import { AuthError } from "../utils/errors";
import { JWTPayload } from "../types/common.types";

/**
 * Authentication service for Google OAuth user handling and JWT issuance.
 */
class AuthService {
  /**
   * Find or create a user based on Google profile data.
   */
  async findOrCreateUser(googleProfile: any): Promise<User> {
    const googleId = googleProfile.id;
    const email = googleProfile.emails?.[0]?.value;
    const name = googleProfile.displayName ?? "";
    const avatarUrl = googleProfile.photos?.[0]?.value;

    if (!googleId || !email) {
      throw new AuthError("Invalid Google profile", "GOOGLE_PROFILE_INVALID");
    }

    const existing = await prisma.user.findUnique({ where: { googleId } });

    if (existing) {
      if (existing.name !== name || existing.avatarUrl !== avatarUrl) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { name, avatarUrl }
        });
      }
      return existing;
    }

    return prisma.user.create({
      data: {
        googleId,
        email,
        name,
        avatarUrl
      }
    });
  }

  /**
   * Generate a JWT for the given user.
   */
  generateJWT(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name
    };

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
  }

  /**
   * Verify a JWT and return the decoded payload.
   */
  verifyJWT(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new AuthError("Invalid or expired token", "AUTH_INVALID");
    }
  }
}

export { AuthService };
