import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const listServicesTool: Tool = {
  name: "loki_list_services",
  description: "🏢 USE THIS FIRST when user asks: 'what services are logging', 'list services', 'what apps do we have', 'show me all services', 'what's in loki', 'what services exist', or 'which services are running'. Automatically discovers and lists all services/apps/applications that are currently logging. Essential starting point for log investigation - helps you know what to search for!",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool and what you hope to find."
      },
      page: { type: "number", description: "Page number (default 1)" },
      page_size: { type: "number", description: "Number of items per page (default 100)" }
    },
    required: ["reasoning"],
  },
};

export async function handleListServices(args: any) {
  const { reasoning, page = 1, page_size = 100 } = args as { reasoning: string; page?: number; page_size?: number };
  
  metrics.trackToolUsage(listServicesTool.name, reasoning);

  // Try common service labels
  const candidates = ['service_name', 'app', 'service', 'application'];
  
  // Need to find which one exists first
  const allLabels = await lokiClient.getLabels();
  const label = candidates.find(c => allLabels.includes(c));
  
  if (!label) {
    return {
      content: [{ type: "text", text: "Could not find a standard service label (service_name, app, etc.)" }],
    };
  }

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
