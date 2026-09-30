import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { AppError, InternalError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const formatZodError = (error: ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
};

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case "P2002":
      return new ValidationError("Unique constraint failed", "UNIQUE_CONSTRAINT");
    case "P2025":
      return new ValidationError("Record not found", "RECORD_NOT_FOUND");
    default:
      return new InternalError("Database error", "DATABASE_ERROR");
  }
};

/**
 * Global error handler middleware.
 */
const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  let mappedError: AppError;
  let details: unknown;

  if (err instanceof AppError) {
    mappedError = err;
    if (err.details) {
      details = err.details;
    }
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    mappedError = handlePrismaError(err);
    details = { code: err.code, meta: err.meta };
  } else if (err instanceof ZodError) {
    mappedError = new ValidationError("Validation failed", "ZOD_VALIDATION_ERROR");
    details = formatZodError(err);
  } else {
    mappedError = new InternalError();
  }

  const responsePayload: {
    error: {
      code: string;
      message: string;
      details?: unknown;
      stack?: string;
    };
  } = {
    error: {
      code: mappedError.code,
      message: mappedError.message
    }
  };

  if (details) {
    responsePayload.error.details = details;
  }

  if (env.NODE_ENV === "development" && err.stack) {
    responsePayload.error.stack = err.stack;
  }

  logger.error({ err, requestId: req.id, path: req.path }, "Request error");

  res.status(mappedError.statusCode).json(responsePayload);
};

export { errorHandler };
