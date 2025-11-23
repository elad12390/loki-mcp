import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const searchLogsTool: Tool = {
  name: "loki_search_logs",
  description: "Smart log search. The EASIEST way to find logs. Automatically handles stream selectors - just provide a search term to search all services/apps.",
  inputSchema: {
    type: "object",
    properties: {
      labels: { 
        type: "object", 
        description: "Optional key-value pairs to filter logs. If omitted, the tool automatically finds the best label (like 'app' or 'service') to search ALL logs. Example: {'env': 'prod'}",
        additionalProperties: { type: "string" }
      },
      search_term: { 
        type: "string", 
        description: "Text to search for (e.g. error message, trace ID). The tool will automatically search across all services if no labels are provided." 
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
