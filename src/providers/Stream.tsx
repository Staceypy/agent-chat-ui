import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      context?: Record<string, unknown>;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream> & {
  refreshHistory: () => Promise<void>;
};
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  
  // Separate state for polled messages - this ensures we always have the latest
  const [polledMessages, setPolledMessages] = useState<Message[] | null>(null);
  const lastPollRef = useRef<string>("");
  
  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    fetchStateHistory: true,
    onCustomEvent: (event, options) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    onThreadId: (id) => {
      setThreadId(id);
      // Reset polled messages when thread changes
      setPolledMessages(null);
      lastPollRef.current = "";
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  // Function to manually refresh history from the server
  const refreshHistory = useCallback(async () => {
    if (!threadId) return;
    
    try {
      const response = await fetch(`${apiUrl}/threads/${threadId}/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "X-Api-Key": apiKey }),
        },
        body: JSON.stringify({ limit: 100 }),
      });
      
      if (!response.ok) return;
      
      const history = await response.json();
      
      // Extract messages from the most recent checkpoint
      if (history && Array.isArray(history) && history.length > 0) {
        const latestState = history[0];
        const newMessages = latestState?.values?.messages;
        
        if (Array.isArray(newMessages) && newMessages.length > 0) {
          // Create a hash of the new messages to detect changes
          const newHash = JSON.stringify(newMessages.map((m: Message) => ({
            id: m.id,
            content: m.content,
          })));
          
          // Only update if messages actually changed
          if (newHash !== lastPollRef.current) {
            lastPollRef.current = newHash;
            setPolledMessages(newMessages);
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh history:", error);
    }
  }, [threadId, apiUrl, apiKey]);

  // Poll for updates every 3 seconds when not actively streaming
  useEffect(() => {
    if (!threadId) return;
    
    // Initial fetch after a short delay
    const initialTimeout = setTimeout(refreshHistory, 500);
    
    // Set up polling interval - poll more frequently (every 2 seconds)
    const pollInterval = setInterval(() => {
      // Only poll when not actively streaming
      if (!streamValue.isLoading) {
        refreshHistory();
      }
    }, 2000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(pollInterval);
    };
  }, [threadId, streamValue.isLoading, refreshHistory]);

  // Clear polled messages when thread changes
  useEffect(() => {
    setPolledMessages(null);
    lastPollRef.current = "";
  }, [threadId]);

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to server", {
          description: () => (
            <p>
              Please ensure your server is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed server).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  // Use polled messages if they have more/newer data than stream messages
  const effectiveMessages = (() => {
    const streamMessages = streamValue.messages ?? [];
    const polled = polledMessages ?? [];
    
    // If we're streaming, prefer stream messages
    if (streamValue.isLoading) {
      return streamMessages;
    }
    
    // If polled has more messages, use polled
    if (polled.length > streamMessages.length) {
      return polled;
    }
    
    // If same count, compare content of last message
    if (polled.length === streamMessages.length && polled.length > 0) {
      const streamLast = JSON.stringify(streamMessages[streamMessages.length - 1]?.content);
      const polledLast = JSON.stringify(polled[polled.length - 1]?.content);
      if (polledLast !== streamLast) {
        return polled;
      }
    }
    
    return streamMessages;
  })();

  // Extend streamValue with refreshHistory function and effective messages
  const extendedStreamValue: StreamContextType = {
    ...streamValue,
    messages: effectiveMessages,
    refreshHistory,
  };

  return (
    <StreamContext.Provider value={extendedStreamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Check if environment variables are set - if so, use them directly and skip form
  const hasEnvVars = envApiUrl && envAssistantId;

  // Use URL params only if env vars are not set (for manual override)
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use:
  // 1. If env vars exist, use them (skip form)
  // 2. Otherwise, use URL params if provided
  // 3. Otherwise, show form
  const finalApiUrl = hasEnvVars ? envApiUrl : (apiUrl || envApiUrl);
  const finalAssistantId = hasEnvVars ? envAssistantId : (assistantId || envAssistantId);

  // Show the form ONLY if we don't have env vars AND don't have values from URL params
  // If env vars are set, always skip the form
  if (!hasEnvVars && (!finalApiUrl || !finalAssistantId)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="animate-in fade-in-0 zoom-in-95 bg-background flex max-w-3xl flex-col rounded-lg border shadow-lg">
          <div className="mt-14 flex flex-col gap-2 border-b p-6">
            <div className="flex flex-col items-start gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Chat
              </h1>
            </div>
            <p className="text-muted-foreground">
              Welcome! Before you get started, you need to enter
              the URL of the deployment and the ID.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const apiUrl = formData.get("apiUrl") as string;
              const assistantId = formData.get("assistantId") as string;
              const apiKey = formData.get("apiKey") as string;

              setApiUrl(apiUrl);
              setApiKey(apiKey);
              setAssistantId(assistantId);

              form.reset();
            }}
            className="bg-muted/50 flex flex-col gap-6 p-6"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiUrl">
                Deployment URL<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the URL of your deployment. Can be a local, or
                production deployment.
              </p>
              <Input
                id="apiUrl"
                name="apiUrl"
                className="bg-background"
                defaultValue={apiUrl || DEFAULT_API_URL}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assistantId">
                ID<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the ID to fetch threads from and invoke when actions are
                taken.
              </p>
              <Input
                id="assistantId"
                name="assistantId"
                className="bg-background"
                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <p className="text-muted-foreground text-sm">
                This is <strong>NOT</strong> required if using a local server. This value is stored in your browser's local storage and
                is only used to authenticate requests sent to your server.
              </p>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey ?? ""}
                className="bg-background"
                placeholder="lsv2_pt_..."
              />
            </div>

            <div className="mt-2 flex justify-end">
              <Button
                type="submit"
                size="lg"
              >
                Continue
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={finalApiUrl!}
      assistantId={finalAssistantId!}
    >
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
