import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const patternAnalysisTool: Tool = {
  name: "loki_pattern_analysis",
  description: "Group logs into patterns by replacing dynamic content (IDs, numbers, timestamps) with placeholders. Shows most common error templates. Essential for understanding 'What types of errors are happening?' rather than individual instances.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are analyzing patterns."
      },
      labels: {
        type: "object",
        description: "Key-value pairs to filter logs. e.g. {'app': 'payment'}",
        additionalProperties: { type: "string" }
      },
      search_term: {
        type: "string",
        description: "Optional filter. e.g. 'error' or 'exception'"
      },
      time_window: {
        type: "string",
        description: "How far back to search. Default: '1h'"
      },
      limit: {
        type: "number",
        description: "Max logs to scan. Default: 500"
      },
      min_occurrences: {
        type: "number",
        description: "Only show patterns that appear at least this many times. Default: 2"
      }
    },
    required: ["reasoning", "labels"],
  },
};

// Helper function to normalize log lines into patterns
function normalizeToPattern(line: string): string {
  let pattern = line;
  
  // Replace UUIDs (8-4-4-4-12 format)
  pattern = pattern.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
  
  // Replace hex strings (0x... or just long hex)
  pattern = pattern.replace(/0x[0-9a-f]+/gi, '<HEX>');
  pattern = pattern.replace(/\b[0-9a-f]{16,}\b/gi, '<HEX>');
  
  // Replace timestamps (ISO format, RFC3339, etc.)
  pattern = pattern.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, '<TIMESTAMP>');
  
  // Replace IP addresses
  pattern = pattern.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>');
  
  // Replace numbers (but preserve common status codes and smaller numbers)
  // Replace large numbers (>= 1000 or decimals)
  pattern = pattern.replace(/\b\d{4,}\b/g, '<NUM>');
  pattern = pattern.replace(/\b\d+\.\d+\b/g, '<NUM>');
  
  // Replace quoted strings (paths, messages, etc.)
  pattern = pattern.replace(/"[^"]{20,}"/g, '"<STRING>"');
  pattern = pattern.replace(/'[^']{20,}'/g, "'<STRING>'");
  
  // Replace file paths
  pattern = pattern.replace(/\/[\w\-./]+/g, '<PATH>');
  
  // Replace memory addresses
  pattern = pattern.replace(/\b[0-9a-f]{10,}\b/gi, '<ADDR>');
  
  return pattern;
}

export async function handlePatternAnalysis(args: any) {
  const params = args as {
    reasoning: string;
    labels: Record<string, string>;
    search_term?: string;
    time_window?: string;
    limit?: number;
    min_occurrences?: number;
  };

  metrics.trackToolUsage(patternAnalysisTool.name, params.reasoning);

  const logs = await lokiClient.searchLogs({
    selector: params.labels,
    search: params.search_term,
    startAgo: params.time_window || "1h",
    limit: params.limit || 500
  });

  if (logs.length === 0) {
    return {
      content: [{ type: "text", text: "No logs found matching criteria." }],
    };
  }

  // Group logs by pattern
  const patternMap = new Map<string, { count: number; examples: string[] }>();

  for (const log of logs) {
    let lineContent = typeof log.line === 'object' ? JSON.stringify(log.line) : String(log.line);
    
    // Truncate very long lines before pattern matching
    if (lineContent.length > 500) {
      lineContent = lineContent.substring(0, 500);
    }

    const pattern = normalizeToPattern(lineContent);

    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, { count: 0, examples: [] });
    }

    const entry = patternMap.get(pattern)!;
    entry.count++;
    
    // Keep up to 2 examples per pattern
    if (entry.examples.length < 2) {
      entry.examples.push(lineContent);
    }
  }

  // Filter by min_occurrences
  const minOccurrences = params.min_occurrences || 2;
  const filtered = Array.from(patternMap.entries())
    .filter(([_, data]) => data.count >= minOccurrences)
    .sort((a, b) => b[1].count - a[1].count);

  if (filtered.length === 0) {
    return {
      content: [{ 
        type: "text", 
        text: `Analyzed ${logs.length} logs. No recurring patterns found (all logs are unique or occur less than ${minOccurrences} times).` 
      }],
    };
  }

  // Format output
  let output = `Analyzed ${logs.length} logs and found ${filtered.length} distinct patterns.\n\n`;

  const MAX_OUTPUT = 40000;

  for (let i = 0; i < filtered.length; i++) {
    const [pattern, data] = filtered[i];
    const percentage = ((data.count / logs.length) * 100).toFixed(1);
    
    let block = `## Pattern ${i + 1} (${data.count} occurrences, ${percentage}%)\n`;
    block += `**Template:** ${pattern}\n\n`;
    block += `**Example:**\n`;
    block += data.examples[0].substring(0, 300);
    if (data.examples[0].length > 300) block += "...";
    block += "\n\n";
    
    if (output.length + block.length > MAX_OUTPUT) {
      output += "... (Output truncated)";
      break;
    }
    
    output += block;
  }

  return {
    content: [{ type: "text", text: output }],
  };
}
