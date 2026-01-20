import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, MessageSquare } from "lucide-react";
import type { QAPair } from "./qa-pairs-utils";

interface QAPairsDisplayProps {
  qaPairs: QAPair[];
  opposingParty: string; // "buyer" or "seller"
}

export function QAPairsDisplay({ qaPairs, opposingParty }: QAPairsDisplayProps) {
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

