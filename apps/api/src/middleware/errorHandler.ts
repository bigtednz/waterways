import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);
  console.error("Error name:", err.name);
  console.error("Error message:", err.message);
  if (err.stack) {
    console.error("Error stack:", err.stack);
  }

  // Zod validation errors
  if (err.name === "ZodError" || (err as any).issues) {
    return res.status(400).json({
      error: "Validation error",
      details: err.message,
      issues: (err as any).issues,
    });
  }

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError" || err.name === "PrismaClientUnknownRequestError") {
    console.error("Prisma error code:", (err as any).code);
    return res.status(500).json({
      error: "Database error",
      message: process.env.NODE_ENV === "development" ? err.message : "A database error occurred",
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Authentication error",
      message: err.message,
    });
  }

  // Default error response
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production" ? err.message : "An unexpected error occurred",
    type: err.name,
  });
};
