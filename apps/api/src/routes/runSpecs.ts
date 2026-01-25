import { Router } from "express";
import { prisma } from "@waterways/db";
import { createRunSpecSchema, updateRunSpecSchema } from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const runSpecsRouter = Router();

// Markdown route is public (documentation only) - must be defined before authenticate middleware
// and before /:runTypeCode/:version to avoid route conflicts
runSpecsRouter.get("/:runTypeCode/markdown", async (req, res, next) => {
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

    if (!runType || !runType.runSpecs[0]?.markdownPath) {
      return res.status(404).json({ error: "Markdown documentation not found" });
    }

    const markdownPath = runType.runSpecs[0].markdownPath;
    
    // Read markdown file from docs directory
    const fs = await import("fs/promises");
    const pathModule = await import("path");
    const { fileURLToPath } = await import("url");
    const { existsSync } = await import("fs");
    
    // Get project root by going up from API directory
    // In dev (tsx): apps/api/src/routes -> go up 3 levels
    // In prod (compiled): apps/api/dist/routes -> go up 4 levels
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = pathModule.dirname(__filename);
    
    // Try going up 4 levels first (production), then 3 levels (development)
    let projectRoot = pathModule.resolve(__dirname, "../../../..");
    const testPath = pathModule.join(projectRoot, "docs", "runs");
    if (!existsSync(testPath)) {
      // Try 3 levels for development mode
      projectRoot = pathModule.resolve(__dirname, "../../..");
    }
    
    // Markdown path is relative to project root (e.g., /docs/runs/A1.md or docs/runs/A1.md)
    // Remove leading slash and resolve from project root
    const cleanPath = markdownPath.replace(/^\//, "");
    const filePath = pathModule.join(projectRoot, cleanPath);
    
    if (!existsSync(filePath)) {
      console.error(`[/run-specs/${req.params.runTypeCode}/markdown] File not found: ${filePath}`);
      return res.status(404).json({ 
        error: "Markdown file not found",
        requestedPath: markdownPath,
        resolvedPath: filePath,
        projectRoot: projectRoot
      });
    }
    
    try {
      const content = await fs.readFile(filePath, "utf-8");
      res.json({ content, path: markdownPath });
    } catch (fileError) {
      console.error(`[/run-specs/${req.params.runTypeCode}/markdown] Error reading file:`, fileError);
      return res.status(500).json({ 
        error: "Error reading markdown file",
        message: fileError instanceof Error ? fileError.message : "Unknown error",
        path: filePath 
      });
    }
  } catch (error) {
    next(error);
  }
});

runSpecsRouter.use(authenticate);

runSpecsRouter.get("/:runTypeCode", async (req, res, next) => {
  try {
    console.log("[/run-specs] Request received for runTypeCode:", req.params.runTypeCode);
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
      console.log("[/run-specs] Error: Run type not found:", req.params.runTypeCode);
      return res.status(404).json({ error: "Run type not found" });
    }

    console.log("[/run-specs] Run type found:", runType.id, "with", runType.runSpecs.length, "specs");
    const latestSpec = runType.runSpecs[0] || null;
    console.log("[/run-specs] Sending response");
    res.json({
      runType: {
        id: runType.id,
        code: runType.code,
        name: runType.name,
      },
      spec: latestSpec,
    });
  } catch (error) {
    console.error("[/run-specs] Error:", error);
    if (error instanceof Error) {
      console.error("[/run-specs] Error name:", error.name);
      console.error("[/run-specs] Error message:", error.message);
      if (error.stack) {
        console.error("[/run-specs] Error stack:", error.stack);
      }
    }
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
