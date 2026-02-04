import { Router } from "express";
import { prisma } from "@waterways/db";
import { Prisma } from "@prisma/client";
import {
  competitionDaySchema,
  runQueueItemSchema,
  runQueueItemUpdateSchema,
  reorderQueueSchema,
  competitorTimeSchema,
  competitorTimeUpdateSchema,
} from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const competitionDaysRouter = Router();

competitionDaysRouter.use(authenticate);

// List all competition days (newest first)
competitionDaysRouter.get("/", async (req, res, next) => {
  try {
    const competitionDays = await prisma.competitionDay.findMany({
      include: {
        queueItems: {
          orderBy: { sequenceNo: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });
    res.json(competitionDays);
  } catch (error) {
    next(error);
  }
});

// Get competition day detail with queue items
competitionDaysRouter.get("/:id", async (req, res, next) => {
  try {
    const competitionDay = await prisma.competitionDay.findUnique({
      where: { id: req.params.id },
      include: {
        queueItems: {
          orderBy: { sequenceNo: "asc" },
          include: {
            competitorTimes: {
              orderBy: [
                { ran: "desc" }, // Ran teams first
                { totalTimeSeconds: "asc" }, // Fastest times first (nulls will be handled in frontend)
              ],
            },
          },
        },
      },
    });

    if (!competitionDay) {
      return res.status(404).json({ error: "Competition day not found" });
    }

    res.json(competitionDay);
  } catch (error) {
    next(error);
  }
});

// Create competition day
competitionDaysRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitionDaySchema.parse(req.body);
      const competitionDay = await prisma.competitionDay.create({
        data: {
          ...data,
          date: new Date(data.date),
        },
      });
      res.status(201).json(competitionDay);
    } catch (error) {
      next(error);
    }
  }
);

// Update competition day
competitionDaysRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitionDaySchema.partial().parse(req.body);
      const competitionDay = await prisma.competitionDay.update({
        where: { id: req.params.id },
        data: {
          ...data,
          date: data.date ? new Date(data.date) : undefined,
        },
      });
      res.json(competitionDay);
    } catch (error) {
      next(error);
    }
  }
);

// Delete competition day
competitionDaysRouter.delete(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const competitionDayId = req.params.id;

      // Check if competition day exists
      const competitionDay = await prisma.competitionDay.findUnique({
        where: { id: competitionDayId },
      });

      if (!competitionDay) {
        return res.status(404).json({ error: "Competition day not found" });
      }

      // Delete the competition day (cascade will delete queue items and competitor times)
      await prisma.competitionDay.delete({
        where: { id: competitionDayId },
      });

      res.json({ message: "Competition day deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// Add queue item to competition day
competitionDaysRouter.post(
  "/:id/queue",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const competitionDayId = req.params.id;
      const itemData = runQueueItemSchema.parse(req.body);
      const insertAfterSequenceNo = req.body.insertAfterSequenceNo as number | undefined;

      let nextSequenceNo: number;

      if (insertAfterSequenceNo !== undefined && typeof insertAfterSequenceNo === "number") {
        // Insert after a specific sequence number (for reruns)
        // Shift all items after this position
        await prisma.$executeRaw`
          UPDATE run_queue_items
          SET "sequenceNo" = "sequenceNo" + 1
          WHERE "competitionDayId" = ${competitionDayId}
            AND "sequenceNo" > ${insertAfterSequenceNo}
        `;
        nextSequenceNo = insertAfterSequenceNo + 1;
      } else {
        // Append to end
        const maxSeq = await prisma.runQueueItem.findFirst({
          where: { competitionDayId },
          orderBy: { sequenceNo: "desc" },
          select: { sequenceNo: true },
        });
        nextSequenceNo = (maxSeq?.sequenceNo ?? 0) + 1;
      }

      const queueItem = await prisma.runQueueItem.create({
        data: {
          ...itemData,
          competitionDayId,
          sequenceNo: nextSequenceNo,
        },
      });

      res.status(201).json(queueItem);
    } catch (error) {
      next(error);
    }
  }
);

// Update queue item
competitionDaysRouter.put(
  "/queue/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = runQueueItemUpdateSchema.parse(req.body);
      // Handle JSON null for splitTimes
      const updateData: any = { ...data };
      if (data.splitTimes !== undefined) {
        updateData.splitTimes = data.splitTimes === null ? Prisma.JsonNull : data.splitTimes;
      }
      const queueItem = await prisma.runQueueItem.update({
        where: { id: req.params.id },
        data: updateData,
      });
      res.json(queueItem);
    } catch (error) {
      next(error);
    }
  }
);

// Delete queue item
competitionDaysRouter.delete(
  "/queue/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const queueItemId = req.params.id;

      // Get the item to find competition day and sequence
      const item = await prisma.runQueueItem.findUnique({
        where: { id: queueItemId },
        select: { competitionDayId: true, sequenceNo: true },
      });

      if (!item) {
        return res.status(404).json({ error: "Queue item not found" });
      }

      // Delete the item
      await prisma.runQueueItem.delete({
        where: { id: queueItemId },
      });

      // Renumber remaining items
      await prisma.$executeRaw`
        UPDATE run_queue_items
        SET "sequenceNo" = "sequenceNo" - 1
        WHERE "competitionDayId" = ${item.competitionDayId}
          AND "sequenceNo" > ${item.sequenceNo}
      `;

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Reorder queue items
competitionDaysRouter.put(
  "/:id/reorder",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const competitionDayId = req.params.id;
      const { queueItemIds } = reorderQueueSchema.parse(req.body);

      // Verify all items belong to this competition day
      const items = await prisma.runQueueItem.findMany({
        where: {
          id: { in: queueItemIds },
          competitionDayId,
        },
      });

      if (items.length !== queueItemIds.length) {
        return res.status(400).json({
          error: "Some queue items not found or belong to different competition day",
        });
      }

      // Update sequence numbers
      await Promise.all(
        queueItemIds.map((itemId, index) =>
          prisma.runQueueItem.update({
            where: { id: itemId },
            data: { sequenceNo: index + 1 },
          })
        )
      );

      // Return updated queue
      const updatedQueue = await prisma.runQueueItem.findMany({
        where: { competitionDayId },
        orderBy: { sequenceNo: "asc" },
      });

      res.json(updatedQueue);
    } catch (error) {
      next(error);
    }
  }
);

// Get competitor times for a queue item
competitionDaysRouter.get(
  "/queue/:id/competitors",
  async (req, res, next) => {
    try {
      const competitorTimes = await prisma.competitorTime.findMany({
        where: { queueItemId: req.params.id },
        orderBy: [
          { ran: "desc" }, // Ran teams first
          { totalTimeSeconds: "asc" }, // Fastest times first (nulls will be handled in frontend)
        ],
      });
      res.json(competitorTimes);
    } catch (error) {
      next(error);
    }
  }
);

// Add competitor time to a queue item
competitionDaysRouter.post(
  "/queue/:id/competitors",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitorTimeSchema.parse(req.body);
      // Handle JSON for splitTimes and optional totalTimeSeconds
      const createData: any = {
        ...data,
        queueItemId: req.params.id,
        ran: data.ran !== undefined ? data.ran : true,
      };
      if (data.totalTimeSeconds === undefined) {
        createData.totalTimeSeconds = null;
      }
      if (data.penaltySeconds === undefined) {
        createData.penaltySeconds = null;
      }
      if (data.splitTimes !== undefined) {
        // If splitTimes is provided and has values, use it; otherwise set to null
        createData.splitTimes = data.splitTimes && Object.keys(data.splitTimes).length > 0 
          ? data.splitTimes 
          : Prisma.JsonNull;
      }
      const competitorTime = await prisma.competitorTime.create({
        data: createData,
      });
      res.status(201).json(competitorTime);
    } catch (error) {
      next(error);
    }
  }
);

// Update competitor time
competitionDaysRouter.put(
  "/competitors/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitorTimeUpdateSchema.parse(req.body);
      // Handle JSON null for splitTimes and optional fields
      const updateData: any = { ...data };
      if (data.splitTimes !== undefined) {
        updateData.splitTimes = data.splitTimes === null ? Prisma.JsonNull : data.splitTimes;
      }
      if (data.totalTimeSeconds === null) {
        updateData.totalTimeSeconds = null;
      }
      if (data.penaltySeconds === null) {
        updateData.penaltySeconds = null;
      }
      const competitorTime = await prisma.competitorTime.update({
        where: { id: req.params.id },
        data: updateData,
      });
      res.json(competitorTime);
    } catch (error) {
      next(error);
    }
  }
);

// Delete competitor time
competitionDaysRouter.delete(
  "/competitors/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.competitorTime.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
