import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@waterways/db";
import { loginSchema, registerSchema } from "@waterways/shared";
import { authenticate, AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: "VIEWER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    console.log("Login attempt - email:", req.body?.email);
    console.log("Request body:", JSON.stringify(req.body));
    
    // Validate input
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    console.log("Looking up user:", email);
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
      });
    } catch (dbError: any) {
      console.error("Database query failed:", dbError);
      console.error("Error code:", dbError.code);
      console.error("Error meta:", dbError.meta);
      throw dbError; // Re-throw to be caught by error handler
    }

    if (!user) {
      console.log("User not found:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("User found, comparing password...");
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("Password match, generating token...");
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn("⚠️ JWT_SECRET not set, using fallback secret");
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret || "secret",
      { expiresIn: "7d" }
    );

    console.log("Login successful for user:", email);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      // Check for Prisma errors specifically
      if ((error as any).code) {
        console.error("Prisma error code:", (error as any).code);
        console.error("Prisma error meta:", (error as any).meta);
      }
    }
    next(error);
  }
});

authRouter.get("/me", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});
