import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate } from "../middleware/auth.js";

export const faultTagsRouter = Router();

faultTagsRouter.use(authenticate);

faultTagsRouter.get("/", async (_req, res, next) => {
  try {
    const tags = await prisma.faultTag.findMany({
      orderBy: [{ tagGroup: "asc" }, { tagLabel: "asc" }],
    });
    res.json(tags);
  } catch (error) {
    next(error);
  }
});
