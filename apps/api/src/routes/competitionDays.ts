import { Router } from "express";
import { prisma } from "@waterways/db";
import {
  competitionDaySchema,
  runQueueItemSchema,
  runQueueItemUpdateSchema,
  reorderQueueSchema,
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
      const queueItem = await prisma.runQueueItem.update({
        where: { id: req.params.id },
        data,
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
