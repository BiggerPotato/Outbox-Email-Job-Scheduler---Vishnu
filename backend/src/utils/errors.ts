/**
 * Base application error with HTTP status and error code.
 */
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400).
 */
class ValidationError extends AppError {
  constructor(message = "Validation failed", code = "VALIDATION_ERROR", details?: unknown) {
    super(message, 400, code, true, details);
  }
}

/**
 * Authentication error (401).
 */
class AuthError extends AppError {
  constructor(message = "Authentication required", code = "AUTH_ERROR") {
    super(message, 401, code);
  }
}

/**
 * Authorization error (403).
 */
class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

/**
 * Resource not found error (404).
 */
class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

/**
 * Rate limit error (429).
 */
class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", code = "RATE_LIMIT") {
    super(message, 429, code);
  }
}

/**
 * Internal server error (500).
 */
class InternalError extends AppError {
  constructor(message = "Internal server error", code = "INTERNAL_ERROR") {
    super(message, 500, code, false);
  }
}

export {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  InternalError
};
