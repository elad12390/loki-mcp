# Loki MCP Server

An [MCP](https://github.com/modelcontextprotocol/protocol) server to easily search and retrieve logs from Grafana Loki without needing to write complex LogQL queries.

## Quick Start

You can run this server directly using `npx`:

```bash
export LOKI_USERNAME="your-username"
export LOKI_PASSWORD="your-password"
export LOKI_URL="https://your-loki-instance.com"

npx @elad12390/loki-mcp
```

## Features

This MCP server provides **7 tools**, **3 resources**, and **3 prompts** for log analysis. AI assistants automatically understand when to use each based on your natural language requests.

### Tools

**🔍 `loki_search_logs`** - Your primary log search tool
- Just say: "check logs", "find errors", "search for X in logs"
- Searches across ALL services automatically (no config needed!)
- Optional filters by app, environment, service, etc.

**📊 `loki_count_errors`** - Get numbers and trends
- Just say: "how many errors", "error rate", "are errors increasing"
- Returns charts and statistics instead of raw logs

**🧩 `loki_pattern_analysis`** - Group similar errors
- Just say: "group similar errors", "what error types", "categorize errors"
- Essential for incidents - see if you have 1 problem or 100 different ones

**🔎 `loki_get_context`** - Root cause analysis
- Just say: "what happened before this error", "show context"
- Shows logs before/after a specific error

**🔗 `loki_scan_correlations`** - Distributed tracing
- Just say: "trace this ID", "find all logs for trace X", "follow this UUID across services"
- Track requests across microservices using trace/correlation IDs

**🎯 `loki_extract_field`** - Data extraction
- Pull out any field and see frequency distribution
- Example: "Which users hit errors?" or "Most common status codes?"

**📈 `loki_show_metrics`** - Usage analytics
- See which tools you use most often

### Resources (Read-only Data)

Resources provide discoverable data that AI assistants can read:

**`loki://services`** - List all services/apps logging to Loki
- Read this first to know what's available

**`loki://labels`** - List all label keys (metadata fields)
- Shows what you can filter by (app, env, namespace, etc.)

**`loki://labels/{label}/values`** - Get values for a specific label
- Example: `loki://labels/app/values` shows all app names

### Prompts (Guided Workflows)

Prompts are pre-built workflows for common debugging scenarios:

**`debug-error`** - Guided error debugging
- Searches for the error, gets context, checks patterns
- Arguments: `error_text` (required), `service`, `time_window`

**`trace-request`** - Follow a request across services
- Traces a correlation/trace ID through your distributed system
- Arguments: `trace_id` (required), `time_window`

**`health-check`** - Quick production health check
- Lists services, counts errors, identifies patterns
- Arguments: `service`, `time_window`

## Usage Tips for AI Assistants

When the user says **"check loki"** or **"look at logs"**, you should:

1. **Read `loki://services`** resource if you don't know what services exist
2. **Use `loki_search_logs`** as your primary search tool - it works without labels!
3. **Follow up with `loki_get_context`** if you find an interesting error
4. **Use `loki_count_errors`** when they ask "how many"
5. **Use `loki_pattern_analysis`** during incidents to group similar errors

For complex debugging, use the **prompts**:
- "Debug this error" -> Use `debug-error` prompt
- "Trace this request ID" -> Use `trace-request` prompt
- "Is production healthy?" -> Use `health-check` prompt

## Example Conversations

**User:** "Check loki for errors in the payment service"
**AI:** *Uses `loki_search_logs` with labels={"app": "payment"}, search_term="error"*

**User:** "How many errors happened today?"
**AI:** *Uses `loki_count_errors` with time_window="24h"*

**User:** "What services are running?"
**AI:** *Reads `loki://services` resource*

**User:** "Debug this error: connection timeout"
**AI:** *Uses `debug-error` prompt with error_text="connection timeout"*

**User:** "Trace request abc-123-def across all services"
**AI:** *Uses `trace-request` prompt with trace_id="abc-123-def"*

## Configuration

Set the following environment variables:
- `LOKI_URL`: URL of your Loki instance (default: `http://localhost:3100`)
- `LOKI_USERNAME`: Basic Auth username (if required)
- `LOKI_PASSWORD`: Basic Auth password (if required)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed information about:
- Development setup
- Testing and CI/CD
- Releasing new versions
- Deployment process

```bash
npm install
npm run build
```
