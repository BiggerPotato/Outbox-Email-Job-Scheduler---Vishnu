import { Request } from "express";

export type PaginationQuery = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export type JWTPayload = {
  userId: string;
  email: string;
  name: string;
};

export type RequestWithUser = Request & {
  user?: Express.User;
};

declare global {
  namespace Express {
    interface User {
      userId?: string;
      email?: string;
      name?: string | { familyName?: string; givenName?: string; middleName?: string };
    }
  }
}
