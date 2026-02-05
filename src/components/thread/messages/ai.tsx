import { useStreamContext } from "@/providers/Stream";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString, formatMessageTimestamp } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";
import { useState, useEffect, useMemo } from "react";
import { parseQAPairsFromContent, extractCounterpartyMessage } from "./qa-pairs-utils";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

interface InterruptProps {
  interrupt?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function isBreakpointOnlyInterrupt(interrupt: unknown): boolean {
  // The SDK returns { when: "breakpoint" } as a pure metadata marker when the
  // graph stopped at a breakpoint (or when the hook's stale history shows
  // pending next nodes). This contains no actual interrupt data to display.
  return (
    interrupt != null &&
    typeof interrupt === "object" &&
    !Array.isArray(interrupt) &&
    (interrupt as any).when === "breakpoint" &&
    !("value" in (interrupt as any))
  );
}

function Interrupt({
  interrupt,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
        interrupt) as Record<string, any>);

  return (
    <>
      {isAgentInboxInterruptSchema(interrupt) &&
        isLastMessage &&
        !hasNoAIOrToolMessages && (
          <ThreadView interrupt={interrupt} />
        )}
      {interrupt &&
      !isAgentInboxInterruptSchema(interrupt) &&
      !isBreakpointOnlyInterrupt(interrupt) &&
      isLastMessage &&
      !hasNoAIOrToolMessages ? (
        <GenericInterruptView interrupt={fallbackValue} />
      ) : null}
    </>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  
  // Get timestamp from message metadata or use current time
  const timestamp = message
    ? ((message as any).timestamp
        ? new Date((message as any).timestamp)
        : meta?.firstSeenState?.created_at
        ? new Date(meta.firstSeenState.created_at)
        : new Date())
    : new Date();

  // Q&A pairs messages are rendered in the sticky header button, not in the chat flow
  const isQAPairsMessage = useMemo(() => {
    const parsed = parseQAPairsFromContent(contentString);
    return parsed !== null;
  }, [contentString]);

  // Check if there's a counterparty message at the end (separated by \n\n)
  const counterpartyMessage = useMemo(() => {
    return extractCounterpartyMessage(contentString);
  }, [contentString]);

  // Hide tool results completely
  const isToolResult = message?.type === "tool";
  if (isToolResult) {
    return null;
  }

  // Hide empty, whitespace-only, or "null" messages
  const trimmedContent = contentString.trim().toLowerCase();
  if (!message || !trimmedContent || trimmedContent === "null") {
    return null;
  }

  // If message has Q&A pairs AND a counterparty message, only hide the Q&A part
  // and display the counterparty message part
  if (isQAPairsMessage && counterpartyMessage) {
    // Display only the counterparty message part
    return (
      <div className="group flex w-full items-start gap-2">
        <div className="flex w-full flex-col gap-2">
          {/* AI message content - only the counterparty message part */}
          <div className="flex-1 text-white">
            <div className="py-1">
              <MarkdownText>{counterpartyMessage}</MarkdownText>
            </div>
            {/* Timestamp under the text */}
            <span className="text-muted-foreground text-sm font-mono">
              {formatMessageTimestamp(timestamp)}
            </span>
          </div>

          {message && (
            <CustomComponent
              message={message}
              thread={thread}
            />
          )}
          
          <Interrupt
            interrupt={threadInterrupt}
            isLastMessage={isLastMessage}
            hasNoAIOrToolMessages={hasNoAIOrToolMessages}
          />
          
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
              content={counterpartyMessage}
              isLoading={isLoading}
              isAiMessage={true}
              handleRegenerate={() => handleRegenerate(parentCheckpoint)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Hide Q&A pairs messages in the chat flow (both full + teaser) if no counterparty message
  if (isQAPairsMessage) {
    return null;
  }

  return (
    <div className="group flex w-full items-start gap-2">
      <div className="flex w-full flex-col gap-2">
        {/* AI message content */}
        <div className="flex-1 text-white">
          <div className="py-1">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
          {/* Timestamp under the text */}
          <span className="text-muted-foreground text-sm font-mono">
            {formatMessageTimestamp(timestamp)}
          </span>
        </div>

        {message && (
          <CustomComponent
            message={message}
            thread={thread}
          />
        )}
        
        <Interrupt
          interrupt={threadInterrupt}
          isLastMessage={isLastMessage}
          hasNoAIOrToolMessages={hasNoAIOrToolMessages}
        />
        
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
            content={contentString}
            isLoading={isLoading}
            isAiMessage={true}
            handleRegenerate={() => handleRegenerate(parentCheckpoint)}
          />
        </div>
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  const [dots, setDots] = useState(".");
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Delay showing the indicator by random 2-5 seconds
    const delay = Math.random() * (5000 - 2000) + 2000;
    const timeout = setTimeout(() => {
      setShowIndicator(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!showIndicator) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [showIndicator]);

  if (!showIndicator) {
    return null;
  }

  return (
    <div className="mr-auto flex items-start gap-2">
      <div className="bg-muted flex h-8 items-center gap-1 rounded-2xl px-4 py-2">
        <span className="text-sm text-foreground/70">type{dots}</span>
      </div>
    </div>
  );
}
