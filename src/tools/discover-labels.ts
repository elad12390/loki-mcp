import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const discoverLabelsTool: Tool = {
  name: "loki_discover_labels",
  description: "List all available label names (metadata keys) in Loki. Use this to find out what you can filter by (e.g. 'app', 'namespace', 'cluster').",
  inputSchema: {
    type: "object",
    properties: {
      page: { type: "number", description: "Page number (default 1)" },
      page_size: { type: "number", description: "Number of items per page (default 100)" }
    },
  },
};

export async function handleDiscoverLabels(args: any) {
  const { page = 1, page_size = 100 } = args as { page?: number; page_size?: number } || {};
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
