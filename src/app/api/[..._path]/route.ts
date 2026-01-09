import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.VERCEL_ENV === "production"
      ? process.env.LANGGRAPH_API_URL_PROD ?? "remove-me"
      : process.env.LANGGRAPH_API_URL_DEV ?? "remove-me",
    apiKey: process.env.VERCEL_ENV === "production"
      ? process.env.LANGSMITH_API_KEY_PROD ?? "remove-me"
      : process.env.LANGSMITH_API_KEY_DEV ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
  });
