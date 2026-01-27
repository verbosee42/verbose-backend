import { Request, Response, NextFunction } from "express";
import { AppError } from "../types";

// Prisma error types (conditional import)
type PrismaError = {
  code?: string;
  meta?: any;
  message: string;
  name: string;
};

/**
 * Global error handler middleware
 * Handles all errors thrown in the application
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let message = "Internal Server Error";
  let isOperational = false;
  let code: string | undefined;
  let errors: any[] | undefined;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    code = err.code;
  }
  // Handle Prisma errors (check by error name and properties)
  else if (
    err.name === "PrismaClientKnownRequestError" &&
    "code" in err &&
    "meta" in err
  ) {
    const prismaErr = err as PrismaError;
    statusCode = 400;
    isOperational = true;

    switch (prismaErr.code) {
      case "P2002":
        // Unique constraint violation
        const field =
          (prismaErr.meta?.target as string[])?.join(", ") || "field";
        message = `A record with this ${field} already exists`;
        code = "DUPLICATE_ENTRY";
        break;
      case "P2025":
        // Record not found
        message = "Record not found";
        statusCode = 404;
        code = "NOT_FOUND";
        break;
      case "P2003":
        // Foreign key constraint failed
        message = "Related record not found";
        code = "FOREIGN_KEY_ERROR";
        break;
      case "P2014":
        // Invalid ID
        message = "Invalid ID provided";
        code = "INVALID_ID";
        break;
      default:
        message = "Database operation failed";
        code = "DATABASE_ERROR";
    }
  }
  // Handle Prisma validation errors
  else if (err.name === "PrismaClientValidationError") {
    statusCode = 400;
    message = "Invalid data provided";
    code = "VALIDATION_ERROR";
    isOperational = true;
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    code = "INVALID_TOKEN";
    isOperational = true;
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    code = "TOKEN_EXPIRED";
    isOperational = true;
  }
  // Handle validation errors (from zod or other validators)
  else if (err.name === "ZodError") {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
    isOperational = true;
    // @ts-ignore - ZodError has issues property
    errors = err.issues?.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  }
  // Handle syntax errors
  else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON payload";
    code = "INVALID_JSON";
    isOperational = true;
  }

  // Log error for debugging (in production, use proper logger)
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode,
      code,
    });
  } else {
    // In production, only log non-operational errors
    if (!isOperational) {
      console.error("Unexpected Error:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    }
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    message,
    ...(code && { code }),
    ...(errors && { errors }),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
    errorResponse.error = err.message;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 Not Found errors
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    true,
    "ROUTE_NOT_FOUND"
  );
  next(error);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on("uncaughtException", (err: Error) => {
    console.error("UNCAUGHT EXCEPTION! Shutting down...");
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = () => {
  process.on("unhandledRejection", (err: Error) => {
    console.error("UNHANDLED REJECTION! Shutting down...");
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
  });
};
