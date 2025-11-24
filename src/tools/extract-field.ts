import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const extractFieldTool: Tool = {
  name: "loki_extract_field",
  description: "🎯 Use when user asks: 'extract field X', 'what are the top values for X', 'which users', 'which endpoints', 'most common status codes', 'show me all X values', or 'count by field'. Extracts ANY field from JSON/logfmt logs, counts occurrences, shows frequency distribution. Works with nested fields (like 'error.message'). Perfect for data analysis - turn logs into insights!",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are extracting this field."
      },
      labels: {
        type: "object",
        description: "Key-value pairs to filter logs. e.g. {'app': 'payment'}",
        additionalProperties: { type: "string" }
      },
      field_name: {
        type: "string",
        description: "The JSON/logfmt field to extract. e.g. 'user_id', 'status_code', 'error.message'"
      },
      search_term: {
        type: "string",
        description: "Optional filter to narrow down logs before extraction. e.g. 'timeout' or 'error'"
      },
      time_window: {
        type: "string",
        description: "How far back to search. Default: '1h'"
      },
      limit: {
        type: "number",
        description: "Max logs to scan. Default: 1000"
      },
      format: {
        type: "string",
        enum: ["json", "logfmt"],
        description: "Log format. Default: 'json'"
      }
    },
    required: ["reasoning", "labels", "field_name"],
  },
};

export async function handleExtractField(args: any) {
  const params = args as {
    reasoning: string;
    labels: Record<string, string>;
    field_name: string;
    search_term?: string;
    time_window?: string;
    limit?: number;
    format?: "json" | "logfmt";
  };

  metrics.trackToolUsage(extractFieldTool.name, params.reasoning);

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.search_term,
    startAgo: params.time_window || "1h",
    limit: params.limit || 1000
  });

  // Extract the field from each log
  const fieldValues: string[] = [];
  const format = params.format || "json";

  for (const log of logs) {
    let obj: any = null;

    // Parse the log line
    if (typeof log.line === 'object') {
      obj = log.line;
    } else if (typeof log.line === 'string') {
      if (format === "json") {
        try {
          obj = JSON.parse(log.line);
        } catch (e) {
          continue;
        }
      } else if (format === "logfmt") {
        // Simple logfmt parser (key=value key=value)
        obj = {};
        const pairs = log.line.match(/(\w+)=("([^"]*)"|(\S+))/g);
        if (pairs) {
          for (const pair of pairs) {
            const [key, value] = pair.split('=');
            obj[key] = value.replace(/^"|"$/g, ''); // Remove quotes
          }
        }
      }
    }

    if (!obj) continue;

    // Support nested field access with dot notation (e.g., "error.message")
    const fieldPath = params.field_name.split('.');
    let value: any = obj;
    
    for (const key of fieldPath) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    if (value !== undefined && value !== null) {
      fieldValues.push(String(value));
    }
  }

  if (fieldValues.length === 0) {
    return {
      content: [{ type: "text", text: `No values found for field '${params.field_name}' in ${logs.length} logs scanned.` }],
    };
  }

  // Calculate frequency distribution
  const frequency = new Map<string, number>();
  for (const val of fieldValues) {
    frequency.set(val, (frequency.get(val) || 0) + 1);
  }

  // Sort by frequency (descending)
  const sorted = Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]);

  // Format output
  let output = `Extracted ${fieldValues.length} values for field '${params.field_name}' from ${logs.length} logs.\n`;
  output += `Found ${frequency.size} unique values.\n\n`;
  output += "Top values by frequency:\n";

  const MAX_OUTPUT = 30000;
  const maxDisplay = Math.min(sorted.length, 50); // Show top 50

  for (let i = 0; i < maxDisplay; i++) {
    const [value, count] = sorted[i];
    const percentage = ((count / fieldValues.length) * 100).toFixed(1);
    const line = `${i + 1}. ${value} - ${count} occurrences (${percentage}%)\n`;
    
    if (output.length + line.length > MAX_OUTPUT) {
      output += "\n... (Output truncated)";
      break;
    }
    output += line;
  }

  if (sorted.length > maxDisplay) {
    output += `\n... and ${sorted.length - maxDisplay} more unique values.`;
  }

  return {
    content: [{ type: "text", text: output }],
  };
}
