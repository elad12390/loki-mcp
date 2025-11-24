import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const countErrorsTool: Tool = {
  name: "loki_count_errors",
  description: "📊 Use when user asks: 'how many errors', 'count errors', 'error rate', 'how many times', 'error trend', 'are errors increasing', 'error graph', or 'chart of errors'. Returns NUMBERS and TRENDS over time with visual ASCII chart. Perfect for answering 'how many?' questions without scrolling through logs. Shows if errors are increasing/decreasing and peak error rates. Much better than manually counting log lines!",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
      },
      labels: {
        type: "object",
        description: "Key-value pairs to filter the target service/app. e.g. {'app': 'payment'}",
        additionalProperties: { type: "string" }
      },
      search_term: {
        type: "string",
        description: "The pattern to count. Defaults to 'error' if omitted. Case-insensitive."
      },
      time_window: {
        type: "string",
        description: "Total time range to look back. e.g. '1h', '24h'. Default: '1h'"
      },
      step: {
        type: "string",
        description: "Interval size for each data point in the graph. e.g. '1m', '5m'. Default: '1m'"
      }
    },
    required: ["reasoning", "labels"],
  },
};

export async function handleCountErrors(args: any) {
  const params = args as {
    reasoning: string;
    labels: Record<string, string>;
    search_term?: string;
    time_window?: string;
    step?: string;
  };

  metrics.trackToolUsage(countErrorsTool.name, params.reasoning);

  // Construct LogQL metric query
  // Example: sum(count_over_time({app="foo"} |= "error" [1m]))
  
  const selectorParts = Object.entries(params.labels).map(([k, v]) => `${k}="${v}"`);
  const selector = `{${selectorParts.join(", ")}}`;
  
  const search = params.search_term || "error";
  const range = params.step || "1m"; // The range for the count_over_time window should match the step usually for smooth graphs
  
  // We use sum(...) to aggregate across all streams that match (e.g. all pods of the app)
  const query = `sum(count_over_time(${selector} |~ "(?i)${search}" [${range}]))`;
  
  const results = await lokiClient.queryMetric(
    query,
    params.time_window || "1h",
    params.step || "1m"
  );

  // Format simple ASCII graph or list
  // Result is array of series (should be 1 series because we summed)
  
  if (!results || results.length === 0) {
    return {
      content: [{ type: "text", text: "No data found." }],
    };
  }

  const series = results[0]; // We expect one series due to sum()
  const values = series.values;
  
  if (values.length === 0) {
    return {
      content: [{ type: "text", text: "No errors found in this time range." }],
    };
  }

  // Calculate stats
  let total = 0;
  let max = 0;
  for (const v of values) {
    total += v.value;
    if (v.value > max) max = v.value;
  }

  let output = `Found ${total} occurrences of '${search}' in the last ${params.time_window || '1h'}.\n\n`;
  output += `Peak rate: ${max} per ${params.step || '1m'}.\n\n`;
  output += "Time Series:\n";

  // Downsample for display if too many points
  const displayPoints = values.length > 20 ? 
    values.filter((_: any, i: number) => i % Math.ceil(values.length / 20) === 0) : 
    values;

  for (const v of displayPoints) {
     const date = new Date(v.ts * 1000).toISOString().substring(11, 19); // HH:mm:ss
     const bar = "█".repeat(Math.ceil((v.value / max) * 10)); // simple bar chart
     output += `${date} | ${v.value.toString().padEnd(4)} ${bar}\n`;
  }

  return {
    content: [{ type: "text", text: output }],
  };
}
