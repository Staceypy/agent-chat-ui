export interface QAPair {
  question: string;
  answer: string;
}

/**
 * Parse Q&A pairs from message content.
 * Detects the pattern: "here are X vetting answers from..."
 * followed by numbered Q&A pairs in format:
 * **1. Question?**
 * Answer
 */
export function parseQAPairsFromContent(content: string): {
  qaPairs: QAPair[];
  opposingParty: string;
} | null {
  // Check if this is a Q&A pairs message
  const headerMatch = content.match(
    /here are (\d+) vetting answers from the matched (buyer|seller):/i
  );
  
  if (!headerMatch) {
    return null;
  }

  const opposingParty = headerMatch[2];
  const qaPairs: QAPair[] = [];

  // Parse individual Q&A pairs
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

  return { qaPairs, opposingParty };
}

