import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const searchLogsTool: Tool = {
  name: "loki_search_logs",
  description: "Easy mode log search. Fetch logs by filtering on labels and/or text content. Returns newest logs first.",
  inputSchema: {
    type: "object",
    properties: {
      labels: { 
        type: "object", 
        description: "Key-value pairs to filter logs. AT LEAST ONE is usually required by Loki. Example: {'app': 'payment-service', 'env': 'prod'}",
        additionalProperties: { type: "string" }
      },
      search_term: { 
        type: "string", 
        description: "Text to search for within the log line (case-sensitive by default in simple mode). Example: 'Connection refused' or 'error'" 
      },
      time_window: { 
        type: "string", 
        description: "How far back to search. Format: '1h', '30m', '1d'. Default: '1h'",
        pattern: "^\\d+[smhd]$"
      },
      limit: { 
        type: "number", 
        description: "Max number of log lines to return. Default: 100" 
      }
    },
    required: [],
  },
};

export async function handleSearchLogs(args: any) {
  const params = args as {
    labels?: Record<string, string>;
    search_term?: string;
    time_window?: string;
    limit?: number;
  };

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.search_term,
    startAgo: params.time_window,
    limit: params.limit
  });

  // Format logs nicely for the LLM
  const formattedLogs = logs.map((l: any) => {
    // Convert ns timestamp to readable date
    const date = new Date(parseInt(l.ts) / 1e6).toISOString();
    return `[${date}] ${JSON.stringify(l.labels)}: ${l.line}`;
  }).join("\n");

  return {
    content: [{ type: "text", text: formattedLogs || "No logs found matching criteria." }],
  };
}
