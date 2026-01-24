import { Router } from "express";
import { prisma } from "@waterways/db";
import { createRunSpecSchema, updateRunSpecSchema } from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const runSpecsRouter = Router();

runSpecsRouter.use(authenticate);

runSpecsRouter.get("/:runTypeCode", async (req, res, next) => {
  try {
    const runType = await prisma.runType.findUnique({
      where: { code: req.params.runTypeCode },
      include: {
        runSpecs: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    const latestSpec = runType.runSpecs[0] || null;
    res.json({
      runType: {
        id: runType.id,
        code: runType.code,
        name: runType.name,
      },
      spec: latestSpec,
    });
  } catch (error) {
    next(error);
  }
});

runSpecsRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = createRunSpecSchema.parse(req.body);

      // Find run type by code
      const runType = await prisma.runType.findUnique({
        where: { code: data.runTypeCode },
      });

      if (!runType) {
        return res.status(404).json({ error: "Run type not found" });
      }

      // Check if version already exists for this run type
      const existing = await prisma.runSpec.findUnique({
        where: {
          runTypeId_version: {
            runTypeId: runType.id,
            version: data.version,
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          error: `Version ${data.version} already exists for run type ${data.runTypeCode}`,
        });
      }

      const runSpec = await prisma.runSpec.create({
        data: {
          runTypeId: runType.id,
          version: data.version,
          jsonSpec: data.jsonSpec,
          markdownPath: data.markdownPath,
        },
        include: {
          runType: true,
        },
      });

      res.status(201).json(runSpec);
    } catch (error) {
      next(error);
    }
  }
);

runSpecsRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = updateRunSpecSchema.parse(req.body);
      const { id } = req.params;

      // Get existing spec to check version conflicts
      const existing = await prisma.runSpec.findUnique({
        where: { id },
        include: { runType: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "Run specification not found" });
      }

      // If version is being changed, check for conflicts
      if (data.version && data.version !== existing.version) {
        const conflict = await prisma.runSpec.findUnique({
          where: {
            runTypeId_version: {
              runTypeId: existing.runTypeId,
              version: data.version,
            },
          },
        });

        if (conflict) {
          return res.status(409).json({
            error: `Version ${data.version} already exists for run type ${existing.runType.code}`,
          });
        }
      }

      const runSpec = await prisma.runSpec.update({
        where: { id },
        data: {
          version: data.version,
          jsonSpec: data.jsonSpec,
          markdownPath: data.markdownPath,
        },
        include: {
          runType: true,
        },
      });

      res.json(runSpec);
    } catch (error) {
      next(error);
    }
  }
);

runSpecsRouter.delete(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.runSpec.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

runSpecsRouter.get("/:runTypeCode/versions", async (req, res, next) => {
  try {
    const runType = await prisma.runType.findUnique({
      where: { code: req.params.runTypeCode },
      include: {
        runSpecs: {
          orderBy: { version: "desc" },
        },
      },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    res.json({
      runType: {
        id: runType.id,
        code: runType.code,
        name: runType.name,
      },
      specs: runType.runSpecs,
    });
  } catch (error) {
    next(error);
  }
});

runSpecsRouter.get("/:runTypeCode/:version", async (req, res, next) => {
  try {
    const runType = await prisma.runType.findUnique({
      where: { code: req.params.runTypeCode },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    const spec = await prisma.runSpec.findUnique({
      where: {
        runTypeId_version: {
          runTypeId: runType.id,
          version: req.params.version,
        },
      },
      include: {
        runType: true,
      },
    });

    if (!spec) {
      return res.status(404).json({ error: "Specification version not found" });
    }

    res.json({
      runType: {
        id: runType.id,
        code: runType.code,
        name: runType.name,
      },
      spec,
    });
  } catch (error) {
    next(error);
  }
});
