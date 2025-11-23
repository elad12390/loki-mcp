import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const listServicesTool: Tool = {
  name: "loki_list_services",
  description: "List all available services (values of the 'service_name' or 'app' label).",
  inputSchema: {
    type: "object",
    properties: {
      page: { type: "number", description: "Page number (default 1)" },
      page_size: { type: "number", description: "Number of items per page (default 100)" }
    },
  },
};

export async function handleListServices(args: any) {
  const { page = 1, page_size = 100 } = args as { page?: number; page_size?: number } || {};

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
