import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
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
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";
import { createClient } from "./client";
import { listingIdToThreadId } from "@/lib/thread-id";
import { validate } from "uuid";

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
  listingId?: string;
  user_name?: string;
  threadExists?: boolean | null;
  isCheckingThread?: boolean;
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

async function checkThreadExists(
  apiUrl: string,
  apiKey: string | null,
  threadId: string,
): Promise<boolean> {
  try {
    const client = createClient(apiUrl, apiKey ?? undefined);
    await client.threads.get(threadId);
    return true;
  } catch (error) {
    // Thread doesn't exist or error occurred
    return false;
  }
}

async function createThreadWithId(
  apiUrl: string,
  apiKey: string | null,
  threadId: string,
  assistantId: string,
): Promise<boolean> {
  try {
    const client = createClient(apiUrl, apiKey ?? undefined);
    // Determine metadata based on whether assistantId is a UUID or graph name
    const metadata = validate(assistantId)
      ? { assistant_id: assistantId }
      : { graph_id: assistantId };
    
    await client.threads.create({
      threadId,
      metadata,
    });
    return true;
  } catch (error) {
    console.error("Error creating thread:", error);
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
  const [listingId] = useQueryState("listingId");
  const [user_name] = useQueryState("user_name");
  const { getThreads, setThreads } = useThreads();
  const [threadExists, setThreadExists] = useState<boolean | null>(null);
  const [isCheckingThread, setIsCheckingThread] = useState(false);

  // Generate threadId from listingId if listingId is provided but threadId is not
  useEffect(() => {
    if (listingId && !threadId) {
      const generatedThreadId = listingIdToThreadId(listingId);
      if (generatedThreadId) {
        // Update URL with generated threadId
        setThreadId(generatedThreadId);
        console.log(
          `Generated threadId ${generatedThreadId} from listingId ${listingId}`,
        );
      }
    }
  }, [listingId, threadId, setThreadId]);

  // Check if thread exists when threadId is provided, and create it if it doesn't
  useEffect(() => {
    if (threadId && apiUrl && assistantId) {
      setIsCheckingThread(true);
      checkThreadExists(apiUrl, apiKey, threadId)
        .then(async (exists) => {
          if (!exists) {
            // Thread doesn't exist - create it with the specific threadId
            console.log(
              `Thread ${threadId} does not exist. Creating thread with ID...`,
            );
            const created = await createThreadWithId(
              apiUrl,
              apiKey,
              threadId,
              assistantId,
            );
            if (created) {
              setThreadExists(true);
              console.log(
                `Successfully created thread ${threadId} with listingId: ${listingId}, user_name: ${user_name}`,
              );
            } else {
              setThreadExists(false);
              console.error(`Failed to create thread ${threadId}`);
            }
          } else {
            setThreadExists(true);
            console.log(`Thread ${threadId} exists. Resuming conversation.`);
          }
        })
        .catch((error) => {
          console.error("Error checking/creating thread:", error);
          setThreadExists(false);
        })
        .finally(() => {
          setIsCheckingThread(false);
        });
    } else {
      setThreadExists(null);
    }
  }, [threadId, apiUrl, apiKey, assistantId, listingId, user_name]);

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
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  // Expose listingId and user_name through context for use in Thread component
  const streamValueWithCustomParams = {
    ...streamValue,
    listingId: listingId ?? undefined,
    user_name: user_name ?? undefined,
    threadExists,
    isCheckingThread,
  };

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  return (
    <StreamContext.Provider value={streamValueWithCustomParams}>
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
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">
                Agent Chat
              </h1>
            </div>
            <p className="text-muted-foreground">
              Welcome to Agent Chat! Before you get started, you need to enter
              the URL of the deployment and the assistant / graph ID.
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
                This is the URL of your LangGraph deployment. Can be a local, or
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
                Assistant / Graph ID<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the ID of the graph (can be the graph name), or
                assistant to fetch threads from, and invoke when actions are
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
              <Label htmlFor="apiKey">LangSmith API Key</Label>
              <p className="text-muted-foreground text-sm">
                This is <strong>NOT</strong> required if using a local LangGraph
                server. This value is stored in your browser's local storage and
                is only used to authenticate requests sent to your LangGraph
                server.
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
