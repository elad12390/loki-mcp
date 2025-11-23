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
        description: "How far back to search. Examples: '1h', '30m', '1d'. You can also use '6h' to mean 'last 6 hours'. Default: '1h'",
        // Removed strict pattern to allow more flexible input that the client now handles
      },
      limit: { 
        type: "number", 
        description: "Max number of log lines to return. Default: 100" 
      },
      end_time: {
        type: "string",
        description: "Optional timestamp (nanoseconds or ISO) to search before. Use this for pagination to get older logs."
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
    end_time?: string;
  };

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.search_term,
    startAgo: params.time_window,
    limit: params.limit,
    end: params.end_time
  });

  const MAX_LOG_LENGTH = 60000; // Limit total output to ~60k characters (roughly 15k tokens)
  const MAX_LINE_LENGTH = 1000; // Limit single line to 1000 chars

  let formattedLogs = "";
  let currentLength = 0;
  let truncated = false;
  
  // Track the oldest timestamp seen to provide a next page cursor
  let oldestTimestamp = null;

  for (const l of logs) {
    oldestTimestamp = l.ts;
    // Convert ns timestamp to readable date
    const date = new Date(parseInt(l.ts) / 1e6).toISOString();
    
    // If l.line is an object (because we parsed it in the client), stringify it nicely
    // If it's a string, use it as is
    let lineContent = typeof l.line === 'object' 
      ? JSON.stringify(l.line, null, 0) // Compact JSON to save tokens but still be structured
      : l.line;

    if (lineContent.length > MAX_LINE_LENGTH) {
      lineContent = lineContent.substring(0, MAX_LINE_LENGTH) + "...(line truncated)";
    }

    const entry = `[${date}] ${JSON.stringify(l.labels)}: ${lineContent}`;
    const entryLength = entry.length + 1; // +1 for newline

    if (currentLength + entryLength > MAX_LOG_LENGTH) {
      formattedLogs += "\n... (Response truncated due to size limit. Please refine your search or reduce time window)";
      truncated = true;
      break;
    }

    formattedLogs += (formattedLogs ? "\n" : "") + entry;
    currentLength += entryLength;
  }
  
  if (logs.length > 0 && oldestTimestamp) {
      // Suggest next page if we got results
      formattedLogs += `\n\n---\nTo get older logs, run the command again with end_time="${oldestTimestamp}"`;
  }

  return {
    content: [{ type: "text", text: formattedLogs || "No logs found matching criteria." }],
  };
}
