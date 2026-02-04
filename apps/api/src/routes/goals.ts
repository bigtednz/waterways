import { Router } from "express";
import { prisma } from "@waterways/db";
import { createGoalSchema, updateGoalSchema } from "@waterways/shared";
import { authenticate, AuthRequest } from "../middleware/auth.js";

export const goalsRouter = Router();

goalsRouter.use(authenticate);

// Helper function to calculate progress (0-100)
function calculateProgress(current: number, target: number, type: string): number {
  if (target === 0) return 0;
  
  switch (type) {
    case "TIME":
      if (current <= target) return 100;
      const maxTime = target * 1.2; // 20% buffer
      if (current >= maxTime) return 0;
      return Math.max(0, Math.min(100, ((maxTime - current) / (maxTime - target)) * 100));
    
    case "PENALTY":
      if (current <= target) return 100;
      const maxPenalty = target * 2; // 100% buffer
      if (current >= maxPenalty) return 0;
      return Math.max(0, Math.min(100, ((maxPenalty - current) / (maxPenalty - target)) * 100));
    
    case "CONSISTENCY":
      if (current <= target) return 100;
      const maxIQR = target * 1.5; // 50% buffer
      if (current >= maxIQR) return 0;
      return Math.max(0, Math.min(100, ((maxIQR - current) / (maxIQR - target)) * 100));
    
    case "COMPLETION":
      if (current >= target) return 100;
      return Math.max(0, Math.min(100, (current / target) * 100));
    
    default:
      return 0;
  }
}

// Helper function to calculate status
function calculateStatus(progress: number, deadline: Date | null, type: string): string {
  if (progress >= 100) return "ACHIEVED";
  
  if (!deadline) {
    if (progress >= 75) return "ON_TRACK";
    if (progress >= 50) return "AT_RISK";
    return "NOT_STARTED";
  }
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  if (progress >= 100) return "ACHIEVED";
  if (daysRemaining < 0 && progress < 100) return "MISSED";
  if (progress >= 75) return "ON_TRACK";
  if (progress >= 50) return "AT_RISK";
  return "NOT_STARTED";
}

// Get all goals for the authenticated user
goalsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    const goals = await prisma.goal.findMany({
      where: {
        userId: req.userId!,
        ...(seasonId ? { seasonId } : {}),
      },
      include: {
        season: true,
        history: {
          orderBy: { date: "desc" },
          take: 50, // Limit to last 50 entries
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(goals);
  } catch (error) {
    next(error);
  }
});

// Get a single goal
goalsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
      include: {
        season: true,
        history: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json(goal);
  } catch (error) {
    next(error);
  }
});

// Create a new goal
goalsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const data = createGoalSchema.parse(req.body);
    
    const progress = calculateProgress(data.current, data.target, data.type);
    const deadline = data.deadline ? new Date(data.deadline) : null;
    const status = calculateStatus(progress, deadline, data.type) as any;

    const goal = await prisma.goal.create({
      data: {
        userId: req.userId!,
        type: data.type as any,
        title: data.title,
        description: data.description || null,
        target: data.target,
        current: data.current,
        unit: data.unit,
        deadline: deadline,
        seasonId: data.seasonId || null,
        progress,
        status,
        autoUpdate: data.autoUpdate,
        autoUpdateSource: data.autoUpdateSource as any || null,
      },
      include: {
        season: true,
        history: true,
      },
    });

    // Create initial history entry
    await prisma.goalHistory.create({
      data: {
        goalId: goal.id,
        current: data.current,
        progress,
        status: goal.status,
        note: "Goal created",
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
});

// Update a goal
goalsRouter.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    // Verify goal belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!existingGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const data = updateGoalSchema.parse(req.body);
    
    // Get current values or use existing
    const current = data.current !== undefined ? data.current : existingGoal.current;
    const target = data.target !== undefined ? data.target : existingGoal.target;
    const type = (data.type || existingGoal.type) as string;
    const deadline = data.deadline !== undefined 
      ? (data.deadline ? new Date(data.deadline) : null)
      : existingGoal.deadline;

    const progress = calculateProgress(current, target, type);
    const status = calculateStatus(progress, deadline, type) as any;
    
    // Check if goal was just achieved
    const wasJustAchieved = existingGoal.status !== "ACHIEVED" && status === "ACHIEVED";
    const achievedAt = wasJustAchieved ? new Date() : existingGoal.achievedAt;

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...(data.type && { type: data.type as any }),
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.target !== undefined && { target: data.target }),
        ...(data.current !== undefined && { current: data.current }),
        ...(data.unit && { unit: data.unit }),
        ...(data.deadline !== undefined && { deadline }),
        ...(data.seasonId !== undefined && { seasonId: data.seasonId || null }),
        progress,
        status,
        achievedAt,
        ...(data.autoUpdate !== undefined && { autoUpdate: data.autoUpdate }),
        ...(data.autoUpdateSource !== undefined && { autoUpdateSource: data.autoUpdateSource as any || null }),
      },
      include: {
        season: true,
        history: {
          orderBy: { date: "desc" },
          take: 50,
        },
      },
    });

    // Add history entry if current value changed
    if (data.current !== undefined && Math.abs(data.current - existingGoal.current) > 0.01) {
      await prisma.goalHistory.create({
        data: {
          goalId: goal.id,
          current: data.current,
          progress,
          status: goal.status,
          note: "Manual update",
        },
      });

      // Keep only last 50 history entries
      const history = await prisma.goalHistory.findMany({
        where: { goalId: goal.id },
        orderBy: { date: "desc" },
      });

      if (history.length > 50) {
        const toDelete = history.slice(50);
        await prisma.goalHistory.deleteMany({
          where: {
            id: { in: toDelete.map(h => h.id) },
          },
        });
      }
    }

    res.json(goal);
  } catch (error) {
    next(error);
  }
});

// Delete a goal
goalsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    // Verify goal belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!existingGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    await prisma.goal.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
