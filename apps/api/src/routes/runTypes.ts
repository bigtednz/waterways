import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate } from "../middleware/auth.js";

export const runTypesRouter = Router();

runTypesRouter.use(authenticate);

runTypesRouter.get("/", async (req, res, next) => {
  try {
    const runTypes = await prisma.runType.findMany({
      orderBy: { code: "asc" },
    });
    res.json(runTypes);
  } catch (error) {
    next(error);
  }
});
