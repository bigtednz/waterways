import { Router } from "express";
import { prisma } from "@waterways/db";
import { z } from "zod";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const runTypesRouter = Router();

runTypesRouter.use(authenticate);

const runTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

runTypesRouter.get("/", async (req, res, next) => {
  try {
    console.log("Fetching run types...");
    const runTypes = await prisma.runType.findMany({
      orderBy: { code: "asc" },
    });
    console.log(`Found ${runTypes.length} run types`);
    res.json(runTypes);
  } catch (error) {
    console.error("Error fetching run types:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
    }
    next(error);
  }
});

runTypesRouter.post(
  "/",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = runTypeSchema.parse(req.body);
      const runType = await prisma.runType.create({
        data,
      });
      res.status(201).json(runType);
    } catch (error) {
      next(error);
    }
  }
);

runTypesRouter.put(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = runTypeSchema.partial().parse(req.body);
      const runType = await prisma.runType.update({
        where: { id: req.params.id },
        data,
      });
      res.json(runType);
    } catch (error) {
      next(error);
    }
  }
);

runTypesRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.runType.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
