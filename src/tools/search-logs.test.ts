import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchLogsTool, handleSearchLogs } from './search-logs.js';

// Mock the loki client
vi.mock('../lib/loki-client.js', () => ({
  lokiClient: {
    searchLogs: vi.fn(),
    queryMetric: vi.fn(),
  }
}));

// Mock metrics
vi.mock('../lib/metrics.js', () => ({
  metrics: {
    trackToolUsage: vi.fn(),
  }
}));

import { lokiClient } from '../lib/loki-client.js';

describe('searchLogsTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(searchLogsTool.name).toBe('loki_search_logs');
    });

    it('should have reasoning as required parameter', () => {
      const schema = searchLogsTool.inputSchema as any;
      expect(schema.required).toContain('reasoning');
    });

    it('should have count parameter', () => {
      const schema = searchLogsTool.inputSchema as any;
      expect(schema.properties).toHaveProperty('count');
      expect(schema.properties.count.type).toBe('boolean');
    });

    it('should have step parameter for count mode', () => {
      const schema = searchLogsTool.inputSchema as any;
      expect(schema.properties).toHaveProperty('step');
    });
  });

  describe('handleSearchLogs - normal mode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return formatted logs when count is false/undefined', async () => {
      const mockLogs = [
        {
          ts: '1704067200000000000',
          line: { message: 'Test error', level: 'error' },
          labels: { app: 'test-app', pod: 'test-pod-1' }
        }
      ];
      
      vi.mocked(lokiClient.searchLogs).mockResolvedValue(mockLogs);

      const result = await handleSearchLogs({
        reasoning: 'Testing search',
        search_term: 'error',
        labels: { app: 'test-app' }
      });

      expect(lokiClient.searchLogs).toHaveBeenCalledWith(expect.objectContaining({
        selector: { app: 'test-app' },
        search: 'error'
      }));
      
      expect(result.content[0].text).toContain('test-app');
    });

    it('should handle empty results', async () => {
      vi.mocked(lokiClient.searchLogs).mockResolvedValue([]);

      const result = await handleSearchLogs({
        reasoning: 'Testing empty',
        search_term: 'nonexistent'
      });

      expect(result.content[0].text).toContain('No logs found');
    });
  });

  describe('handleSearchLogs - count mode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use queryMetric when count=true', async () => {
      const mockMetricResult = [{
        labels: {},
        values: [
          { ts: 1704067200, value: 5 },
          { ts: 1704067260, value: 3 },
          { ts: 1704067320, value: 8 }
        ]
      }];

      vi.mocked(lokiClient.queryMetric).mockResolvedValue(mockMetricResult);

      const result = await handleSearchLogs({
        reasoning: 'Count errors',
        labels: { app: 'payment' },
        search_term: 'error',
        count: true,
        time_window: '1h',
        step: '1m'
      });

      expect(lokiClient.queryMetric).toHaveBeenCalled();
      expect(lokiClient.searchLogs).not.toHaveBeenCalled();
      
      // Should contain count summary
      expect(result.content[0].text).toContain('16'); // 5+3+8 = 16 total
    });

    it('should show peak rate in count mode', async () => {
      const mockMetricResult = [{
        labels: {},
        values: [
          { ts: 1704067200, value: 2 },
          { ts: 1704067260, value: 10 },
          { ts: 1704067320, value: 3 }
        ]
      }];

      vi.mocked(lokiClient.queryMetric).mockResolvedValue(mockMetricResult);

      const result = await handleSearchLogs({
        reasoning: 'Count errors',
        labels: { app: 'test' },
        count: true
      });

      expect(result.content[0].text).toContain('Peak');
      expect(result.content[0].text).toContain('10');
    });

    it('should handle no data in count mode', async () => {
      vi.mocked(lokiClient.queryMetric).mockResolvedValue([]);

      const result = await handleSearchLogs({
        reasoning: 'Count nothing',
        labels: { app: 'test' },
        count: true
      });

      expect(result.content[0].text).toContain('No data');
    });

    it('should default search_term to "error" in count mode', async () => {
      const mockMetricResult = [{
        labels: {},
        values: [{ ts: 1704067200, value: 5 }]
      }];

      vi.mocked(lokiClient.queryMetric).mockResolvedValue(mockMetricResult);

      await handleSearchLogs({
        reasoning: 'Count default errors',
        labels: { app: 'test' },
        count: true
      });

      const call = vi.mocked(lokiClient.queryMetric).mock.calls[0];
      expect(call[0]).toContain('error'); // Query should contain 'error'
    });
  });
});
