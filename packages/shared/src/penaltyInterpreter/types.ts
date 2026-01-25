/**
 * Types for penalty interpretation system
 */

export interface SpecAnchor {
  role: "1" | "2" | "3" | "4";
  kind: "order" | "action" | "note";
  index: number;
  label: string;
  text: string;
}

export interface MatchResult {
  tag: string;
  confidence: number; // 0-1
  evidence: string[]; // Snippets matched
  likelyRoles: string[]; // e.g., ["1","3"]
  likelyPhases: string[]; // e.g., ["TARGET1","EXTENSION"]
  specAnchors: SpecAnchor[];
}

export interface RecommendedFocus {
  primaryTag: string;
  primaryRole: string;
  primaryPhase: string;
  coachingMessage: string;
  runLibraryLink: string; // e.g., "/app/run-library?runType=A1&role=1"
}

export interface InterpretationResult {
  summary: string;
  matches: MatchResult[];
  recommendedFocus: RecommendedFocus | null;
}

/**
 * Expected structure of run spec JSON for A1
 */
export interface A1RunSpec {
  runTypeCode?: string;
  name?: string;
  endCondition?: string;
  roles?: {
    "1"?: {
      actions?: string[];
      orders?: string[];
      notes?: string[];
      label?: string;
    };
    "2"?: {
      actions?: string[];
      orders?: string[];
      notes?: string[];
      label?: string;
    };
    "3"?: {
      actions?: string[];
      orders?: string[];
      notes?: string[];
      label?: string;
    };
    "4"?: {
      actions?: string[];
      orders?: string[];
      notes?: string[];
      label?: string;
    };
  };
  phases?: Array<{
    name: string;
    id?: string;
  }>;
  [key: string]: unknown; // Allow other fields
}
