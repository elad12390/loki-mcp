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

This MCP server provides 11 powerful tools for log analysis. AI assistants automatically understand when to use each tool based on your natural language requests.

### Core Tools

**🔍 `loki_search_logs`** - Your primary log search tool
- Just say: "check logs", "find errors", "search for X in logs"
- Searches across ALL services automatically (no config needed!)
- Optional filters by app, environment, service, etc.

**🏢 `loki_list_services`** - Discover what's logging
- Just say: "what services exist", "list services", "what apps do we have"
- Perfect starting point - see what's available before searching

**📊 `loki_count_errors`** - Get numbers and trends
- Just say: "how many errors", "error rate", "are errors increasing"
- Returns charts and statistics instead of raw logs

**🧩 `loki_pattern_analysis`** - Group similar errors
- Just say: "group similar errors", "what error types", "categorize errors"
- Essential for incidents - see if you have 1 problem or 100 different ones

**📡 `loki_tail_logs`** - Real-time monitoring
- Just say: "tail logs", "recent logs", "what's happening now"
- Shows only the last 5 minutes

**🔎 `loki_get_context`** - Root cause analysis
- Just say: "what happened before this error", "show context"
- Shows logs before/after a specific error

### Discovery Tools

**🗺️ `loki_discover_labels`** - See available filters
- Lists all metadata fields you can filter by (app, env, cluster, etc.)

**📋 `loki_get_label_values`** - See filter options
- Shows all values for a specific label (e.g., which apps, which environments)

### Advanced Analysis

**🔗 `loki_scan_correlations`** - Distributed tracing
- Track requests across microservices using correlation IDs

**🎯 `loki_extract_field`** - Data extraction
- Pull out any field and see frequency distribution
- Example: "Which users hit errors?" or "Most common status codes?"

**📈 `loki_show_metrics`** - Usage analytics
- See which tools you use most often

## Usage Tips for AI Assistants

When the user says **"check loki"** or **"look at logs"**, you should:

1. **Start with `loki_list_services`** if you don't know what services exist
2. **Use `loki_search_logs`** as your primary search tool - it works without labels!
3. **Follow up with `loki_get_context`** if you find an interesting error
4. **Use `loki_count_errors`** when they ask "how many"
5. **Use `loki_pattern_analysis`** during incidents to group similar errors

## Example Conversations

**User:** "Check loki for errors in the payment service"
**AI:** *Uses `loki_search_logs` with labels={"app": "payment"}, search_term="error"*

**User:** "How many errors happened today?"
**AI:** *Uses `loki_count_errors` with time_window="24h"*

**User:** "What services are running?"
**AI:** *Uses `loki_list_services`*

**User:** "Group the errors - are they all the same?"
**AI:** *Uses `loki_pattern_analysis`*

## Configuration

Set the following environment variables:
- `LOKI_URL`: URL of your Loki instance (default: `http://localhost:3100`)
- `LOKI_USERNAME`: Basic Auth username (if required)
- `LOKI_PASSWORD`: Basic Auth password (if required)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed information about:
- 🛠️ Development setup
- 🧪 Testing and CI/CD
- 📦 Releasing new versions
- 🚀 Deployment process

```bash
npm install
npm run build
```
