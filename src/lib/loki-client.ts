import axios from "axios";
import { config } from "../config.js";

// Simple time parser (e.g. "1h" -> ns)
function parseDurationToNs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
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

  async searchLogs(params: {
    selector?: Record<string, string>;
    search?: string;
    limit?: number;
    startAgo?: string;
  }) {
    const { selector = {}, search, limit = 100, startAgo = "1h" } = params;

    const selectorParts = Object.entries(selector).map(([k, v]) => `${k}="${v}"`);
    let query = selectorParts.length > 0 ? `{${selectorParts.join(", ")}}` : '{job=~".+"}';

    if (search) {
      query += ` |= "${search}"`;
    }

    const now = Date.now() * 1e6; // ms to ns
    const startNs = now - parseDurationToNs(startAgo);

    console.error(`Executing LogQL: ${query}`);

    try {
      const res = await this.client.get('/loki/api/v1/query_range', {
        params: {
          query,
          start: startNs,
          limit,
          direction: 'BACKWARD'
        }
      });
      
      const resultType = res.data.data.resultType;
      const result = res.data.data.result;

      if (resultType === 'streams') {
        return result.flatMap((stream: any) => {
          const labels = stream.stream;
          return stream.values.map((v: any) => ({
            ts: v[0],
            line: v[1],
            labels
          }));
        });
      }
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
