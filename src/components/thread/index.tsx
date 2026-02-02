import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import {
  ArrowDown,
  XIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { QAPairsFloatingButton } from "./messages/qa-pairs-floating";
import { parseQAPairsFromContent, deduplicateQAPairs, type QAPair, type QAMode, type OpposingParty } from "./messages/qa-pairs-utils";
import { getContentString } from "./utils";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function OpenGitHubRepo() {
  return null;
}

export function Thread() {
  const [artifactContext, _setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId] = useQueryState("threadId");
  const [input, setInput] = useState("");
  const {
    contentBlocks,
    setContentBlocks,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length
    ) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === "ai") {
        setFirstTokenReceived(true);
      } else if (lastMessage.type === "tool") {
        // When a tool message appears, reset firstTokenReceived so typing indicator stays visible
        // until the AI message arrives
        setFirstTokenReceived(false);
      }
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  // Check if we're waiting for an AI message (last message is tool)
  const isWaitingForAI = useMemo(() => {
    if (!messages.length) return false;
    const lastMessage = messages[messages.length - 1];
    // If last message is a tool message, we're waiting for AI response
    return lastMessage.type === "tool";
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
      timestamp: new Date().toISOString(),
    } as Message & { timestamp: string };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);

    // Debug: user requested AI regenerate from a checkpoint
    try {
      console.debug("[AgentChat][Regenerate] Regenerating from checkpoint", {
        parentCheckpointId: parentCheckpoint ?? null,
        threadId,
        lastMessageId: messages[messages.length - 1]?.id ?? null,
      });
    } catch {
      // Swallow logging errors to avoid impacting UX
    }

    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  // Cache Q&A pairs per thread to persist them even if the source message disappears
  const [cachedQAPairs, setCachedQAPairs] = useState<{
    qaPairs: QAPair[];
    opposingParty: OpposingParty;
    mode: QAMode;
  } | null>(null);

  // Clear cache when thread changes
  useEffect(() => {
    setCachedQAPairs(null);
  }, [threadId]);

  // Detect QA pairs from messages (pure computation, no side effects)
  const detectedQAPairs = useMemo(() => {
    // Prefer the most recent Q&A message so teaser can be replaced by full answers later.
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.type !== "ai") continue;

      const content = message.content ?? [];
      const contentString = getContentString(content);
      const opposingPartyHint =
        typeof (message as any).name === "string" ? (message as any).name : undefined;
      const parsed = parseQAPairsFromContent(contentString, { opposingPartyHint });
      if (parsed) {
        // Deduplicate QA pairs, keeping the last occurrence of each question
        return {
          ...parsed,
          qaPairs: deduplicateQAPairs(parsed.qaPairs),
        };
      }
    }
    return null;
  }, [messages]);

  // Update cache when new Q&A pairs are detected
  useEffect(() => {
    if (detectedQAPairs) {
      setCachedQAPairs(detectedQAPairs);
    }
  }, [detectedQAPairs]);

  return (
    <div className="flex h-screen w-full overflow-hidden">

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
              </div>
              <div className="absolute top-2 right-4 flex items-center">
                <OpenGitHubRepo />
              </div>
            </div>
          )}
          {chatStarted && (
            <div className="relative z-10 flex flex-col gap-2 p-2">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex items-center justify-start gap-2">
                  {/* <motion.button
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => setThreadId(null)}
                  >
                    <span className="text-xl font-semibold tracking-tight">
                      Chat
                    </span>
                  </motion.button> */}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <OpenGitHubRepo />
                  </div>
                </div>
              </div>

              {/* QA Pairs Floating Button - appears when QA message is received */}
              {detectedQAPairs && (
                <div className="flex justify-center">
                  <QAPairsFloatingButton
                    qaPairs={detectedQAPairs.qaPairs}
                    opposingParty={detectedQAPairs.opposingParty}
                    mode={detectedQAPairs.mode}
                  />
                </div>
              )}

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-[25vh] flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {(() => {
                    // Filter and deduplicate messages
                    const filtered = messages.filter(
                      (m) =>
                        !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX) &&
                        m.type !== "tool",
                    );
                    
                    // Deduplicate by keeping the last occurrence of each message ID
                    const seen = new Set<string>();
                    const deduplicated: Message[] = [];
                    for (let i = filtered.length - 1; i >= 0; i--) {
                      const msg = filtered[i];
                      const key = msg.id || `${msg.type}-${i}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        deduplicated.unshift(msg);
                      }
                    }
                    
                    return deduplicated.map((message, index) =>
                      message.type === "human" ? (
                        <HumanMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                        />
                      ) : (
                        <AssistantMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                          handleRegenerate={handleRegenerate}
                        />
                      ),
                    );
                  })()}
                  {/* Show cached Q&A pairs info when source message is gone but cache exists */}
                  {!detectedQAPairs && cachedQAPairs && (
                    <div className="flex justify-center my-2">
                      <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground">
                        Answer to view {cachedQAPairs.opposingParty}&apos;s responses
                      </div>
                    </div>
                  )}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  )}
                  {isLoading && (!firstTokenReceived || isWaitingForAI) && (
                    <AssistantMessageLoading />
                  )}
                </>
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-8 bg-background">
                  {!chatStarted && (
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        Chat
                      </h1>
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  <div
                    ref={dropRef}
                    className={cn(
                      "bg-muted relative z-10 mx-auto mb-8 w-full max-w-3xl rounded-2xl shadow-xs transition-all",
                      dragOver
                        ? "border-primary border-2 border-dotted"
                        : "border border-solid",
                    )}
                  >
                    <form
                      onSubmit={handleSubmit}
                      className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
                    >
                      <ContentBlocksPreview
                        blocks={contentBlocks}
                        onRemove={removeBlock}
                      />
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.metaKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            const el = e.target as HTMLElement | undefined;
                            const form = el?.closest("form");
                            form?.requestSubmit();
                          }
                        }}
                        placeholder="Type your message..."
                        className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                      />

                      <div className="flex items-center gap-6 p-2 pt-4">
                        <Button
                          type="submit"
                          className="ml-auto shadow-md transition-all bg-submit-button"
                          disabled={
                            isLoading ||
                            stream.isLoading ||
                            (!input.trim() && contentBlocks.length === 0)
                          }
                        >
                          Send
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              }
            />
          </StickToBottom>
        </motion.div>
        <div className="relative flex flex-col border-l">
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button
                onClick={closeArtifact}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      </div>
    </div>
  );
}
