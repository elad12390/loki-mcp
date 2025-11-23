import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { discoverLabelsTool, handleDiscoverLabels } from "./discover-labels.js";
import { getLabelValuesTool, handleGetLabelValues } from "./get-label-values.js";
import { searchLogsTool, handleSearchLogs } from "./search-logs.js";
import { listServicesTool, handleListServices } from "./list-services.js";
import { scanCorrelationsTool, handleScanCorrelations } from "./scan-correlations.js";
import { showMetricsTool, handleShowMetrics } from "./show-metrics.js";
import { countErrorsTool, handleCountErrors } from "./count-errors.js";
import { getContextTool, handleGetContext } from "./get-context.js";
import { tailLogsTool, handleTailLogs } from "./tail-logs.js";
import { extractFieldTool, handleExtractField } from "./extract-field.js";
import { patternAnalysisTool, handlePatternAnalysis } from "./pattern-analysis.js";

export const tools: Tool[] = [
  discoverLabelsTool,
  getLabelValuesTool,
  searchLogsTool,
  listServicesTool,
  scanCorrelationsTool,
  showMetricsTool,
  countErrorsTool,
  getContextTool,
  tailLogsTool,
  extractFieldTool,
  patternAnalysisTool,
];

export const handlers: Record<string, (args: any) => Promise<any>> = {
  [discoverLabelsTool.name]: handleDiscoverLabels,
  [getLabelValuesTool.name]: handleGetLabelValues,
  [searchLogsTool.name]: handleSearchLogs,
  [listServicesTool.name]: handleListServices,
  [scanCorrelationsTool.name]: handleScanCorrelations,
  [showMetricsTool.name]: handleShowMetrics,
  [countErrorsTool.name]: handleCountErrors,
  [getContextTool.name]: handleGetContext,
  [tailLogsTool.name]: handleTailLogs,
  [extractFieldTool.name]: handleExtractField,
  [patternAnalysisTool.name]: handlePatternAnalysis,
};
