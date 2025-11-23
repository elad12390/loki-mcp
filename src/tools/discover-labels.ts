import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const discoverLabelsTool: Tool = {
  name: "loki_discover_labels",
  description: "List all available label names (metadata keys) in Loki. Use this to find out what you can filter by (e.g. 'app', 'namespace', 'cluster').",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleDiscoverLabels() {
  const labels = await lokiClient.getLabels();
  return {
    content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
  };
}
