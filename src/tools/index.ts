import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { searchLogsTool, handleSearchLogs } from "./search-logs.js";
import { scanCorrelationsTool, handleScanCorrelations } from "./scan-correlations.js";
import { getContextTool, handleGetContext } from "./get-context.js";
import { patternAnalysisTool, handlePatternAnalysis } from "./pattern-analysis.js";

// Note: discover_labels, get_label_values, and list_services are now MCP Resources
// See src/index.ts for resource definitions (loki://labels, loki://labels/{label}/values, loki://services)

// REMOVED TOOLS (context optimization - Dec 2024):
// - count_errors: merged into search_logs with count=true parameter
// - extract_field: low usage (11 uses), can use search_logs + manual parsing
// - show_metrics: meta tool with only 1 usage ever

export const tools: Tool[] = [
  searchLogsTool,      // Primary search + count mode (merged count_errors)
  scanCorrelationsTool, // Cross-service tracing
  getContextTool,      // Context around specific log
  patternAnalysisTool, // Error pattern grouping
];

export const handlers: Record<string, (args: any) => Promise<any>> = {
  [searchLogsTool.name]: handleSearchLogs,
  [scanCorrelationsTool.name]: handleScanCorrelations,
  [getContextTool.name]: handleGetContext,
  [patternAnalysisTool.name]: handlePatternAnalysis,
};
