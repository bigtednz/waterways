/**
 * Core penalty interpretation logic
 * Pure function - no side effects, deterministic
 */

import type { MatchResult, InterpretationResult, RecommendedFocus, A1RunSpec } from "./types.js";
import { A1_RULES } from "./a1Rules.js";

const CONFIDENCE_THRESHOLD = 0.55;
const MAX_MATCHES = 3;

/**
 * Extract role numbers mentioned in text (e.g., "No 1", "No.2", "number 3")
 */
function extractMentionedRoles(text: string): string[] {
  const mentioned: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Patterns: "no 1", "no.1", "number 1", "no1", "role 1", "#1"
  for (let i = 1; i <= 4; i++) {
    const patterns = [
      `no ${i}`,
      `no.${i}`,
      `no${i}`,
      `number ${i}`,
      `role ${i}`,
      `#${i}`,
      `person ${i}`,
    ];
    
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        mentioned.push(i.toString());
        break;
      }
    }
  }
  
  return mentioned;
}

/**
 * Calculate confidence score for a rule match
 */
function calculateConfidence(
  rule: typeof A1_RULES[0],
  notes: string,
  keywordMatches: string[]
): number {
  const lowerNotes = notes.toLowerCase();
  let score = 0;
  
  // Base score from keyword matches
  const uniqueKeywords = new Set(keywordMatches.map(k => k.toLowerCase()));
  score += uniqueKeywords.size * 0.15; // Each unique keyword adds 0.15
  
  // Boost if multiple different keywords found
  if (uniqueKeywords.size >= 3) {
    score += 0.1;
  }
  
  // Boost if role numbers are mentioned (for role crossover)
  if (rule.boostRoleMentions) {
    const mentionedRoles = extractMentionedRoles(notes);
    if (mentionedRoles.length > 0) {
      score += 0.2;
    }
  }
  
  // Check for role mentions in general
  const mentionedRoles = extractMentionedRoles(notes);
  if (mentionedRoles.length > 0 && rule.defaultRoles.some(r => mentionedRoles.includes(r))) {
    score += 0.15;
  }
  
  // Cap at 1.0
  return Math.min(1.0, score);
}

/**
 * Find keyword matches in notes (case-insensitive, substring matching)
 */
function findKeywordMatches(notes: string, keywords: string[]): string[] {
  const lowerNotes = notes.toLowerCase();
  const matches: string[] = [];
  
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerNotes.includes(lowerKeyword)) {
      matches.push(keyword);
    }
  }
  
  return matches;
}

/**
 * Determine likely roles based on rule and notes
 */
function determineLikelyRoles(
  rule: typeof A1_RULES[0],
  notes: string
): string[] {
  const mentionedRoles = extractMentionedRoles(notes);
  
  // If roles are explicitly mentioned, use those
  if (mentionedRoles.length > 0) {
    // Filter to only roles that match the rule's default roles
    const matchingRoles = mentionedRoles.filter(r => rule.defaultRoles.includes(r));
    if (matchingRoles.length > 0) {
      return matchingRoles;
    }
    // If mentioned roles don't match defaults, still use them but with lower confidence
    return mentionedRoles;
  }
  
  // Otherwise use default roles
  return [...rule.defaultRoles];
}

/**
 * Determine likely phases based on rule and notes
 */
function determineLikelyPhases(
  rule: typeof A1_RULES[0],
  notes: string
): string[] {
  // For now, use default phases
  // Could be enhanced to detect phase mentions in notes
  return [...rule.defaultPhases];
}

/**
 * Generate evidence snippets from matched keywords
 */
function generateEvidence(notes: string, keywordMatches: string[]): string[] {
  const evidence: string[] = [];
  const sentences = notes.split(/[.!?]\s+/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of keywordMatches) {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        evidence.push(sentence.trim());
        break;
      }
    }
  }
  
  // If no sentence matches, use keyword matches themselves
  if (evidence.length === 0 && keywordMatches.length > 0) {
    evidence.push(...keywordMatches.slice(0, 3));
  }
  
  return evidence.slice(0, 5); // Max 5 evidence snippets
}

/**
 * Generate coaching message based on match
 */
function generateCoachingMessage(match: MatchResult): string {
  const roleText = match.likelyRoles.length > 0 
    ? `role${match.likelyRoles.length > 1 ? "s" : ""} ${match.likelyRoles.join(" and ")}`
    : "team";
  
  const phaseText = match.likelyPhases.length > 0
    ? ` during ${match.likelyPhases.join("/")}`
    : "";
  
  const messages: Record<string, string> = {
    ORDERS: `Focus on order completion before valve operation. Ensure ${roleText} complete orders clearly${phaseText}.`,
    FLUSH: `Ensure standpipe is flushed before feeder connection. ${roleText} must verify flush completion${phaseText}.`,
    BRANCH_NOT_PLUGGED: `Water must not be turned on before branch is properly plugged. ${roleText} should verify branch coupling${phaseText}.`,
    REPLACEMENT: `Burst length replacement procedure needs attention. ${roleText} should coordinate replacement${phaseText}.`,
    ROLE_CROSSOVER: `Team members must stick to allotted duties. ${roleText} should focus on their specific role responsibilities.`,
  };
  
  return messages[match.tag] || `Focus on ${match.tag.toLowerCase().replace(/_/g, " ")}. ${roleText} should review procedures${phaseText}.`;
}

/**
 * Generate recommended focus from top match
 */
function generateRecommendedFocus(
  topMatch: MatchResult,
  runTypeCode: string
): RecommendedFocus {
  const primaryRole = topMatch.likelyRoles.length > 0 ? topMatch.likelyRoles[0] : "1";
  const primaryPhase = topMatch.likelyPhases.length > 0 ? topMatch.likelyPhases[0] : "";
  
  const queryParams = new URLSearchParams({
    runType: runTypeCode,
    role: primaryRole,
  });
  
  if (primaryPhase) {
    queryParams.set("phase", primaryPhase);
  }
  
  return {
    primaryTag: topMatch.tag,
    primaryRole,
    primaryPhase,
    coachingMessage: generateCoachingMessage(topMatch),
    runLibraryLink: `/app/run-library?${queryParams.toString()}`,
  };
}

/**
 * Generate summary text from matches
 */
function generateSummary(matches: MatchResult[]): string {
  if (matches.length === 0) {
    return "No clear penalty patterns detected in notes.";
  }
  
  const topMatch = matches[0];
  const roleText = topMatch.likelyRoles.length > 0
    ? `roles ${topMatch.likelyRoles.join(" and ")}`
    : "team";
  
  const phaseText = topMatch.likelyPhases.length > 0
    ? ` during ${topMatch.likelyPhases.join("/")}`
    : "";
  
  return `Likely ${topMatch.tag} issue involving ${roleText}${phaseText}. Focus: ${topMatch.tag.toLowerCase().replace(/_/g, " ")}.`;
}

/**
 * Main interpretation function
 * Pure function - takes notes and spec, returns interpretation
 */
export function interpretPenaltyNotes(
  notes: string,
  spec: A1RunSpec,
  runTypeCode: string = "A1"
): InterpretationResult {
  if (!notes || notes.trim().length === 0) {
    return {
      summary: "No penalty notes provided.",
      matches: [],
      recommendedFocus: null,
    };
  }
  
  // For now, only support A1
  if (runTypeCode !== "A1") {
    return {
      summary: `Penalty interpretation not yet supported for run type ${runTypeCode}.`,
      matches: [],
      recommendedFocus: null,
    };
  }
  
  const matches: MatchResult[] = [];
  
  // Evaluate each rule
  for (const rule of A1_RULES) {
    const keywordMatches = findKeywordMatches(notes, rule.keywords);
    
    if (keywordMatches.length === 0) {
      continue; // No keywords matched
    }
    
    const confidence = calculateConfidence(rule, notes, keywordMatches);
    
    // Only include if confidence meets threshold
    if (confidence < CONFIDENCE_THRESHOLD) {
      continue;
    }
    
    const likelyRoles = determineLikelyRoles(rule, notes);
    const likelyPhases = determineLikelyPhases(rule, notes);
    const evidence = generateEvidence(notes, keywordMatches);
    const specAnchors = rule.extractAnchors(spec);
    
    matches.push({
      tag: rule.tag,
      confidence,
      evidence,
      likelyRoles,
      likelyPhases,
      specAnchors,
    });
  }
  
  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);
  
  // Take top N matches
  const topMatches = matches.slice(0, MAX_MATCHES);
  
  // Generate summary and recommended focus
  const summary = generateSummary(topMatches);
  const recommendedFocus = topMatches.length > 0
    ? generateRecommendedFocus(topMatches[0], runTypeCode)
    : null;
  
  return {
    summary,
    matches: topMatches,
    recommendedFocus,
  };
}
