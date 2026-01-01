import { describe, it, expect } from 'vitest';
import { tools, handlers } from './index.js';

describe('tools registry', () => {
  describe('tool count optimization', () => {
    it('should have exactly 4 tools (reduced from 7)', () => {
      // We removed: count_errors (merged), extract_field (low usage), show_metrics (1 use)
      // Kept: search_logs, scan_correlations, get_context, pattern_analysis
      expect(tools.length).toBe(4);
    });

    it('should have handlers for all registered tools', () => {
      for (const tool of tools) {
        expect(handlers[tool.name]).toBeDefined();
        expect(typeof handlers[tool.name]).toBe('function');
      }
    });
  });

  describe('removed tools should not exist', () => {
    it('should NOT have loki_count_errors tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).not.toContain('loki_count_errors');
    });

    it('should NOT have loki_extract_field tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).not.toContain('loki_extract_field');
    });

    it('should NOT have loki_show_metrics tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).not.toContain('loki_show_metrics');
    });
  });

  describe('kept tools should exist', () => {
    it('should have loki_search_logs tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('loki_search_logs');
    });

    it('should have loki_scan_correlations tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('loki_scan_correlations');
    });

    it('should have loki_get_context tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('loki_get_context');
    });

    it('should have loki_pattern_analysis tool', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('loki_pattern_analysis');
    });
  });

  describe('search_logs should have count capability', () => {
    it('should have count parameter in search_logs schema', () => {
      const searchTool = tools.find(t => t.name === 'loki_search_logs');
      expect(searchTool).toBeDefined();
      
      const schema = searchTool!.inputSchema as any;
      expect(schema.properties).toHaveProperty('count');
      expect(schema.properties.count.type).toBe('boolean');
    });

    it('should have step parameter in search_logs schema', () => {
      const searchTool = tools.find(t => t.name === 'loki_search_logs');
      expect(searchTool).toBeDefined();
      
      const schema = searchTool!.inputSchema as any;
      expect(schema.properties).toHaveProperty('step');
    });
  });
});
