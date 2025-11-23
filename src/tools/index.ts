import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { discoverLabelsTool, handleDiscoverLabels } from "./discover-labels.js";
import { getLabelValuesTool, handleGetLabelValues } from "./get-label-values.js";
import { searchLogsTool, handleSearchLogs } from "./search-logs.js";

export const tools: Tool[] = [
  discoverLabelsTool,
  getLabelValuesTool,
  searchLogsTool,
];

export const handlers: Record<string, (args: any) => Promise<any>> = {
  [discoverLabelsTool.name]: handleDiscoverLabels,
  [getLabelValuesTool.name]: handleGetLabelValues,
  [searchLogsTool.name]: handleSearchLogs,
};
