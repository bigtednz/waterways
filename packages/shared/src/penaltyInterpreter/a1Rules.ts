/**
 * A1-specific keyword patterns and mappings for penalty interpretation
 */

import type { SpecAnchor, A1RunSpec } from "./types.js";

export interface RuleDefinition {
  tag: string;
  keywords: string[];
  defaultRoles: string[];
  defaultPhases: string[];
  extractAnchors: (spec: A1RunSpec) => SpecAnchor[];
  boostRoleMentions?: boolean; // If true, boost confidence when role number is mentioned
}

/**
 * Extract anchors for ORDERS tag
 */
function extractOrdersAnchors(spec: A1RunSpec): SpecAnchor[] {
  const anchors: SpecAnchor[] = [];
  
  if (!spec.roles) return anchors;
  
  // Role 1 orders
  if (spec.roles["1"]?.orders) {
    spec.roles["1"].orders.forEach((order, index) => {
      anchors.push({
        role: "1",
        kind: "order",
        index,
        label: spec.roles?.["1"]?.label || "Role 1",
        text: order,
      });
    });
  }
  
  // Role 3 notes about valve + order completion
  if (spec.roles["3"]?.notes) {
    spec.roles["3"].notes.forEach((note, index) => {
      const lowerNote = note.toLowerCase();
      if (lowerNote.includes("valve") || lowerNote.includes("order")) {
        anchors.push({
          role: "3",
          kind: "note",
          index,
          label: spec.roles?.["3"]?.label || "Role 3",
          text: note,
        });
      }
    });
  }
  
  return anchors;
}

/**
 * Extract anchors for FLUSH tag
 */
function extractFlushAnchors(spec: A1RunSpec): SpecAnchor[] {
  const anchors: SpecAnchor[] = [];
  
  if (!spec.roles) return anchors;
  
  // Role 4 action "Flush standpipe"
  if (spec.roles["4"]?.actions) {
    spec.roles["4"].actions.forEach((action, index) => {
      const lowerAction = action.toLowerCase();
      if (lowerAction.includes("flush") || lowerAction.includes("standpipe")) {
        anchors.push({
          role: "4",
          kind: "action",
          index,
          label: spec.roles?.["4"]?.label || "Role 4",
          text: action,
        });
      }
    });
  }
  
  // Role 2 note about not connecting feeder until flushed
  if (spec.roles["2"]?.notes) {
    spec.roles["2"].notes.forEach((note, index) => {
      const lowerNote = note.toLowerCase();
      if (lowerNote.includes("flush") || lowerNote.includes("feeder")) {
        anchors.push({
          role: "2",
          kind: "note",
          index,
          label: spec.roles?.["2"]?.label || "Role 2",
          text: note,
        });
      }
    });
  }
  
  return anchors;
}

/**
 * Extract anchors for BRANCH_NOT_PLUGGED tag
 */
function extractBranchAnchors(spec: A1RunSpec): SpecAnchor[] {
  const anchors: SpecAnchor[] = [];
  
  if (!spec.roles) return anchors;
  
  // Role 1 orders conditions "After branch is coupled..."
  if (spec.roles["1"]?.orders) {
    spec.roles["1"].orders.forEach((order, index) => {
      const lowerOrder = order.toLowerCase();
      if (lowerOrder.includes("branch") || lowerOrder.includes("coupled") || lowerOrder.includes("plug")) {
        anchors.push({
          role: "1",
          kind: "order",
          index,
          label: spec.roles?.["1"]?.label || "Role 1",
          text: order,
        });
      }
    });
  }
  
  return anchors;
}

/**
 * Extract anchors for REPLACEMENT tag
 */
function extractReplacementAnchors(spec: A1RunSpec): SpecAnchor[] {
  const anchors: SpecAnchor[] = [];
  
  if (!spec.roles) return anchors;
  
  // Role 2 action "Replace burst length..."
  if (spec.roles["2"]?.actions) {
    spec.roles["2"].actions.forEach((action, index) => {
      const lowerAction = action.toLowerCase();
      if (lowerAction.includes("replace") || lowerAction.includes("burst") || lowerAction.includes("length")) {
        anchors.push({
          role: "2",
          kind: "action",
          index,
          label: spec.roles?.["2"]?.label || "Role 2",
          text: action,
        });
      }
    });
  }
  
  // Role 3 note "Disabled knot..."
  if (spec.roles["3"]?.notes) {
    spec.roles["3"].notes.forEach((note, index) => {
      const lowerNote = note.toLowerCase();
      if (lowerNote.includes("disabled") || lowerNote.includes("knot") || lowerNote.includes("replacement")) {
        anchors.push({
          role: "3",
          kind: "note",
          index,
          label: spec.roles?.["3"]?.label || "Role 3",
          text: note,
        });
      }
    });
  }
  
  // Role 4 action "Break out middle coupling..."
  if (spec.roles["4"]?.actions) {
    spec.roles["4"].actions.forEach((action, index) => {
      const lowerAction = action.toLowerCase();
      if (lowerAction.includes("break") || lowerAction.includes("coupling") || lowerAction.includes("middle")) {
        anchors.push({
          role: "4",
          kind: "action",
          index,
          label: spec.roles?.["4"]?.label || "Role 4",
          text: action,
        });
      }
    });
  }
  
  return anchors;
}

/**
 * Extract anchors for ROLE_CROSSOVER tag
 */
function extractRoleCrossoverAnchors(spec: A1RunSpec): SpecAnchor[] {
  const anchors: SpecAnchor[] = [];
  
  if (!spec.roles) return anchors;
  
  // Use role labels and actions as context
  // Pick the best matching role based on detected "No X" references
  for (const roleKey of ["1", "2", "3", "4"] as const) {
    const role = spec.roles[roleKey];
    if (!role) continue;
    
    if (role.label) {
      anchors.push({
        role: roleKey,
        kind: "note",
        index: 0,
        label: role.label,
        text: role.label,
      });
    }
    
    // Add first action as context
    if (role.actions && role.actions.length > 0) {
      anchors.push({
        role: roleKey,
        kind: "action",
        index: 0,
        label: role.label || `Role ${roleKey}`,
        text: role.actions[0],
      });
    }
  }
  
  return anchors;
}

export const A1_RULES: RuleDefinition[] = [
  {
    tag: "ORDERS",
    keywords: [
      "order",
      "orders",
      "overlap",
      "overlapping",
      "unclear",
      "late order",
      "talking",
      "hands",
      "valve early",
      "valve before",
    ],
    defaultRoles: ["1", "3"],
    defaultPhases: ["TARGET1", "EXTENSION"],
    extractAnchors: extractOrdersAnchors,
  },
  {
    tag: "FLUSH",
    keywords: [
      "flush",
      "flushed",
      "standpipe",
      "hydrant",
      "water not to ground",
      "not flushed",
    ],
    defaultRoles: ["4", "2"],
    defaultPhases: ["HYDRANT_FLUSH"],
    extractAnchors: extractFlushAnchors,
  },
  {
    tag: "BRANCH_NOT_PLUGGED",
    keywords: [
      "branch",
      "not plugged",
      "water on before branch",
      "branch off",
      "branch coupling",
    ],
    defaultRoles: ["1"],
    defaultPhases: ["TARGET1", "EXTENSION"],
    extractAnchors: extractBranchAnchors,
  },
  {
    tag: "REPLACEMENT",
    keywords: [
      "replacement",
      "replace",
      "burst",
      "disabled length",
      "middle coupling",
      "couplings not connected",
    ],
    defaultRoles: ["2", "3", "4"],
    defaultPhases: ["REPLACEMENT", "TARGET2_FIRST"],
    extractAnchors: extractReplacementAnchors,
  },
  {
    tag: "ROLE_CROSSOVER",
    keywords: [
      "wrong person",
      "not allotted",
      "allotted duties",
      "role crossover",
      "did someone else's job",
    ],
    defaultRoles: ["1", "2", "3", "4"],
    defaultPhases: [],
    extractAnchors: extractRoleCrossoverAnchors,
    boostRoleMentions: true,
  },
];
