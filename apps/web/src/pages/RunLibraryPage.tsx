import { useEffect, useState } from "react";
import api from "../lib/api";

interface RunType {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface RunSpec {
  runType: { id: string; code: string; name: string };
  spec: {
    id: string;
    jsonSpec: any;
    markdownPath?: string;
  } | null;
}

export function RunLibraryPage() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedRunType, setSelectedRunType] = useState<string>("");
  const [runSpec, setRunSpec] = useState<RunSpec | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/run-types")
      .then((res) => {
        setRunTypes(res.data);
        if (res.data.length > 0) {
          setSelectedRunType(res.data[0].code);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRunType) {
      api
        .get(`/run-specs/${selectedRunType}`)
        .then((res) => setRunSpec(res.data))
        .catch(() => setRunSpec(null));
    }
  }, [selectedRunType]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Run Library</h1>
        <p className="text-gray-600 mt-1">View run specifications and procedures</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Run Types</h2>
          <div className="space-y-2">
            {runTypes.map((rt) => (
              <button
                key={rt.id}
                onClick={() => setSelectedRunType(rt.code)}
                className={`w-full text-left px-4 py-2 rounded-md ${
                  selectedRunType === rt.code
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {rt.code} - {rt.name}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 bg-white rounded-lg shadow p-6">
          {selectedRunType && (
            <>
              <h2 className="text-lg font-semibold mb-4">
                {runSpec?.runType.name || runTypes.find((rt) => rt.code === selectedRunType)?.name}
              </h2>
              {runSpec?.spec ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Specification (JSON)</h3>
                    <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
                      {JSON.stringify(runSpec.spec.jsonSpec, null, 2)}
                    </pre>
                  </div>
                  {runSpec.spec.markdownPath && (
                    <div>
                      <p className="text-sm text-gray-500">
                        Markdown documentation: {runSpec.spec.markdownPath}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No specification available for this run type.</p>
                  <p className="text-sm mt-2">
                    Specifications can be added via the database or API.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
