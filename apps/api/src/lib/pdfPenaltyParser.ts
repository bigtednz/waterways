/**
 * Utility to parse penalty rules from PDF text
 * This is a basic parser - you may need to customize based on your PDF structure
 */

// Type declaration for pdf-parse
declare function pdfParse(buffer: Buffer): Promise<{ text: string }>;

export interface ParsedPenaltyRule {
  ruleId: string;
  runTypeCode: string | null;
  ruleText: string;
  taxonomyCode: string;
  severity: string;
  outcomeType: string;
  outcomeSeconds: number | null;
  sourcePdfRef: string | null;
  confidence: number; // 0-1, how confident we are in the parsing
  rawText?: string; // Original text snippet for review
}

/**
 * Parse penalty rules from PDF text
 * This is a basic implementation - customize based on your PDF format
 */
export function parsePenaltyRulesFromText(pdfText: string, pageNumber?: number): ParsedPenaltyRule[] {
  const rules: ParsedPenaltyRule[] = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Common patterns to look for:
  // - Rule IDs (e.g., "PEN-001", "Rule 4.2.3", "Section 3.1")
  // - Penalty amounts (e.g., "5 seconds", "+10s", "15 second penalty")
  // - Severity indicators (e.g., "minor", "major", "critical")
  // - Outcome types (e.g., "time penalty", "disqualification", "warning")

  let currentRule: Partial<ParsedPenaltyRule> | null = null;
  let ruleTextLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

    // Try to detect rule start patterns
    const ruleIdMatch = line.match(/(?:Rule|PEN-|Section|§)\s*([A-Z0-9.-]+)/i);
    const sectionMatch = line.match(/(\d+\.\d+(?:\.\d+)?)/); // e.g., "4.2.3"
    
    // Try to detect penalty amounts
    const penaltyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:second|sec|s)(?:\s+penalty)?/i);
    const disqualMatch = line.match(/disqualif/i);
    const warningMatch = line.match(/warning/i);

    // Try to detect severity
    const severityMatch = line.match(/(minor|major|critical|severe)/i);

    // If we find a rule ID or section number, start a new rule
    if (ruleIdMatch || sectionMatch) {
      // Save previous rule if exists
      if (currentRule && ruleTextLines.length > 0) {
        const parsed = finalizeRule(currentRule, ruleTextLines, pageNumber);
        if (parsed) rules.push(parsed);
      }

      // Start new rule
      currentRule = {
        ruleId: ruleIdMatch ? ruleIdMatch[1] : sectionMatch ? sectionMatch[1] : `AUTO-${rules.length + 1}`,
        sourcePdfRef: sectionMatch ? `Section ${sectionMatch[1]}` : ruleIdMatch ? `Rule ${ruleIdMatch[1]}` : null,
        confidence: 0.5,
      };
      ruleTextLines = [line];
    } else if (currentRule) {
      // Continue building current rule
      ruleTextLines.push(line);

      // Check for penalty information in this line
      if (penaltyMatch && !currentRule.outcomeSeconds) {
        currentRule.outcomeSeconds = parseFloat(penaltyMatch[1]);
        currentRule.outcomeType = 'time_penalty';
        currentRule.confidence = Math.min(1, (currentRule.confidence || 0.5) + 0.2);
      } else if (disqualMatch && !currentRule.outcomeType) {
        currentRule.outcomeType = 'disqualification';
        currentRule.outcomeSeconds = null;
        currentRule.confidence = Math.min(1, (currentRule.confidence || 0.5) + 0.2);
      } else if (warningMatch && !currentRule.outcomeType) {
        currentRule.outcomeType = 'warning';
        currentRule.outcomeSeconds = null;
        currentRule.confidence = Math.min(1, (currentRule.confidence || 0.5) + 0.1);
      }

      if (severityMatch && !currentRule.severity) {
        currentRule.severity = severityMatch[1].toLowerCase();
        currentRule.confidence = Math.min(1, (currentRule.confidence || 0.5) + 0.1);
      }

      // Check for run type codes (e.g., "A1", "A3", "F9")
      const runTypeMatch = line.match(/\b([A-Z]\d+)\b/);
      if (runTypeMatch && !currentRule.runTypeCode) {
        currentRule.runTypeCode = runTypeMatch[1];
      }

      // Check for taxonomy codes (common patterns)
      const taxonomyMatch = line.match(/(ORDER|PROCEDURE|TIMING|EQUIPMENT|SAFETY)[_\s]*(VIOLATION|ERROR|FAILURE)?/i);
      if (taxonomyMatch && !currentRule.taxonomyCode) {
        currentRule.taxonomyCode = taxonomyMatch[0].replace(/\s+/g, '_').toUpperCase();
      }
    }

    // If we hit a blank line or section break, finalize current rule
    if (line.length === 0 && currentRule && ruleTextLines.length > 0) {
      const parsed = finalizeRule(currentRule, ruleTextLines, pageNumber);
      if (parsed) rules.push(parsed);
      currentRule = null;
      ruleTextLines = [];
    }
  }

  // Finalize last rule
  if (currentRule && ruleTextLines.length > 0) {
    const parsed = finalizeRule(currentRule, ruleTextLines, pageNumber);
    if (parsed) rules.push(parsed);
  }

  return rules;
}

function finalizeRule(
  rule: Partial<ParsedPenaltyRule>,
  textLines: string[],
  pageNumber?: number
): ParsedPenaltyRule | null {
  const ruleText = textLines.join(' ').trim();
  
  if (ruleText.length < 10) {
    return null; // Skip very short rules (likely false positives)
  }

  // Set defaults
  const parsed: ParsedPenaltyRule = {
    ruleId: rule.ruleId || `AUTO-${Date.now()}`,
    runTypeCode: rule.runTypeCode || null,
    ruleText: ruleText,
    taxonomyCode: rule.taxonomyCode || 'UNKNOWN',
    severity: rule.severity || 'minor',
    outcomeType: rule.outcomeType || 'time_penalty',
    outcomeSeconds: rule.outcomeSeconds ?? (rule.outcomeType === 'time_penalty' ? 5 : null),
    sourcePdfRef: rule.sourcePdfRef 
      ? (pageNumber ? `${rule.sourcePdfRef}, Page ${pageNumber}` : rule.sourcePdfRef)
      : (pageNumber ? `Page ${pageNumber}` : null),
    confidence: rule.confidence || 0.3,
    rawText: textLines.join('\n'),
  };

  // Only return rules with reasonable confidence
  if (parsed.confidence < 0.3) {
    return null;
  }

  return parsed;
}

/**
 * Extract penalty rules from PDF buffer
 */
export async function extractPenaltyRulesFromPdf(pdfBuffer: Buffer): Promise<ParsedPenaltyRule[]> {
  // Dynamic import to handle optional dependency
  // @ts-ignore - pdf-parse doesn't have type definitions
  const pdfParseModule = await import('pdf-parse');
  const pdfParseFn = pdfParseModule.default || pdfParseModule;
  
  const pdfData = await pdfParseFn(pdfBuffer);
  
  const allRules: ParsedPenaltyRule[] = [];
  
  // Parse each page separately for better source references
  // Note: pdf-parse doesn't support per-page extraction directly,
  // so we parse the whole document and try to infer page breaks
  const fullText = pdfData.text;
  
  // Try to split by common page break indicators
  const pageMatches = fullText.match(/\f/g);
  if (pageMatches && pageMatches.length > 0) {
    const pages = fullText.split(/\f+/);
    pages.forEach((pageText: string, index: number) => {
      const pageRules = parsePenaltyRulesFromText(pageText, index + 1);
      allRules.push(...pageRules);
    });
  } else {
    // No clear page breaks, parse as single document
    const rules = parsePenaltyRulesFromText(fullText);
    allRules.push(...rules);
  }

  // Deduplicate by ruleId
  const seen = new Set<string>();
  return allRules.filter(rule => {
    if (seen.has(rule.ruleId)) {
      return false;
    }
    seen.add(rule.ruleId);
    return true;
  });
}
