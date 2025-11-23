import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const getContextTool: Tool = {
  name: "loki_get_context",
  description: "🔎 The detective's best friend! Found an error? Let me show you what led up to it and what happened after. This is THE tool for root cause analysis - errors rarely happen in isolation. See the full story: the requests that came before, the state of the system, and the cascading effects. Essential for understanding 'why did this happen?'",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are checking context."
      },
      labels: {
        type: "object",
        description: "The EXACT labels of the log entry you found. You MUST copy these from the log result.",
        additionalProperties: { type: "string" }
      },
      timestamp: {
        type: "string",
        description: "The timestamp of the log entry (ns). Found in the 'ts' field of the search result."
      },
      limit: {
        type: "number",
        description: "Number of lines to fetch in each direction. Default: 10"
      },
      direction: {
        type: "string",
        enum: ["before", "after", "both"],
        description: "Which context to fetch. Default: 'both'"
      }
    },
    required: ["reasoning", "labels", "timestamp"],
  },
};

export async function handleGetContext(args: any) {
  const params = args as {
    reasoning: string;
    labels: Record<string, string>;
    timestamp: string;
    limit?: number;
    direction?: "before" | "after" | "both";
  };

  metrics.trackToolUsage(getContextTool.name, params.reasoning);

  const limit = params.limit || 10;
  const direction = params.direction || "both";
  const ts = parseInt(params.timestamp); // ns
  
  const selectorParts = Object.entries(params.labels).map(([k, v]) => `${k}="${v}"`);
  const selector = `{${selectorParts.join(", ")}}`;

  let output = "";

  // Helper to format logs
  const format = (logs: any[]) => {
    return logs.map((l: any) => {
        const date = new Date(parseInt(l.ts) / 1e6).toISOString();
        let content = typeof l.line === 'object' ? JSON.stringify(l.line) : l.line;
        if (content.length > 200) content = content.substring(0, 200) + "...";
        return `[${date}] ${content}`;
    }).join("\n");
  };

  // 1. Fetch BEFORE (BACKWARD from ts)
  if (direction === "before" || direction === "both") {
    // We query slightly before the timestamp. 
    // Loki API 'end' is inclusive, so we use the timestamp as 'end'
    // But we strictly want *before*, so we might need to filter the target line itself if it appears.
    
    // We can't use our `searchLogs` wrapper easily because it sets 'start' based on 'startAgo'.
    // We need direct client access or a flexible `searchLogs`. 
    // Let's use `searchLogs` but trick the time window.
    // Actually, `searchLogs` supports `end`.
    
    // To get 'before', we look backward from TS.
    // Start can be TS - 1h (safe buffer). End is TS.
    const logsBefore = await lokiClient.searchLogs({
        selector: params.labels,
        limit: limit + 1, // Fetch one extra to account for potential overlap
        startAgo: "1h", 
        end: params.timestamp 
    });
    
    // The result is sorted DESC (newest first).
    // The first one might be our target line.
    
    // Filter out the exact target line if it matches (by timestamp)
    const filtered = logsBefore.filter((l: any) => l.ts !== params.timestamp).slice(0, limit);
    
    // Reverse to show chronological order
    filtered.reverse();
    
    output += "--- CONTEXT BEFORE ---\n";
    output += format(filtered);
    output += "\n";
  }

  // Target line
  output += `--- TARGET [${new Date(ts/1e6).toISOString()}] ---\n`;
  // (We don't have the content unless we fetch it, but user already has it)
  
  // 2. Fetch AFTER (FORWARD from ts)
  if (direction === "after" || direction === "both") {
    // To get 'after', we look forward from TS.
    // Start is TS. End is TS + 1h (safe buffer).
    // We use direction='FORWARD'.
    
    // We use explicit start timestamp now that client supports it.
    const logsAfter = await lokiClient.searchLogs({
        selector: params.labels,
        limit: limit + 1, 
        start: params.timestamp, // Start looking exactly at TS
        direction: "FORWARD"
        // End will default to now, which is fine (or we could cap it at ts + 1h if we wanted optimization)
    });
    
    // Filter out the exact target line if it matches
    const filtered = logsAfter.filter((l: any) => l.ts !== params.timestamp).slice(0, limit);
    
    // Already in forward order
    
    output += "\n--- CONTEXT AFTER ---\n";
    output += format(filtered);
    output += "\n";
  }

  return {
    content: [{ type: "text", text: output }],
  };
}
