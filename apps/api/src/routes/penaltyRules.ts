import { Router } from "express";
import { prisma } from "@waterways/db";
import { z } from "zod";
// @ts-ignore - multer doesn't have perfect TypeScript support
import multer from "multer";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";
import { extractPenaltyRulesFromPdf, type ParsedPenaltyRule } from "../lib/pdfPenaltyParser.js";

export const penaltyRulesRouter = Router();

penaltyRulesRouter.use(authenticate);

const penaltyRuleSchema = z.object({
  ruleId: z.string().min(1),
  runTypeCode: z.string().optional().nullable(),
  ruleText: z.string().min(1),
  taxonomyCode: z.string().min(1),
  severity: z.string().min(1),
  outcomeType: z.string().min(1),
  outcomeSeconds: z.number().min(0).optional().nullable(),
  sourcePdfRef: z.string().optional().nullable(),
});

penaltyRulesRouter.get("/", async (req, res, next) => {
  try {
    const runTypeCode = req.query.runTypeCode as string | undefined;

    const penaltyRules = await prisma.penaltyRule.findMany({
      where: runTypeCode
        ? {
            OR: [{ runTypeCode }, { runTypeCode: null }],
          }
        : undefined,
      include: {
        runType: true,
      },
      orderBy: { ruleId: "asc" },
    });

    res.json(penaltyRules);
  } catch (error) {
    next(error);
  }
});

penaltyRulesRouter.get("/:id", async (req, res, next) => {
  try {
    const penaltyRule = await prisma.penaltyRule.findUnique({
      where: { id: req.params.id },
      include: {
        runType: true,
      },
    });

    if (!penaltyRule) {
      return res.status(404).json({ error: "Penalty rule not found" });
    }

    res.json(penaltyRule);
  } catch (error) {
    next(error);
  }
});

penaltyRulesRouter.post(
  "/",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = penaltyRuleSchema.parse(req.body);
      const penaltyRule = await prisma.penaltyRule.create({
        data: {
          ...data,
          runTypeCode: data.runTypeCode || null,
        },
        include: {
          runType: true,
        },
      });
      res.status(201).json(penaltyRule);
    } catch (error) {
      next(error);
    }
  }
);

penaltyRulesRouter.put(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = penaltyRuleSchema.partial().parse(req.body);
      const updateData: any = { ...data };
      if (data.runTypeCode !== undefined) {
        updateData.runTypeCode = data.runTypeCode;
      }
      const penaltyRule = await prisma.penaltyRule.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          runType: true,
        },
      });
      res.json(penaltyRule);
    } catch (error) {
      next(error);
    }
  }
);

penaltyRulesRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.penaltyRule.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Bulk import endpoint
const bulkPenaltyRuleSchema = z.array(penaltyRuleSchema);

penaltyRulesRouter.post(
  "/bulk",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      const rules = bulkPenaltyRuleSchema.parse(req.body);
      
      const results = {
        created: [] as any[],
        skipped: [] as string[],
        errors: [] as string[],
      };

      for (const ruleData of rules) {
        try {
          // Check if rule already exists
          const existing = await prisma.penaltyRule.findUnique({
            where: { ruleId: ruleData.ruleId },
          });

          if (existing) {
            results.skipped.push(ruleData.ruleId);
            continue;
          }

          const penaltyRule = await prisma.penaltyRule.create({
            data: {
              ...ruleData,
              runTypeCode: ruleData.runTypeCode || null,
              outcomeSeconds: ruleData.outcomeSeconds || null,
              sourcePdfRef: ruleData.sourcePdfRef || null,
            },
            include: {
              runType: true,
            },
          });

          results.created.push(penaltyRule);
        } catch (error: any) {
          results.errors.push(`${ruleData.ruleId}: ${error.message || 'Unknown error'}`);
        }
      }

      res.status(201).json({
        message: `Imported ${results.created.length} penalty rules`,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        details: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PDF upload and parse endpoint
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

penaltyRulesRouter.post(
  "/parse-pdf",
  requireRole("ADMIN"),
  upload.single('pdf'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      const parsedRules = await extractPenaltyRulesFromPdf(req.file.buffer);

      res.json({
        message: `Parsed ${parsedRules.length} penalty rules from PDF`,
        rules: parsedRules,
        count: parsedRules.length,
      });
    } catch (error: any) {
      next(error);
    }
  }
);
