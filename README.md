# Loki MCP Server

An [MCP](https://github.com/modelcontextprotocol/protocol) server to easily search and retrieve logs from Grafana Loki without needing to write complex LogQL queries.

## Quick Start

You can run this server directly using `npx`:

```bash
export LOKI_USERNAME="your-username"
export LOKI_PASSWORD="your-password"
# LOKI_URL defaults to https://prod-us-east-loki.solaraaidev.com, override if needed:
# export LOKI_URL="https://your-loki-instance.com"

npx @elad12390/loki-mcp
```

## Features

### `loki_search_logs`
The main tool for agents. It provides an "Easy Mode" search.

**Parameters:**
- `labels`: (Required) Key-value pairs to identify the app/service. e.g. `{"app": "payment", "env": "prod"}`.
- `search_term`: (Optional) Text to grep for. e.g. `"error"` or `"Connection refused"`.
- `time_window`: (Optional) How far back to look. e.g. `"1h"`, `"30m"`. Default: `"1h"`.
- `limit`: (Optional) Max lines. Default: `100`.

**Example Usage by Agent:**
"Find me errors in the payment app from the last hour."
-> `loki_search_logs(labels={"app": "payment"}, search_term="error", time_window="1h")`

### `loki_discover_labels`
Lists all available metadata keys (labels) in Loki. Use this if you don't know what fields exist (e.g. `cluster`, `namespace`, `pod`).

### `loki_get_label_values`
Lists all values for a given label. Use this to find the exact name of an app or environment.
e.g. `loki_get_label_values(label="app")` -> `["frontend", "backend", "payment"]`

## Configuration

Set the following environment variables:
- `LOKI_URL`: URL of your Loki instance (default: `https://prod-us-east-loki.solaraaidev.com`)
- `LOKI_USERNAME`: Basic Auth username (if required)
- `LOKI_PASSWORD`: Basic Auth password (if required)

## Development

```bash
npm install
npm run build
```
