import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const searchLogsTool: Tool = {
  name: "loki_search_logs",
  description: "🔍 THE PRIMARY LOG SEARCH TOOL - Use this when the user asks to: 'check logs', 'look at logs', 'search logs', 'find in loki', 'check loki', 'what happened', 'show me errors', 'find error messages', 'search for X', or 'look for Y in logs'. Works across ALL services automatically (no labels needed) or can filter by specific app/service. Handles partial text matches, error messages, trace IDs, user IDs, anything! This is your first choice for any log investigation. Supports pagination for large result sets.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
      },
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
    required: ["reasoning"],
  },
};

export async function handleSearchLogs(args: any) {
  const params = args as {
    reasoning: string;
    labels?: Record<string, string>;
    search_term?: string;
    time_window?: string;
    limit?: number;
    end_time?: string;
  };

  metrics.trackToolUsage(searchLogsTool.name, params.reasoning);

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

  // Auto-suggest get_context when we find interesting logs
  if (logs.length > 0 && logs.length <= 10) {
    // Few results - likely found a specific error, suggest getting context
    const firstLog = logs[0];
    formattedLogs += `\n\n**Tip:** To see what happened before/after these logs, use \`loki_get_context\` with timestamp="${firstLog.ts}" and labels=${JSON.stringify(firstLog.labels)}`;
  } else if (logs.length > 0) {
    // Check if any logs contain error-like content
    const hasErrors = logs.some((l: any) => {
      const content = typeof l.line === 'string' ? l.line.toLowerCase() : JSON.stringify(l.line).toLowerCase();
      return content.includes('error') || content.includes('exception') || content.includes('failed') || content.includes('fatal');
    });
    
    if (hasErrors) {
      const errorLog = logs.find((l: any) => {
        const content = typeof l.line === 'string' ? l.line.toLowerCase() : JSON.stringify(l.line).toLowerCase();
        return content.includes('error') || content.includes('exception') || content.includes('failed') || content.includes('fatal');
      });
      if (errorLog) {
        formattedLogs += `\n\n**Tip:** Found error logs. To investigate root cause, use \`loki_get_context\` with timestamp="${errorLog.ts}" and labels=${JSON.stringify(errorLog.labels)}`;
      }
    }
  }

  return {
    content: [{ type: "text", text: formattedLogs || "No logs found matching criteria." }],
  };
}
