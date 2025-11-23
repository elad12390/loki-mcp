import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";

export const getLabelValuesTool: Tool = {
  name: "loki_get_label_values",
  description: "Get all existing values for a specific label. Use this to see valid options for a filter (e.g. ask for 'app' to see all app names).",
  inputSchema: {
    type: "object",
    properties: {
      label: { type: "string", description: "The label name to look up (e.g. 'app', 'job')" },
    },
    required: ["label"],
  },
};

export async function handleGetLabelValues(args: any) {
  const { label } = args as { label: string };
  const values = await lokiClient.getLabelValues(label);
  return {
    content: [{ type: "text", text: JSON.stringify(values, null, 2) }],
  };
}
