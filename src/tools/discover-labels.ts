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
  
  let result = JSON.stringify(labels, null, 2);
  const MAX_LENGTH = 30000;

  if (result.length > MAX_LENGTH) {
    const subset = labels.slice(0, 100);
    result = JSON.stringify(subset, null, 2) + `\n\n... (Output truncated. Showing first 100 of ${labels.length} labels)`;
  }

  return {
    content: [{ type: "text", text: result }],
  };
}
