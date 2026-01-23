import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, MessageSquare, Clock, X } from "lucide-react";
import type { QAPair, QAMode } from "./qa-pairs-utils";

interface QAPairsFloatingButtonProps {
  qaPairs: QAPair[];
  opposingParty: string;
  mode?: QAMode;
}

export function QAPairsFloatingButton({ 
  qaPairs, 
  opposingParty, 
  mode = "full" 
}: QAPairsFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set(qaPairs.map((_, i) => i))
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

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

  const isTeaser = mode === "teaser";
  const IconComponent = isTeaser ? Clock : CheckCircle2;
  const iconBgColor = isTeaser ? "bg-amber-500/20" : "bg-emerald-500/20";
  const iconColor = isTeaser ? "text-amber-400" : "text-emerald-400";
  const borderColor = isTeaser ? "border-amber-500/30" : "border-emerald-500/30";
  const buttonBgColor = isTeaser 
    ? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 hover:from-amber-500/20 hover:to-amber-500/10" 
    : "bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-emerald-500/10";

  return (
    <div ref={panelRef} className="relative">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200",
          "shadow-lg backdrop-blur-sm",
          buttonBgColor,
          borderColor,
          isOpen && "ring-2 ring-white/10"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-7 h-7 rounded-full",
          iconBgColor
        )}>
          <IconComponent className={cn("w-4 h-4", iconColor)} />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-white">
            {opposingParty} has answered {qaPairs.length} vetting question{qaPairs.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {isTeaser ? "Complete vetting to view" : "Click to view answers"}
          </p>
        </div>
        <div className="ml-2 text-muted-foreground">
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Popup Panel */}
      <div
        className={cn(
          "absolute top-full left-0 right-0 mt-2 z-50",
          "max-h-[60vh] overflow-hidden rounded-xl border border-border/50",
          "bg-background/95 backdrop-blur-md shadow-2xl",
          "transition-all duration-300 ease-out origin-top",
          isOpen 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        )}
      >
        {/* Panel Header */}
        <div className="sticky top-0 flex items-center justify-between p-3 border-b border-border/50 bg-muted/50">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full",
              iconBgColor
            )}>
              <IconComponent className={cn("w-3 h-3", iconColor)} />
            </div>
            <span className="text-sm font-medium text-white">
              {isTeaser ? "Pending Vetting Questions" : `Answers from ${opposingParty}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isTeaser && (
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
              >
                {expandedItems.size === qaPairs.length ? "Collapse" : "Expand"}
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel Content */}
        <div className="overflow-y-auto max-h-[calc(60vh-48px)] p-3">
          {/* Teaser Info Message */}
          {isTeaser && (
            <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-200/90 leading-relaxed">
                Please complete your vetting so we can provide both you and the other party with the full picture. 
                Once you finish, I&apos;ll share the {opposingParty}&apos;s answers with you.
              </p>
            </div>
          )}

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
                    !isTeaser && "hover:border-border/80"
                  )}
                >
                  {/* Question */}
                  {isTeaser ? (
                    <div className="flex items-start gap-3 p-3">
                      <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                        {index + 1}
                      </div>
                      <p className="text-sm font-medium text-white/90 leading-snug">
                        {qa.question}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 leading-snug">
                          {qa.question}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                  )}
                  
                  {/* Answer (only in full mode) */}
                  {!isTeaser && (
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-200",
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="px-3 pb-3 pt-0">
                        <div className="flex items-start gap-2 pl-8">
                          <MessageSquare className="w-3 h-3 mt-1 text-emerald-400 flex-shrink-0" />
                          <p className="text-sm text-emerald-300/90 leading-relaxed">
                            {qa.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 text-xs text-muted-foreground text-center">
            {isTeaser 
              ? "Complete your vetting to unlock answers" 
              : `Answers verified by ${opposingParty}`
            }
          </div>
        </div>
      </div>
    </div>
  );
}

