import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { useState } from "react";
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
  const contentString = getContentString(message.content);

  // Get timestamp from message metadata or use current time
  const timestamp = (message as any).timestamp 
    ? new Date((message as any).timestamp)
    : meta?.firstSeenState?.created_at 
    ? new Date(meta.firstSeenState.created_at)
    : new Date();

  const handleSubmitEdit = () => {
    setIsEditing(false);

    const newMessage: Message = { 
      type: "human", 
      content: value,
      timestamp: new Date().toISOString(),
    } as Message & { timestamp: string };
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
        <div className="flex w-full items-start gap-2">
          {/* Timestamp on the left */}
          <span className="text-muted-foreground text-sm font-mono shrink-0">
            {formatMessageTimestamp(timestamp)}
          </span>
          
          {/* User label and message */}
          <div className="flex-1">
            {contentString ? (
              <p className="text-orange-500 whitespace-pre-wrap">
                <span className="font-medium">User:</span> {contentString}
              </p>
            ) : null}
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
