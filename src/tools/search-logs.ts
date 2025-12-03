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
        description: "How far back to search FROM NOW. Examples: '1h', '30m', '1d'. Ignored if start_time is provided. Default: '1h'",
      },
      start_time: {
        type: "string",
        description: "Search logs AFTER this time. ISO format (e.g. '2024-12-03T06:27:00Z') or nanoseconds. Use with end_time for a specific time range."
      },
      end_time: {
        type: "string",
        description: "Search logs BEFORE this time. ISO format (e.g. '2024-12-03T06:48:00Z') or nanoseconds. Defaults to now."
      },
      limit: { 
        type: "number", 
        description: "Max number of log lines to return. Default: 100" 
      },
      include_infrastructure: {
        type: "boolean",
        description: "Include infrastructure logs (loki, promtail, grafana, prometheus, etc.). Default: false. These are excluded by default because they echo search terms back in their logs, causing false matches."
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
    start_time?: string;
    end_time?: string;
    limit?: number;
    include_infrastructure?: boolean;
  };

  metrics.trackToolUsage(searchLogsTool.name, params.reasoning);

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.search_term,
    startAgo: params.time_window,
    start: params.start_time,
    end: params.end_time,
    limit: params.limit,
    includeInfrastructure: params.include_infrastructure
  });

  const MAX_LOG_LENGTH = 60000; // Limit total output to ~60k characters (roughly 15k tokens)
  const MAX_LINE_LENGTH = 1000; // Limit single line to 1000 chars

  // Track unique sources (pods/containers) in results
  const sources = new Map<string, number>();
  for (const l of logs) {
    const source = l.labels?.k8s_pod_name || l.labels?.pod || l.labels?.instance || l.labels?.service_name || 'unknown';
    sources.set(source, (sources.get(source) || 0) + 1);
  }

  let formattedLogs = "";
  
  // Add summary header if logs come from multiple sources
  if (sources.size > 1) {
    formattedLogs = `**Sources (${sources.size} pods):** ${Array.from(sources.entries()).map(([s, c]) => `${s} (${c})`).join(', ')}\n\n`;
  } else if (sources.size === 1) {
    const [source, count] = Array.from(sources.entries())[0];
    formattedLogs = `**Source:** ${source} (${count} logs)\n\n`;
  }

  let currentLength = formattedLogs.length;
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
