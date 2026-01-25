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
    const prismaError = err as any;
    console.error("Prisma error code:", prismaError.code);
    console.error("Prisma error meta:", prismaError.meta);
    
    // Common Prisma error codes
    if (prismaError.code === "P2021") {
      // Table does not exist
      return res.status(500).json({
        error: "Database error",
        message: `Table does not exist: ${prismaError.meta?.table || "unknown"}. Run migrations: npm run db:migrate`,
        code: prismaError.code,
        table: prismaError.meta?.table,
      });
    }
    
    if (prismaError.code === "P1001") {
      // Can't reach database server
      return res.status(500).json({
        error: "Database connection error",
        message: "Cannot reach database server. Check that PostgreSQL is running: docker-compose up -d",
        code: prismaError.code,
      });
    }
    
    return res.status(500).json({
      error: "Database error",
      message: process.env.NODE_ENV === "development" ? err.message : "A database error occurred",
      code: prismaError.code,
      meta: process.env.NODE_ENV === "development" ? prismaError.meta : undefined,
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
