export interface QAPair {
  question: string;
  answer: string;
}

export type QAMode = "full" | "teaser";
export type OpposingParty = "buyer" | "seller";

/**
 * Deduplicates QA pairs by question text, keeping the last occurrence of each question.
 * Questions are compared case-insensitively and with trimmed whitespace.
 * Maintains the original order but removes earlier duplicates.
 * 
 * Example: [A, B, A, C] -> [B, A (last), C]
 */
export function deduplicateQAPairs(qaPairs: QAPair[]): QAPair[] {
  if (qaPairs.length === 0) return qaPairs;
  
  // Map to track the last occurrence index of each question
  const lastOccurrenceIndex = new Map<string, number>();
  
  // First pass: find the last occurrence index of each question
  for (let i = 0; i < qaPairs.length; i++) {
    const normalizedQuestion = qaPairs[i].question.trim().toLowerCase();
    lastOccurrenceIndex.set(normalizedQuestion, i);
  }
  
  // Second pass: build result array, only including questions at their last occurrence
  const result: QAPair[] = [];
  for (let i = 0; i < qaPairs.length; i++) {
    const normalizedQuestion = qaPairs[i].question.trim().toLowerCase();
    const lastIndex = lastOccurrenceIndex.get(normalizedQuestion);
    
    // Only include this pair if it's the last occurrence of this question
    if (lastIndex === i) {
      result.push(qaPairs[i]);
    }
  }
  
  return result;
}

function normalizeOpposingParty(
  value: unknown,
): OpposingParty | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "buyer") return "buyer";
  if (v === "seller") return "seller";
  return null;
}

/**
 * Check if content has a counterparty message at the end separated by \n\n
 * Pattern: "the counterparty has answered your question: ... with the answer: ..."
 */
export function extractCounterpartyMessage(content: string): string | null {
  // Check if content ends with \n\n followed by counterparty message
  // Look for the pattern at the end of the content
  const counterpartyPattern = /\n\nthe counterparty has answered your question:.*$/is;
  if (counterpartyPattern.test(content)) {
    // Find the last occurrence of \n\n followed by the counterparty message pattern
    const lastDoubleNewline = content.lastIndexOf('\n\n');
    if (lastDoubleNewline !== -1) {
      const lastPart = content.substring(lastDoubleNewline + 2); // +2 to skip \n\n
      // Verify it starts with the counterparty message pattern
      if (lastPart.trim().match(/^the counterparty has answered your question:/i)) {
        return lastPart.trim();
      }
    }
  }
  return null;
}

/**
 * Parse Q&A pairs from message content.
 * 
 * Full mode pattern: "here are X vetting answers from the matched buyer/seller:"
 * followed by numbered Q&A pairs with answers in format:
 * **1. Question?**
 * Answer
 * 
 * Teaser mode pattern: "The matched buyer/seller has answered X vetting questions.
 * Please complete your vetting..."
 * followed by numbered questions only (no answers):
 * **1. Question?**
 * 
 * If the message contains a counterparty message at the end (separated by \n\n),
 * only the part before \n\n is used for Q&A parsing.
 */
export function parseQAPairsFromContent(
  content: string,
  opts?: { opposingPartyHint?: unknown },
): {
  qaPairs: QAPair[];
  opposingParty: OpposingParty;
  mode: QAMode;
} | null {
  // Check if there's a counterparty message at the end - if so, only parse Q&A from the first part
  const counterpartyMessage = extractCounterpartyMessage(content);
  const qaContent = counterpartyMessage 
    ? content.substring(0, content.lastIndexOf('\n\n'))
    : content;

  // Check for FULL mode: "here are X vetting answers from..."
  const fullHeaderMatch = qaContent.match(
    /here are (\d+) vetting answers from the matched (buyer|seller|opposing party):/i
  );
  
  if (fullHeaderMatch) {
    const capturedParty = fullHeaderMatch[2]?.toLowerCase();
    const opposingParty =
      capturedParty === "buyer" || capturedParty === "seller"
        ? (capturedParty as OpposingParty)
        : normalizeOpposingParty(opts?.opposingPartyHint) ?? "buyer";
    const qaPairs: QAPair[] = [];

    // Parse individual Q&A pairs with answers
    // Pattern: **1. Question?**\nAnswer
    const qaPattern = /\*\*(\d+)\.\s*([^*]+)\*\*\s*\n([^\n*]+(?:\n(?!\*\*\d+\.)[^\n*]+)*)/g;
    let match;

    while ((match = qaPattern.exec(qaContent)) !== null) {
      const question = match[2].trim();
      const answer = match[3].trim();
      qaPairs.push({ question, answer });
    }

    if (qaPairs.length === 0) {
      return null;
    }

    return { qaPairs, opposingParty, mode: "full" };
  }

  // Check for TEASER mode: "The matched buyer/seller has answered X vetting questions..."
  const teaserHeaderMatch = qaContent.match(
    /The matched (buyer|seller|opposing party) has answered (\d+) vetting questions?\./i
  );

  if (teaserHeaderMatch) {
    const capturedParty = teaserHeaderMatch[1]?.toLowerCase();
    const opposingParty =
      capturedParty === "buyer" || capturedParty === "seller"
        ? (capturedParty as OpposingParty)
        : normalizeOpposingParty(opts?.opposingPartyHint) ?? "buyer";
    const qaPairs: QAPair[] = [];

    // Parse questions only (no answers)
    // Pattern: **1. Question?**
    const questionPattern = /\*\*(\d+)\.\s*([^*]+?)\*\*/g;
    let match;

    while ((match = questionPattern.exec(qaContent)) !== null) {
      const question = match[2].trim();
      qaPairs.push({ question, answer: "" });
    }

    if (qaPairs.length === 0) {
      return null;
    }

    return { qaPairs, opposingParty, mode: "teaser" };
  }

  return null;
}

