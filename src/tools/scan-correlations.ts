import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const scanCorrelationsTool: Tool = {
  name: "loki_scan_correlations",
  description: "🔗 TRACE ID LOOKUP TOOL - Use when user mentions ANY ID that looks like a trace/correlation/request ID (UUIDs like 'fcfdb9e9-ffaf-45c1-9dd8-f148be2ba6be', or any ID pattern). Use when user asks: 'find all logs for trace X', 'where did trace_id go', 'follow this ID across services', 'what services touched this request', 'trace this UUID', 'find logs with this ID', 'track request flow', or 'distributed tracing'. CRITICAL: When you see a user paste an ID and ask to find/trace/follow it, use THIS tool - not search_logs. This tool finds ALL services and operations that handled a specific trace/correlation ID.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
      },
      trace_id: {
        type: "string",
        description: "The specific trace/correlation/request ID to search for. If provided, searches for this exact ID across all logs."
      },
      labels: {
        type: "object",
        description: "Optional key-value pairs to filter logs. Example: {'app': 'payment'}",
        additionalProperties: { type: "string" }
      },
      time_window: {
        type: "string",
        description: "How far back to search. Default: '1h'"
      },
      correlation_keys: {
        type: "array",
        items: { type: "string" },
        description: "JSON keys to treat as correlation IDs. Default: ['correlation_id', 'trace_id', 'request_id']"
      },
      type_keys: {
        type: "array",
        items: { type: "string" },
        description: "JSON keys to treat as message/request types. Default: ['topic', 'route', 'type', 'message_type', 'request_type', 'method', 'action']"
      },
      limit: {
        type: "number",
        description: "Max logs to scan. Default: 500"
      }
    },
    required: ["reasoning"],
  },
};

export async function handleScanCorrelations(args: any) {
  const params = args as {
    reasoning: string;
    trace_id?: string;
    labels?: Record<string, string>;
    time_window?: string;
    correlation_keys?: string[];
    type_keys?: string[];
    limit?: number;
  };
  
  metrics.trackToolUsage(scanCorrelationsTool.name, params.reasoning);

  const limit = params.limit || 500;
  const correlationKeys = params.correlation_keys || ['correlation_id', 'trace_id', 'request_id', 'correlationId', 'traceId', 'requestId'];
  const typeKeys = params.type_keys || ['topic', 'route', 'type', 'message_type', 'eventType', 'event_type', 'request_type', 'method', 'action', 'operation'];

  // If a specific trace_id is provided, search for it directly
  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.trace_id, // Search for the trace ID in log content
    startAgo: params.time_window || "1h",
    limit: limit
  });

  const correlationMap = new Map<string, Set<string>>();
  let matchCount = 0;

  for (const log of logs) {
    const content = log.line;
    let obj: any = null;

    if (typeof content === 'object') {
      obj = content;
    } else {
      try {
        obj = JSON.parse(content);
      } catch (e) {
        continue; // Skip non-JSON lines
      }
    }

    // Find correlation ID
    let cid = null;
    for (const key of correlationKeys) {
      if (obj[key]) {
        cid = String(obj[key]);
        break;
      }
    }

    if (!cid) continue;

    // Find Type
    let msgType = "unknown";
    for (const key of typeKeys) {
      if (obj[key]) {
        msgType = String(obj[key]);
        break;
      }
    }

    if (!correlationMap.has(cid)) {
      correlationMap.set(cid, new Set());
    }
    correlationMap.get(cid)?.add(msgType);
    matchCount++;
  }

  // Format output
  let result = "";
  
  if (params.trace_id) {
    // Specific trace ID mode - show detailed flow
    result = `# Trace: ${params.trace_id}\n\n`;
    result += `Found ${logs.length} log entries for this trace.\n\n`;
    
    if (logs.length > 0) {
      // Group by service/app for clarity
      const serviceGroups = new Map<string, any[]>();
      for (const log of logs) {
        const service = log.labels?.app || log.labels?.k8s_container_name || log.labels?.service_name || 'unknown';
        if (!serviceGroups.has(service)) {
          serviceGroups.set(service, []);
        }
        serviceGroups.get(service)?.push(log);
      }
      
      result += `## Services touched: ${Array.from(serviceGroups.keys()).join(', ')}\n\n`;
      
      // Show operations/types found
      const allTypes = new Set<string>();
      for (const log of logs) {
        const content = typeof log.line === 'object' ? log.line : (() => { try { return JSON.parse(log.line); } catch { return null; } })();
        if (content) {
          for (const key of typeKeys) {
            if (content[key]) allTypes.add(String(content[key]));
          }
        }
      }
      if (allTypes.size > 0) {
        result += `## Operations: ${Array.from(allTypes).join(', ')}\n\n`;
      }
      
      result += `## Timeline (newest first):\n`;
      const MAX_ENTRIES = 50;
      for (let i = 0; i < Math.min(logs.length, MAX_ENTRIES); i++) {
        const log = logs[i];
        const date = new Date(parseInt(log.ts) / 1e6).toISOString();
        const service = log.labels?.app || log.labels?.k8s_container_name || 'unknown';
        const content = typeof log.line === 'object' ? log.line : (() => { try { return JSON.parse(log.line); } catch { return log.line; } })();
        const msgType = content && typeof content === 'object' 
          ? (content.type || content.action || content.message || content.msg || '') 
          : '';
        const preview = typeof content === 'object' 
          ? JSON.stringify(content).substring(0, 200) 
          : String(content).substring(0, 200);
        result += `\n[${date}] **${service}** ${msgType}\n  ${preview}${preview.length >= 200 ? '...' : ''}\n`;
      }
      if (logs.length > MAX_ENTRIES) {
        result += `\n... and ${logs.length - MAX_ENTRIES} more entries`;
      }
    }
  } else {
    // Discovery mode - find all correlation IDs
    result = `Scanned ${logs.length} logs. Found ${correlationMap.size} unique correlation IDs in ${matchCount} matching logs.\n\n`;
  
    // Sort by number of types found (interesting ones first)
    const sortedEntries = Array.from(correlationMap.entries()).sort((a, b) => {
      // Primary sort: number of distinct types (descending)
      if (b[1].size !== a[1].size) return b[1].size - a[1].size;
      // Secondary sort: ID (lexicographical)
      return a[0].localeCompare(b[0]);
    });

    const MAX_OUTPUT_LENGTH = 30000;

    for (const [cid, types] of sortedEntries) {
      const typeList = Array.from(types).join(", ");
      const line = `- ${cid}: [${typeList}]\n`;
      
      if (result.length + line.length > MAX_OUTPUT_LENGTH) {
        result += "\n... (Output truncated)";
        break;
      }
      result += line;
    }

    if (correlationMap.size === 0) {
      result += "No correlation IDs found. Check your 'correlation_keys' parameter or log format.";
    }
  }

  return {
    content: [{ type: "text", text: result }],
  };
}
