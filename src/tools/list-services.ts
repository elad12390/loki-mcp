import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const listServicesTool: Tool = {
  name: "loki_list_services",
  description: "List all available services (values of the 'service_name' or 'app' label).",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleListServices() {
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
  return {
    content: [{ type: "text", text: JSON.stringify(values, null, 2) }],
  };
}
