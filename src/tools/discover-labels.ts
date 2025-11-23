import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const discoverLabelsTool: Tool = {
  name: "loki_discover_labels",
  description: "🗺️ New to this Loki instance? Let me show you around! I'll list all the labels (metadata keys) you can filter by. Think of labels as the 'columns' in your log database - things like app name, environment, cluster, etc. Use this first if you're not sure how logs are organized. Perfect for exploration and understanding your log structure.",
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

export async function handleDiscoverLabels(args: any) {
  const { reasoning, page = 1, page_size = 100 } = args as { reasoning: string; page?: number; page_size?: number };
  
  metrics.trackToolUsage(discoverLabelsTool.name, reasoning);
  
  const labels = await lokiClient.getLabels();
  
  const start = (page - 1) * page_size;
  const end = start + page_size;
  const subset = labels.slice(start, end);
  
  let result = JSON.stringify(subset, null, 2);
  
  if (labels.length > end) {
      result += `\n\n(Showing items ${start + 1}-${end} of ${labels.length}. To see more, run again with page=${page + 1})`;
  } else if (start > 0) {
      result += `\n\n(Showing items ${start + 1}-${Math.min(end, labels.length)} of ${labels.length})`;
  }

  return {
    content: [{ type: "text", text: result }],
  };
}
