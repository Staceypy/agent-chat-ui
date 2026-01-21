export interface QAPair {
  question: string;
  answer: string;
}

export type QAMode = "full" | "teaser";

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
 */
export function parseQAPairsFromContent(content: string): {
  qaPairs: QAPair[];
  opposingParty: string;
  mode: QAMode;
} | null {
  // Check for FULL mode: "here are X vetting answers from..."
  const fullHeaderMatch = content.match(
    /here are (\d+) vetting answers from the matched (buyer|seller|opposing party):/i
  );
  
  if (fullHeaderMatch) {
    const opposingParty = fullHeaderMatch[2];
    const qaPairs: QAPair[] = [];

    // Parse individual Q&A pairs with answers
    // Pattern: **1. Question?**\nAnswer
    const qaPattern = /\*\*(\d+)\.\s*([^*]+)\*\*\s*\n([^\n*]+(?:\n(?!\*\*\d+\.)[^\n*]+)*)/g;
    let match;

    while ((match = qaPattern.exec(content)) !== null) {
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
  const teaserHeaderMatch = content.match(
    /The matched (buyer|seller|opposing party) has answered (\d+) vetting questions?\./i
  );

  if (teaserHeaderMatch) {
    const opposingParty = teaserHeaderMatch[1];
    const qaPairs: QAPair[] = [];

    // Parse questions only (no answers)
    // Pattern: **1. Question?**
    const questionPattern = /\*\*(\d+)\.\s*([^*]+?)\*\*/g;
    let match;

    while ((match = questionPattern.exec(content)) !== null) {
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

