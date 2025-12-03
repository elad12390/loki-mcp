import axios from "axios";
import { config } from "../config.js";

// Simple time parser (e.g. "1h" -> ns)
function parseDurationToNs(duration: string): number {
  // Allow negative durations like "-6h" by stripping the minus
  const cleanDuration = duration.replace(/^-/, '');
  const match = cleanDuration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error("Invalid duration format. Use 1s, 5m, 1h, 24h, etc.");
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const second = 1e9;
  switch (unit) {
    case 's': return value * second;
    case 'm': return value * 60 * second;
    case 'h': return value * 3600 * second;
    case 'd': return value * 86400 * second;
    default: return 0;
  }
}

function tryParseJson(str: string): any {
    try {
        return JSON.parse(str);
    } catch (e) {
        return str;
    }
}

export class LokiClient {
  private client: any; // Using any to avoid axios type issues for now, or could fix types

  constructor() {
    const headers: Record<string, string> = {};
    if (config.lokiUsername && config.lokiPassword) {
      const auth = Buffer.from(`${config.lokiUsername}:${config.lokiPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    this.client = axios.create({
      baseURL: config.lokiUrl,
      headers,
    });
  }

  async getLabels() {
    const res = await this.client.get('/loki/api/v1/labels');
    return res.data.data;
  }

  async getLabelValues(label: string) {
    const res = await this.client.get(`/loki/api/v1/label/${label}/values`);
    return res.data.data;
  }

  private cachedDefaultSelector: string | null = null;

  async getDefaultSelector(): Promise<string> {
    if (this.cachedDefaultSelector) return this.cachedDefaultSelector;

    try {
      const labels = await this.getLabels();
      // Common high-cardinality/service-identifying labels
      const priorities = ['app', 'service', 'service_name', 'job', 'application', 'container', 'component'];
      
      for (const p of priorities) {
        if (labels.includes(p)) {
          this.cachedDefaultSelector = `{${p}=~".+"}`;
          return this.cachedDefaultSelector;
        }
      }
      
      // Fallback: pick the first available label if any exist
      if (labels && labels.length > 0) {
         this.cachedDefaultSelector = `{${labels[0]}=~".+"}`;
         return this.cachedDefaultSelector;
      }
    } catch (e) {
      console.error("Failed to fetch labels for default selector auto-detection:", e);
    }
    
    // Ultimate fallback
    return '{job=~".+"}';
  }

  async searchLogs(params: {
    selector?: Record<string, string>;
    search?: string;
    limit?: number;
    startAgo?: string;
    start?: string; // Optional start timestamp (ns) override
    end?: string; // Optional end timestamp (ns) for pagination
    direction?: "BACKWARD" | "FORWARD";
  }) {
    const { selector = {}, search, limit = 100, startAgo = "1h", end, direction = "BACKWARD", start } = params;

    let queryPart = "";
    if (Object.keys(selector).length > 0) {
      const selectorParts = Object.entries(selector).map(([k, v]) => `${k}="${v}"`);
      queryPart = `{${selectorParts.join(", ")}}`;
    } else {
      queryPart = await this.getDefaultSelector();
    }

    let query = queryPart;
    if (search) {
      query += ` |= "${search}"`;
    }

    const now = Date.now() * 1e6; // ms to ns
    let startNs = now - parseDurationToNs(startAgo);
    
    // Explicit start overrides startAgo
    if (start) {
        startNs = parseInt(start);
    }
    
    // If 'end' is provided, use it. Otherwise, default to 'now' (implicit in Loki if omitted, but we can be explicit if we want)
    // We don't default end to now here because we want to pass it through if provided
    
    console.error(`Executing LogQL: ${query}`);

    try {
      const res = await this.client.get('/loki/api/v1/query_range', {
        params: {
          query,
          start: startNs,
          end: end, // Axios filters undefined values automatically
          limit,
          direction
        }
      });
      
      const resultType = res.data.data.resultType;
      const result = res.data.data.result;

      if (resultType === 'streams') {
        // Flatten all streams into a single array
        const allLogs = result.flatMap((stream: any) => {
          const labels = stream.stream;
          return stream.values.map((v: any) => ({
            ts: v[0],
            line: tryParseJson(v[1]),
            labels
          }));
        });
        
        // Sort by timestamp (descending for BACKWARD, ascending for FORWARD)
        // This ensures logs from different pods are interleaved by time
        allLogs.sort((a: any, b: any) => {
          const tsA = BigInt(a.ts);
          const tsB = BigInt(b.ts);
          if (direction === "BACKWARD") {
            return tsB > tsA ? 1 : tsB < tsA ? -1 : 0;
          } else {
            return tsA > tsB ? 1 : tsA < tsB ? -1 : 0;
          }
        });
        
        // Apply limit after sorting to get the most relevant logs across all pods
        return allLogs.slice(0, limit);
      }
      return result;
    } catch (error: any) {
      if ((axios as any).isAxiosError(error)) {
        throw new Error(`Loki API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  async queryMetric(query: string, startAgo: string = "1h", step: string = "60s") {
    const now = Date.now() * 1e6;
    const startNs = now - parseDurationToNs(startAgo);
    
    // Step is expected in seconds (usually) or duration string by Loki? 
    // Loki API expects 'step' in seconds or duration string (e.g. '1m').
    
    console.error(`Executing Metric LogQL: ${query}`);

    try {
      const res = await this.client.get('/loki/api/v1/query_range', {
        params: {
          query,
          start: startNs,
          limit: 1000,
          step: step 
        }
      });
      
      const resultType = res.data.data.resultType;
      const result = res.data.data.result;

      if (resultType === 'matrix') {
        // Format: [{ metric: { labels... }, values: [[ts, val], ...] }]
        return result.map((series: any) => ({
          labels: series.metric,
          values: series.values.map((v: any) => ({
            ts: v[0],
            value: parseFloat(v[1])
          }))
        }));
      }
      
      // Fallback if they ran a non-metric query by mistake
      return result;

    } catch (error: any) {
      if ((axios as any).isAxiosError(error)) {
        throw new Error(`Loki API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }
}

export const lokiClient = new LokiClient();
