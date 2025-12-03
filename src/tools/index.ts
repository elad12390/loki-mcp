import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { searchLogsTool, handleSearchLogs } from "./search-logs.js";
import { scanCorrelationsTool, handleScanCorrelations } from "./scan-correlations.js";
import { showMetricsTool, handleShowMetrics } from "./show-metrics.js";
import { countErrorsTool, handleCountErrors } from "./count-errors.js";
import { getContextTool, handleGetContext } from "./get-context.js";
import { extractFieldTool, handleExtractField } from "./extract-field.js";
import { patternAnalysisTool, handlePatternAnalysis } from "./pattern-analysis.js";

// Note: discover_labels, get_label_values, and list_services are now MCP Resources
// See src/index.ts for resource definitions (loki://labels, loki://labels/{label}/values, loki://services)

export const tools: Tool[] = [
  searchLogsTool,
  scanCorrelationsTool,
  showMetricsTool,
  countErrorsTool,
  getContextTool,
  extractFieldTool,
  patternAnalysisTool,
];

export const handlers: Record<string, (args: any) => Promise<any>> = {
  [searchLogsTool.name]: handleSearchLogs,
  [scanCorrelationsTool.name]: handleScanCorrelations,
  [showMetricsTool.name]: handleShowMetrics,
  [countErrorsTool.name]: handleCountErrors,
  [getContextTool.name]: handleGetContext,
  [extractFieldTool.name]: handleExtractField,
  [patternAnalysisTool.name]: handlePatternAnalysis,
};
