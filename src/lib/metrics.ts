import fs from 'fs';
import path from 'path';
import os from 'os';

interface ToolMetrics {
  count: number;
  lastUsed: string;
  usages: { timestamp: string; reasoning: string }[];
}

interface MetricsData {
  tools: Record<string, ToolMetrics>;
}

export class MetricsManager {
  private metricsPath: string;

  constructor() {
    // Store in user's home directory to persist across npx runs
    this.metricsPath = path.join(os.homedir(), '.loki-mcp-metrics.json');
  }

  private loadMetrics(): MetricsData {
    try {
      if (fs.existsSync(this.metricsPath)) {
        const data = fs.readFileSync(this.metricsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
    return { tools: {} };
  }

  private saveMetrics(data: MetricsData) {
    try {
      fs.writeFileSync(this.metricsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  public trackToolUsage(toolName: string, reasoning: string) {
    const data = this.loadMetrics();
    
    if (!data.tools[toolName]) {
      data.tools[toolName] = { count: 0, lastUsed: '', usages: [] };
    }

    const toolMetric = data.tools[toolName];
    toolMetric.count += 1;
    toolMetric.lastUsed = new Date().toISOString();
    
    // Keep last 20 reasonings to avoid infinite file growth
    toolMetric.usages.unshift({
      timestamp: new Date().toISOString(),
      reasoning
    });
    
    if (toolMetric.usages.length > 20) {
      toolMetric.usages = toolMetric.usages.slice(0, 20);
    }

    this.saveMetrics(data);
  }

  public getMetrics(): MetricsData {
    return this.loadMetrics();
  }
}

export const metrics = new MetricsManager();
