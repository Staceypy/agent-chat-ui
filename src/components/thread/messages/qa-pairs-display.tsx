import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, MessageSquare, Clock } from "lucide-react";
import type { QAPair, QAMode } from "./qa-pairs-utils";

interface QAPairsDisplayProps {
  qaPairs: QAPair[];
  opposingParty: string; // "buyer" or "seller"
  mode?: QAMode; // "full" shows Q&A, "teaser" shows only questions
}

export function QAPairsDisplay({ qaPairs, opposingParty, mode = "full" }: QAPairsDisplayProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set(qaPairs.map((_, i) => i)) // All expanded by default
  );

  const toggleItem = (index: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (expandedItems.size === qaPairs.length) {
      setExpandedItems(new Set());
    } else {
      setExpandedItems(new Set(qaPairs.map((_, i) => i)));
    }
  };

  // Teaser mode - shows only questions, no answers
  if (mode === "teaser") {
    return (
      <div className="w-full my-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Pending Vetting Questions
            </h3>
            <p className="text-xs text-muted-foreground">
              {qaPairs.length} question{qaPairs.length !== 1 ? "s" : ""} answered by {opposingParty}
            </p>
          </div>
        </div>

        {/* Info Message */}
        <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            The matched {opposingParty} has answered {qaPairs.length} vetting question{qaPairs.length !== 1 ? "s" : ""}. 
            Please complete your vetting so we can provide both you and the other party with the full picture. 
            Once you finish, I&apos;ll share the {opposingParty}&apos;s answers with you.
          </p>
        </div>

        {/* Questions List (no answers) */}
        <div className="space-y-2">
          {qaPairs.map((qa, index) => (
            <div
              key={index}
              className={cn(
                "rounded-lg border border-border/50 overflow-hidden",
                "bg-gradient-to-br from-muted/30 to-muted/10"
              )}
            >
              <div className="flex items-start gap-3 p-3">
                {/* Number Badge */}
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                  {index + 1}
                </div>
                
                {/* Question Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 leading-snug">
                    {qa.question}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Complete your vetting to unlock answers
        </div>
      </div>
    );
  }

  // Full mode - shows both questions and answers (existing behavior)
  return (
    <div className="w-full my-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Vetting Answers from {opposingParty}
            </h3>
            <p className="text-xs text-muted-foreground">
              {qaPairs.length} question{qaPairs.length !== 1 ? "s" : ""} answered
            </p>
          </div>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
        >
          {expandedItems.size === qaPairs.length ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Collapse all
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Expand all
            </>
          )}
        </button>
      </div>

      {/* Q&A Cards */}
      <div className="space-y-2">
        {qaPairs.map((qa, index) => {
          const isExpanded = expandedItems.has(index);
          return (
            <div
              key={index}
              className={cn(
                "rounded-lg border border-border/50 overflow-hidden transition-all duration-200",
                "bg-gradient-to-br from-muted/30 to-muted/10",
                "hover:border-border/80"
              )}
            >
              {/* Question Header */}
              <button
                onClick={() => toggleItem(index)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
              >
                {/* Number Badge */}
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                  {index + 1}
                </div>
                
                {/* Question Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 leading-snug">
                    {qa.question}
                  </p>
                </div>
                
                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>
              
              {/* Answer Content */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="px-3 pb-3 pt-0">
                  <div className="flex items-start gap-2 pl-9">
                    <MessageSquare className="w-3 h-3 mt-1 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-300/90 leading-relaxed">
                      {qa.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="mt-3 text-xs text-muted-foreground text-center">
        Answers verified by {opposingParty}
      </div>
    </div>
  );
}

