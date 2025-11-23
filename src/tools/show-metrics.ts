import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { metrics } from "../lib/metrics.js";

export const showMetricsTool: Tool = {
  name: "loki_show_metrics",
  description: "Show usage statistics for Loki MCP tools. Displays how many times each tool was used and the reasoning provided.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are checking metrics."
      }
    },
    required: ["reasoning"],
  },
};

export async function handleShowMetrics(args: any) {
  const { reasoning } = args as { reasoning: string };
  
  // Track self-usage too!
  metrics.trackToolUsage(showMetricsTool.name, reasoning);

  const data = metrics.getMetrics();
  let output = "# Loki MCP Tool Usage Metrics\n\n";

  const tools = Object.entries(data.tools).sort((a, b) => b[1].count - a[1].count);

  if (tools.length === 0) {
    return {
      content: [{ type: "text", text: "No tool usage recorded yet." }],
    };
  }

  for (const [name, stats] of tools) {
    output += `## ${name}\n`;
    output += `- **Total Usages:** ${stats.count}\n`;
    output += `- **Last Used:** ${stats.lastUsed}\n`;
    output += `- **Recent Reasons:**\n`;
    
    // Show last 5 reasons
    const recent = stats.usages.slice(0, 5);
    for (const usage of recent) {
        output += `  - [${usage.timestamp}] ${usage.reasoning}\n`;
    }
    output += "\n";
  }

  return {
    content: [{ type: "text", text: output }],
  };
}
