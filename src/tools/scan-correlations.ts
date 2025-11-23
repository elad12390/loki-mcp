import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const scanCorrelationsTool: Tool = {
  name: "loki_scan_correlations",
  description: "Scans logs to find correlation IDs and associated message/request types. Helpful for tracing requests or understanding message flows.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
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

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
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
  let result = `Scanned ${logs.length} logs. Found ${correlationMap.size} unique correlation IDs in ${matchCount} matching logs.\n\n`;
  
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

  return {
    content: [{ type: "text", text: result }],
  };
}
