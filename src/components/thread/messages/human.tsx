import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect } from "react";
import { getContentString, formatMessageTimestamp } from "../utils";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";

function EditableContent({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-0"
    />
  );
}

export function HumanMessage({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) {
  const thread = useStreamContext();
  const meta = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showSeen, setShowSeen] = useState(false);
  const contentString = getContentString(message.content);

  // Get timestamp from message metadata or use current time
  const timestamp = (message as any).timestamp 
    ? new Date((message as any).timestamp)
    : meta?.firstSeenState?.created_at 
    ? new Date(meta.firstSeenState.created_at)
    : new Date();

  // Determine if message is new (sent within last 5 seconds) or old
  const isNewMessage = (() => {
    const now = new Date();
    const timeDiff = now.getTime() - timestamp.getTime();
    return timeDiff < 5000; // Less than 5 seconds old
  })();

  useEffect(() => {
    if (isNewMessage) {
      // For new messages, show "seen" after random 2-5 seconds
      const delay = Math.random() * (5000 - 2000) + 2000;
      const timeout = setTimeout(() => {
        setShowSeen(true);
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      // For old messages, show "seen" immediately
      setShowSeen(true);
    }
  }, [isNewMessage]);

  // Hide empty, whitespace-only, or "null" messages (must be after all hooks)
  const trimmedContent = contentString.trim().toLowerCase();
  if (!trimmedContent || trimmedContent === "null") {
    return null;
  }

  const handleSubmitEdit = () => {
    setIsEditing(false);

    const newMessage: Message = {
      type: "human",
      content: value,
      timestamp: new Date().toISOString(),
    } as Message & { timestamp: string };

    // Debug: user edited and resubmitted a message
    try {
      console.debug("[AgentChat][EditResubmit] Submitting edited human message", {
        originalMessageId: message.id,
        originalContent: contentString,
        newContent: value,
        parentCheckpointId: parentCheckpoint ?? null,
        branch: meta?.branch ?? null,
      });
    } catch {
      // Swallow logging errors to avoid impacting UX
    }

    thread.submit(
      { messages: [newMessage] },
      {
        checkpoint: parentCheckpoint,
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => {
          const values = meta?.firstSeenState?.values;
          if (!values) return prev;

          return {
            ...values,
            messages: [...(values.messages ?? []), newMessage],
          };
        },
      },
    );
  };

  return (
    <div className={cn("group flex w-full items-start gap-2", isEditing && "flex-col")}>
      {isEditing ? (
        <EditableContent
          value={value}
          setValue={setValue}
          onSubmit={handleSubmitEdit}
        />
      ) : (
        <div className="flex w-full flex-col gap-1">
          {/* User label and message */}
          <div className="flex-1">
            {contentString ? (
              <p className="text-orange-500 whitespace-pre-wrap">
                <span className="font-medium">You:</span> {contentString}
              </p>
            ) : null}
          </div>
          {/* Timestamp under the text */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-mono">
              {formatMessageTimestamp(timestamp)}
            </span>
            {showSeen && (
              <span className="text-muted-foreground text-sm">seen</span>
            )}
          </div>
        </div>
      )}

      {!isEditing && (
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          <CommandBar
            isLoading={isLoading}
            content={contentString}
            isEditing={isEditing}
            setIsEditing={(c) => {
              if (c) {
                setValue(contentString);
              }
              setIsEditing(c);
            }}
            handleSubmitEdit={handleSubmitEdit}
            isHumanMessage={true}
          />
        </div>
      )}
    </div>
  );
}
