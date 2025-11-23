import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSearchLogs } from "./search-logs.js";

// This is a wrapper around searchLogs with specific defaults for "tailing"
export const tailLogsTool: Tool = {
  name: "loki_tail_logs",
  description: "📡 See what's happening RIGHT NOW! Perfect for that 'I just deployed, is it working?' moment. Shows the freshest logs (last 5 minutes) so you can monitor your app in real-time. Great for: watching deployments, debugging live issues, or just checking the pulse of your system. No need to SSH into servers!",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are tailing logs."
      },
      labels: {
        type: "object",
        description: "Key-value pairs to filter logs. e.g. {'app': 'payment'}",
        additionalProperties: { type: "string" }
      },
      search_term: {
        type: "string",
        description: "Optional filter pattern."
      },
      limit: {
        type: "number",
        description: "Max lines to fetch. Default: 50"
      }
    },
    required: ["reasoning"], // Labels optional if we want to search everything
  },
};

export async function handleTailLogs(args: any) {
    const params = args as {
        reasoning: string;
        labels?: Record<string, string>;
        search_term?: string;
        limit?: number;
    };
    
    // Just delegate to search logs with fixed time window of 5 minutes
    return handleSearchLogs({
        reasoning: params.reasoning,
        labels: params.labels,
        search_term: params.search_term,
        limit: params.limit || 50,
        time_window: "5m"
    });
}
