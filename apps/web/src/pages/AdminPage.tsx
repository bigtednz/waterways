import { useState, useEffect } from "react";
import api from "../lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface Season {
  id: string;
  name: string;
  year: number;
  startDate?: string;
  endDate?: string;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  location?: string;
  seasonId: string;
  season?: { name: string; year: number };
}

interface RunType {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface PenaltyRule {
  id: string;
  ruleId: string;
  runTypeCode: string | null;
  ruleText: string;
  taxonomyCode: string;
  severity: string;
  outcomeType: string;
  outcomeSeconds: number | null;
  sourcePdfRef: string | null;
  runType?: { code: string; name: string };
}

interface RunSpec {
  id: string;
  runTypeId: string;
  version: string;
  jsonSpec: any;
  markdownPath?: string | null;
  createdAt: string;
  updatedAt: string;
  runType?: { id: string; code: string; name: string };
}

type Tab = "users" | "seasons" | "competitions" | "run-types" | "penalty-rules" | "run-specs";

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "VIEWER" as "ADMIN" | "COACH" | "VIEWER",
  });

  // Seasons state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonForm, setSeasonForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  // Competitions state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [showCompetitionForm, setShowCompetitionForm] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [competitionForm, setCompetitionForm] = useState({
    name: "",
    date: "",
    location: "",
    seasonId: "",
  });

  // Run Types state
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [showRunTypeForm, setShowRunTypeForm] = useState(false);
  const [editingRunType, setEditingRunType] = useState<RunType | null>(null);
  const [runTypeForm, setRunTypeForm] = useState({
    code: "",
    name: "",
    description: "",
  });

  // Penalty Rules state
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);
  const [showPenaltyRuleForm, setShowPenaltyRuleForm] = useState(false);
  const [editingPenaltyRule, setEditingPenaltyRule] = useState<PenaltyRule | null>(null);
  const [penaltyRuleForm, setPenaltyRuleForm] = useState({
    ruleId: "",
    runTypeCode: "",
    ruleText: "",
    taxonomyCode: "",
    severity: "",
    outcomeType: "",
    outcomeSeconds: 0,
    sourcePdfRef: "",
  });

  // PDF Import state
  const [parsedRules, setParsedRules] = useState<any[]>([]);
  const [showParsedRules, setShowParsedRules] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [importingRules, setImportingRules] = useState(false);

  // Run Specs state
  const [runSpecs, setRunSpecs] = useState<RunSpec[]>([]);
  const [showRunSpecForm, setShowRunSpecForm] = useState(false);
  const [editingRunSpec, setEditingRunSpec] = useState<RunSpec | null>(null);
  const [runSpecForm, setRunSpecForm] = useState({
    runTypeCode: "",
    version: "1.0.0",
    jsonSpec: "",
    markdownPath: "",
  });

  // Load data based on active tab
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case "users":
          const usersRes = await api.get("/users");
          setUsers(usersRes.data);
          break;
        case "seasons":
          const seasonsRes = await api.get("/seasons");
          setSeasons(seasonsRes.data);
          break;
        case "competitions":
          // Load both competitions and seasons (for dropdown)
          const [competitionsRes, seasonsResForComp] = await Promise.all([
            api.get("/competitions"),
            api.get("/seasons"),
          ]);
          setCompetitions(competitionsRes.data);
          setSeasons(seasonsResForComp.data);
          break;
        case "run-types":
          const runTypesRes = await api.get("/run-types");
          setRunTypes(runTypesRes.data);
          break;
        case "penalty-rules":
          // Load both penalty rules and run types (for dropdown)
          const [penaltyRulesRes, runTypesResForPenalty] = await Promise.all([
            api.get("/penalty-rules"),
            api.get("/run-types"),
          ]);
          setPenaltyRules(penaltyRulesRes.data);
          setRunTypes(runTypesResForPenalty.data);
          break;
        case "run-specs":
          // Load run types first, then fetch specs for each
          const runTypesResForSpecs = await api.get("/run-types");
          setRunTypes(runTypesResForSpecs.data);
          
          // Fetch latest spec for each run type
          const specsPromises = runTypesResForSpecs.data.map((rt: RunType) =>
            api.get(`/run-specs/${rt.code}`).catch(() => null)
          );
          const specsResults = await Promise.all(specsPromises);
          const allSpecs: RunSpec[] = [];
          specsResults.forEach((result) => {
            if (result && result.data.spec) {
              allSpecs.push({
                ...result.data.spec,
                runType: result.data.runType,
              });
            }
          });
          setRunSpecs(allSpecs);
          break;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // User management
  const handleCreateUser = async () => {
    try {
      await api.post("/users", userForm);
      setShowUserForm(false);
      resetUserForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/users/${editingUser.id}`, userForm);
      setEditingUser(null);
      resetUserForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete user");
    }
  };

  const resetUserForm = () => {
    setUserForm({ email: "", password: "", name: "", role: "VIEWER" });
    setEditingUser(null);
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: "",
      name: user.name || "",
      role: user.role as "ADMIN" | "COACH" | "VIEWER",
    });
    setShowUserForm(true);
  };

  // Season management
  const handleCreateSeason = async () => {
    try {
      await api.post("/seasons", {
        ...seasonForm,
        startDate: seasonForm.startDate || null,
        endDate: seasonForm.endDate || null,
      });
      setShowSeasonForm(false);
      resetSeasonForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create season");
    }
  };

  const handleUpdateSeason = async () => {
    if (!editingSeason) return;
    try {
      await api.put(`/seasons/${editingSeason.id}`, {
        ...seasonForm,
        startDate: seasonForm.startDate || null,
        endDate: seasonForm.endDate || null,
      });
      setEditingSeason(null);
      resetSeasonForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update season");
    }
  };

  const handleDeleteSeason = async (id: string) => {
    if (!confirm("Are you sure you want to delete this season? This will delete all associated competitions.")) return;
    try {
      await api.delete(`/seasons/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete season");
    }
  };

  const resetSeasonForm = () => {
    setSeasonForm({ name: "", year: new Date().getFullYear(), startDate: "", endDate: "" });
    setEditingSeason(null);
  };

  const startEditSeason = (season: Season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      year: season.year,
      startDate: season.startDate ? new Date(season.startDate).toISOString().split("T")[0] : "",
      endDate: season.endDate ? new Date(season.endDate).toISOString().split("T")[0] : "",
    });
    setShowSeasonForm(true);
  };

  // Competition management
  const handleCreateCompetition = async () => {
    try {
      await api.post("/competitions", {
        ...competitionForm,
        date: new Date(competitionForm.date).toISOString(),
      });
      setShowCompetitionForm(false);
      resetCompetitionForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create competition");
    }
  };

  const handleUpdateCompetition = async () => {
    if (!editingCompetition) return;
    try {
      await api.put(`/competitions/${editingCompetition.id}`, {
        ...competitionForm,
        date: new Date(competitionForm.date).toISOString(),
      });
      setEditingCompetition(null);
      resetCompetitionForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update competition");
    }
  };

  const handleDeleteCompetition = async (id: string) => {
    if (!confirm("Are you sure you want to delete this competition? This will delete all associated run results.")) return;
    try {
      await api.delete(`/competitions/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete competition");
    }
  };

    const resetCompetitionForm = () => {
      setCompetitionForm({ name: "", date: "", location: "", seasonId: "" });
      setEditingCompetition(null);
    };

    const startEditCompetition = (competition: Competition) => {
      setEditingCompetition(competition);
      setCompetitionForm({
        name: competition.name,
        date: new Date(competition.date).toISOString().split("T")[0],
        location: competition.location || "",
        seasonId: competition.seasonId,
      });
      setShowCompetitionForm(true);
    };

  // Run Type management
  const handleCreateRunType = async () => {
    try {
      await api.post("/run-types", runTypeForm);
      setShowRunTypeForm(false);
      resetRunTypeForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create run type");
    }
  };

  const handleUpdateRunType = async () => {
    if (!editingRunType) return;
    try {
      await api.put(`/run-types/${editingRunType.id}`, runTypeForm);
      setEditingRunType(null);
      resetRunTypeForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update run type");
    }
  };

  const handleDeleteRunType = async (id: string) => {
    if (!confirm("Are you sure you want to delete this run type? This will delete all associated data.")) return;
    try {
      await api.delete(`/run-types/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete run type");
    }
  };

  const resetRunTypeForm = () => {
    setRunTypeForm({ code: "", name: "", description: "" });
    setEditingRunType(null);
  };

  const startEditRunType = (runType: RunType) => {
    setEditingRunType(runType);
    setRunTypeForm({
      code: runType.code,
      name: runType.name,
      description: runType.description || "",
    });
    setShowRunTypeForm(true);
  };

  // Penalty Rule management
  const handleCreatePenaltyRule = async () => {
    try {
      await api.post("/penalty-rules", {
        ...penaltyRuleForm,
        runTypeCode: penaltyRuleForm.runTypeCode || null,
        outcomeSeconds: penaltyRuleForm.outcomeSeconds || null,
        sourcePdfRef: penaltyRuleForm.sourcePdfRef || null,
      });
      setShowPenaltyRuleForm(false);
      resetPenaltyRuleForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create penalty rule");
    }
  };

  const handleUpdatePenaltyRule = async () => {
    if (!editingPenaltyRule) return;
    try {
      await api.put(`/penalty-rules/${editingPenaltyRule.id}`, {
        ...penaltyRuleForm,
        runTypeCode: penaltyRuleForm.runTypeCode || null,
        outcomeSeconds: penaltyRuleForm.outcomeSeconds || null,
        sourcePdfRef: penaltyRuleForm.sourcePdfRef || null,
      });
      setEditingPenaltyRule(null);
      resetPenaltyRuleForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update penalty rule");
    }
  };

  const handleDeletePenaltyRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this penalty rule?")) return;
    try {
      await api.delete(`/penalty-rules/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete penalty rule");
    }
  };

  const resetPenaltyRuleForm = () => {
    setPenaltyRuleForm({
      ruleId: "",
      runTypeCode: "",
      ruleText: "",
      taxonomyCode: "",
      severity: "",
      outcomeType: "",
      outcomeSeconds: 0,
      sourcePdfRef: "",
    });
    setEditingPenaltyRule(null);
  };

  const startEditPenaltyRule = (rule: PenaltyRule) => {
    setEditingPenaltyRule(rule);
    setPenaltyRuleForm({
      ruleId: rule.ruleId,
      runTypeCode: rule.runTypeCode || "",
      ruleText: rule.ruleText,
      taxonomyCode: rule.taxonomyCode,
      severity: rule.severity,
      outcomeType: rule.outcomeType,
      outcomeSeconds: rule.outcomeSeconds || 0,
      sourcePdfRef: rule.sourcePdfRef || "",
    });
    setShowPenaltyRuleForm(true);
  };

  // PDF Upload handlers
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploadingPdf(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await api.post('/penalty-rules/parse-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setParsedRules(response.data.rules || []);
      setShowParsedRules(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to parse PDF');
    } finally {
      setUploadingPdf(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleBulkImport = async () => {
    if (parsedRules.length === 0) {
      setError('No rules to import');
      return;
    }

    setImportingRules(true);
    setError(null);

    try {
      // Clean up parsed rules to match API schema (remove confidence, rawText)
      const rulesToImport = parsedRules.map((rule: any) => ({
        ruleId: rule.ruleId,
        runTypeCode: rule.runTypeCode || null,
        ruleText: rule.ruleText,
        taxonomyCode: rule.taxonomyCode,
        severity: rule.severity,
        outcomeType: rule.outcomeType,
        outcomeSeconds: rule.outcomeSeconds,
        sourcePdfRef: rule.sourcePdfRef,
      }));

      const response = await api.post('/penalty-rules/bulk', rulesToImport);

      alert(
        `Successfully imported ${response.data.created} penalty rules.\n` +
        `Skipped: ${response.data.skipped}\n` +
        `Errors: ${response.data.errors}`
      );

      setShowParsedRules(false);
      setParsedRules([]);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to import penalty rules');
    } finally {
      setImportingRules(false);
    }
  };

  // Run Spec management
  const handleCreateRunSpec = async () => {
    // Validate required fields
    if (!runSpecForm.runTypeCode) {
      setError("Please select a Run Type");
      return;
    }
    if (!runSpecForm.version || !runSpecForm.version.trim()) {
      setError("Please enter a version (e.g., 1.0.0)");
      return;
    }
    if (!runSpecForm.jsonSpec.trim()) {
      setError("Please enter a JSON specification");
      return;
    }

    try {
      let jsonSpec;
      try {
        jsonSpec = JSON.parse(runSpecForm.jsonSpec);
      } catch (e) {
        setError(`Invalid JSON format: ${e instanceof Error ? e.message : "Unknown error"}. Please check your JSON syntax.`);
        return;
      }

      setError(null); // Clear any previous errors
      const payload: any = {
        runTypeCode: runSpecForm.runTypeCode,
        version: runSpecForm.version.trim() || "1.0.0", // Use default if empty
        jsonSpec,
      };
      // Only include markdownPath if it has a value (don't send null)
      if (runSpecForm.markdownPath?.trim()) {
        payload.markdownPath = runSpecForm.markdownPath.trim();
      }
      await api.post("/run-specs", payload);
      setShowRunSpecForm(false);
      resetRunSpecForm();
      loadData();
    } catch (err: any) {
      console.error("Error creating run spec:", err);
      console.error("Error response:", err.response?.data);
      
      // Handle Zod validation errors
      if (err.response?.data?.issues) {
        // Zod error format with issues array
        const zodErrors = err.response.data.issues.map((e: any) => {
          const path = e.path?.join('.') || 'field';
          return `${path}: ${e.message}`;
        }).join(', ');
        setError(`Validation error: ${zodErrors}`);
      } else if (err.response?.data?.error) {
        if (Array.isArray(err.response.data.error)) {
          // Alternative error array format
          const zodErrors = err.response.data.error.map((e: any) => 
            `${e.path?.join('.') || 'field'}: ${e.message}`
          ).join(', ');
          setError(`Validation error: ${zodErrors}`);
        } else if (typeof err.response.data.error === 'string') {
          setError(err.response.data.error);
        } else {
          setError(JSON.stringify(err.response.data.error));
        }
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.details) {
        setError(err.response.data.details);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Failed to create run specification. Please check the console for details.");
      }
    }
  };

  const handleUpdateRunSpec = async () => {
    if (!editingRunSpec) return;
    try {
      let jsonSpec;
      try {
        jsonSpec = JSON.parse(runSpecForm.jsonSpec);
      } catch (e) {
        setError("Invalid JSON format. Please check your JSON syntax.");
        return;
      }

      const updatePayload: any = {
        version: runSpecForm.version.trim() || "1.0.0",
        jsonSpec,
      };
      // Only include markdownPath if it has a value (don't send null)
      if (runSpecForm.markdownPath?.trim()) {
        updatePayload.markdownPath = runSpecForm.markdownPath.trim();
      }
      await api.put(`/run-specs/${editingRunSpec.id}`, updatePayload);
      setEditingRunSpec(null);
      resetRunSpecForm();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to update run specification");
    }
  };

  const handleDeleteRunSpec = async (id: string) => {
    if (!confirm("Are you sure you want to delete this run specification?")) return;
    try {
      await api.delete(`/run-specs/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to delete run specification");
    }
  };

  const resetRunSpecForm = () => {
    setRunSpecForm({
      runTypeCode: "",
      version: "1.0.0",
      jsonSpec: "",
      markdownPath: "",
    });
    setEditingRunSpec(null);
  };

  const startEditRunSpec = (spec: RunSpec) => {
    setEditingRunSpec(spec);
    setRunSpecForm({
      runTypeCode: spec.runType?.code || "",
      version: spec.version,
      jsonSpec: JSON.stringify(spec.jsonSpec, null, 2),
      markdownPath: spec.markdownPath || "",
    });
    setShowRunSpecForm(true);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Users" },
    { id: "seasons", label: "Seasons" },
    { id: "competitions", label: "Competitions" },
    { id: "run-types", label: "Run Types" },
    { id: "penalty-rules", label: "Penalty Rules" },
    { id: "run-specs", label: "Run Specifications" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Users</h2>
                <button
                  onClick={() => {
                    resetUserForm();
                    setShowUserForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add User
                </button>
              </div>

              {showUserForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingUser ? "Edit User" : "Create User"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {editingUser ? "New Password (leave blank to keep current)" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        value={userForm.role}
                        onChange={(e) =>
                          setUserForm({ ...userForm, role: e.target.value as "ADMIN" | "COACH" | "VIEWER" })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="COACH">Coach</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingUser ? handleUpdateUser : handleCreateUser}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingUser ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowUserForm(false);
                        resetUserForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.name || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === "ADMIN"
                                ? "bg-purple-100 text-purple-800"
                                : user.role === "COACH"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditUser(user)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seasons Tab */}
          {activeTab === "seasons" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Seasons</h2>
                <button
                  onClick={() => {
                    resetSeasonForm();
                    setShowSeasonForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Season
                </button>
              </div>

              {showSeasonForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingSeason ? "Edit Season" : "Create Season"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={seasonForm.name}
                        onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year
                      </label>
                      <input
                        type="number"
                        value={seasonForm.year}
                        onChange={(e) => setSeasonForm({ ...seasonForm, year: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={seasonForm.startDate}
                        onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={seasonForm.endDate}
                        onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingSeason ? handleUpdateSeason : handleCreateSeason}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingSeason ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowSeasonForm(false);
                        resetSeasonForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Year
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {seasons.map((season) => (
                      <tr key={season.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {season.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {season.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {season.startDate ? new Date(season.startDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {season.endDate ? new Date(season.endDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditSeason(season)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSeason(season.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Competitions Tab */}
          {activeTab === "competitions" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Competitions</h2>
                <button
                  onClick={() => {
                    resetCompetitionForm();
                    setShowCompetitionForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Competition
                </button>
              </div>

              {showCompetitionForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingCompetition ? "Edit Competition" : "Create Competition"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={competitionForm.name}
                        onChange={(e) => setCompetitionForm({ ...competitionForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={competitionForm.date}
                        onChange={(e) => setCompetitionForm({ ...competitionForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={competitionForm.location}
                        onChange={(e) => setCompetitionForm({ ...competitionForm, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Season
                      </label>
                      <select
                        value={competitionForm.seasonId}
                        onChange={(e) => setCompetitionForm({ ...competitionForm, seasonId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Season</option>
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name} ({season.year})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingCompetition ? handleUpdateCompetition : handleCreateCompetition}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingCompetition ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowCompetitionForm(false);
                        resetCompetitionForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Season
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {competitions.map((competition) => (
                      <tr key={competition.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {competition.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(competition.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {competition.location || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {competition.season ? `${competition.season.name} (${competition.season.year})` : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditCompetition(competition)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCompetition(competition.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Run Types Tab */}
          {activeTab === "run-types" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Run Types</h2>
                <button
                  onClick={() => {
                    resetRunTypeForm();
                    setShowRunTypeForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Run Type
                </button>
              </div>

              {showRunTypeForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingRunType ? "Edit Run Type" : "Create Run Type"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Code
                      </label>
                      <input
                        type="text"
                        value={runTypeForm.code}
                        onChange={(e) => setRunTypeForm({ ...runTypeForm, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={!!editingRunType}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={runTypeForm.name}
                        onChange={(e) => setRunTypeForm({ ...runTypeForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={runTypeForm.description}
                        onChange={(e) => setRunTypeForm({ ...runTypeForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingRunType ? handleUpdateRunType : handleCreateRunType}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingRunType ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowRunTypeForm(false);
                        resetRunTypeForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {runTypes.map((runType) => (
                      <tr key={runType.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {runType.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {runType.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {runType.description || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditRunType(runType)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRunType(runType.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Penalty Rules Tab */}
          {activeTab === "penalty-rules" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Penalty Rules</h2>
                <div className="flex gap-2">
                  <label className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
                    📄 Upload PDF
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                      disabled={uploadingPdf}
                    />
                  </label>
                  <button
                    onClick={() => {
                      resetPenaltyRuleForm();
                      setShowPenaltyRuleForm(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    + Add Penalty Rule
                  </button>
                </div>
              </div>

              {uploadingPdf && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800">Parsing PDF... Please wait.</p>
                </div>
              )}

              {showParsedRules && parsedRules.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      Review Parsed Rules ({parsedRules.length} found)
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBulkImport}
                        disabled={importingRules}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {importingRules ? "Importing..." : `Import All (${parsedRules.length})`}
                      </button>
                      <button
                        onClick={() => {
                          setShowParsedRules(false);
                          setParsedRules([]);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    <p>Review the parsed rules below. You can edit them before importing, or import as-is.</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Note: Rules with low confidence scores may need manual review.
                    </p>
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rule ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Run Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rule Text</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seconds</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {parsedRules.map((rule: any, index: number) => (
                          <tr key={index} className={rule.confidence < 0.5 ? "bg-yellow-50" : ""}>
                            <td className="px-4 py-2 text-sm font-medium">{rule.ruleId}</td>
                            <td className="px-4 py-2 text-sm">{rule.runTypeCode || "All"}</td>
                            <td className="px-4 py-2 text-sm max-w-xs truncate" title={rule.ruleText}>
                              {rule.ruleText}
                            </td>
                            <td className="px-4 py-2 text-sm">{rule.severity}</td>
                            <td className="px-4 py-2 text-sm">{rule.outcomeType}</td>
                            <td className="px-4 py-2 text-sm">{rule.outcomeSeconds || "-"}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded text-xs ${
                                rule.confidence >= 0.7 ? "bg-green-100 text-green-800" :
                                rule.confidence >= 0.5 ? "bg-yellow-100 text-yellow-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {(rule.confidence * 100).toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {showPenaltyRuleForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingPenaltyRule ? "Edit Penalty Rule" : "Create Penalty Rule"}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rule ID
                      </label>
                      <input
                        type="text"
                        value={penaltyRuleForm.ruleId}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, ruleId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Run Type Code (optional)
                      </label>
                      <select
                        value={penaltyRuleForm.runTypeCode}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, runTypeCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Run Types</option>
                        {runTypes.map((rt) => (
                          <option key={rt.id} value={rt.code}>
                            {rt.code} - {rt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rule Text
                      </label>
                      <textarea
                        value={penaltyRuleForm.ruleText}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, ruleText: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Taxonomy Code
                      </label>
                      <input
                        type="text"
                        value={penaltyRuleForm.taxonomyCode}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, taxonomyCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Severity
                      </label>
                      <select
                        value={penaltyRuleForm.severity}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, severity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Severity</option>
                        <option value="minor">Minor</option>
                        <option value="major">Major</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Outcome Type
                      </label>
                      <select
                        value={penaltyRuleForm.outcomeType}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, outcomeType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Outcome</option>
                        <option value="time_penalty">Time Penalty</option>
                        <option value="disqualification">Disqualification</option>
                        <option value="warning">Warning</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Outcome Seconds
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={penaltyRuleForm.outcomeSeconds}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, outcomeSeconds: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source PDF Reference
                      </label>
                      <input
                        type="text"
                        value={penaltyRuleForm.sourcePdfRef}
                        onChange={(e) => setPenaltyRuleForm({ ...penaltyRuleForm, sourcePdfRef: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., Section 4.2.3, Page 12"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingPenaltyRule ? handleUpdatePenaltyRule : handleCreatePenaltyRule}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingPenaltyRule ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowPenaltyRuleForm(false);
                        resetPenaltyRuleForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rule ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Run Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rule Text
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Seconds
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {penaltyRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rule.ruleId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rule.runType ? `${rule.runType.code}` : "All"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {rule.ruleText}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              rule.severity === "critical"
                                ? "bg-red-100 text-red-800"
                                : rule.severity === "major"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rule.outcomeType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rule.outcomeSeconds || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditPenaltyRule(rule)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePenaltyRule(rule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Run Specifications Tab */}
          {activeTab === "run-specs" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Run Specifications</h2>
                <button
                  onClick={() => {
                    setError(null);
                    resetRunSpecForm();
                    setShowRunSpecForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Run Specification
                </button>
              </div>

              {showRunSpecForm && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {editingRunSpec ? "Edit Run Specification" : "Create Run Specification"}
                  </h3>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Run Type
                      </label>
                      <select
                        value={runSpecForm.runTypeCode}
                        onChange={(e) => setRunSpecForm({ ...runSpecForm, runTypeCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={!!editingRunSpec}
                      >
                        <option value="">Select Run Type</option>
                        {runTypes.map((rt) => (
                          <option key={rt.id} value={rt.code}>
                            {rt.code} - {rt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Version
                      </label>
                      <input
                        type="text"
                        value={runSpecForm.version}
                        onChange={(e) => setRunSpecForm({ ...runSpecForm, version: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="1.0.0"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Use semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        JSON Specification
                      </label>
                      <textarea
                        value={runSpecForm.jsonSpec}
                        onChange={(e) => setRunSpecForm({ ...runSpecForm, jsonSpec: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                        rows={15}
                        placeholder='{\n  "metadata": { ... },\n  "procedure": { ... }\n}'
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter valid JSON. The system will validate the format before saving.
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Markdown Path (optional)
                      </label>
                      <input
                        type="text"
                        value={runSpecForm.markdownPath}
                        onChange={(e) => setRunSpecForm({ ...runSpecForm, markdownPath: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="/docs/runs/A1.md"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Path to markdown documentation file (e.g., /docs/runs/A1.md)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingRunSpec ? handleUpdateRunSpec : handleCreateRunSpec}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      disabled={!runSpecForm.runTypeCode || !runSpecForm.version || !runSpecForm.jsonSpec.trim()}
                    >
                      {editingRunSpec ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowRunSpecForm(false);
                        resetRunSpecForm();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Run Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Version
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        JSON Spec Preview
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Markdown Path
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Updated
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {runSpecs.map((spec) => (
                      <tr key={spec.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {spec.runType ? `${spec.runType.code} - ${spec.runType.name}` : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {spec.version}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                          <div className="truncate font-mono text-xs">
                            {JSON.stringify(spec.jsonSpec).substring(0, 100)}
                            {JSON.stringify(spec.jsonSpec).length > 100 ? "..." : ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {spec.markdownPath || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(spec.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => startEditRunSpec(spec)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRunSpec(spec.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {runSpecs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          No run specifications found. Create one to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
