import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

import { ValidationError } from "../utils/errors";

type SchemaMap = Partial<{
  body: ZodSchema;
  query: ZodSchema;
  params: ZodSchema;
}>;

/**
 * Validates request body, query, and params using Zod schemas.
 */
const validateRequest = (schemas: SchemaMap) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          throw new ValidationError("Invalid request body", "REQUEST_BODY_INVALID", result.error.issues);
        }
        req.body = result.data;
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          throw new ValidationError(
            "Invalid query parameters",
            "REQUEST_QUERY_INVALID",
            result.error.issues
          );
        }
        req.query = result.data as typeof req.query;
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          throw new ValidationError(
            "Invalid route parameters",
            "REQUEST_PARAMS_INVALID",
            result.error.issues
          );
        }
        req.params = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export { validateRequest };
