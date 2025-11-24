import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const getLabelValuesTool: Tool = {
  name: "loki_get_label_values",
  description: "📋 Use when user asks: 'what are the values for X label', 'which apps', 'what environments', 'list all X', or after using discover_labels. Shows all possible VALUES for a specific label (e.g., all values for 'app' label might be ['frontend', 'backend', 'payment']). Essential for knowing exact names to use when filtering logs. Use after discover_labels to drill down.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
      },
      label: { type: "string", description: "The label name to look up (e.g. 'app', 'job')" },
      page: { type: "number", description: "Page number (default 1)" },
      page_size: { type: "number", description: "Number of items per page (default 100)" }
    },
    required: ["reasoning", "label"],
  },
};

export async function handleGetLabelValues(args: any) {
  const { reasoning, label, page = 1, page_size = 100 } = args as { reasoning: string; label: string; page?: number; page_size?: number };
  
  metrics.trackToolUsage(getLabelValuesTool.name, reasoning);

  const values = await lokiClient.getLabelValues(label);
  
  const start = (page - 1) * page_size;
  const end = start + page_size;
  const subset = values.slice(start, end);
  
  let result = JSON.stringify(subset, null, 2);
  
  if (values.length > end) {
      result += `\n\n(Showing items ${start + 1}-${end} of ${values.length}. To see more, run again with page=${page + 1})`;
  } else if (start > 0) {
      result += `\n\n(Showing items ${start + 1}-${Math.min(end, values.length)} of ${values.length})`;
  }

  return {
    content: [{ type: "text", text: result }],
  };
}
