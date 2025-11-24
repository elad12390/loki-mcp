# Contributing to Loki MCP

Welcome! This guide covers everything you need to know about developing, testing, and deploying the Loki MCP server.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Releasing New Versions](#releasing-new-versions)
- [Deployment](#deployment)

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.x or 20.x
- npm 9+
- Git
- GitHub CLI (`gh`) for release management

### Clone and Install

```bash
git clone https://github.com/elad12390/loki-mcp.git
cd loki-mcp
npm install
```

### Build the Project

```bash
npm run build
```

This compiles TypeScript to `dist/` and makes the CLI executable.

### Test Locally

```bash
# Run type checking
npm test

# Or run the MCP server directly
node dist/index.js
```

## 📁 Project Structure

```
loki-mcp/
├── .github/
│   └── workflows/          # CI/CD automation
│       ├── ci.yml         # Continuous Integration
│       └── publish.yml    # Auto-publish to npm
├── src/
│   ├── lib/
│   │   ├── loki-client.ts # Loki API client
│   │   └── metrics.ts     # Usage tracking
│   ├── tools/             # MCP tool implementations
│   │   ├── search-logs.ts
│   │   ├── count-errors.ts
│   │   ├── pattern-analysis.ts
│   │   └── ... (11 tools total)
│   ├── config.ts          # Environment configuration
│   └── index.ts           # MCP server entry point
├── package.json
├── tsconfig.json
└── README.md
```

## ✏️ Making Changes

### Adding a New Tool

1. Create a new file in `src/tools/your-tool.ts`
2. Define the tool schema and handler:

```typescript
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { lokiClient } from "../lib/loki-client.js";
import { metrics } from "../lib/metrics.js";

export const yourTool: Tool = {
  name: "loki_your_tool",
  description: "🎯 Use when user asks: 'trigger phrase 1', 'trigger phrase 2'. Clear description of what it does.",
  inputSchema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description: "Explanation of why you are using this tool."
      },
      // ... your parameters
    },
    required: ["reasoning"],
  },
};

export async function handleYourTool(args: any) {
  const { reasoning } = args;
  metrics.trackToolUsage(yourTool.name, reasoning);
  
  // Your implementation here
  
  return {
    content: [{ type: "text", text: "result" }],
  };
}
```

3. Register the tool in `src/tools/index.ts`:

```typescript
import { yourTool, handleYourTool } from "./your-tool.js";

export const tools: Tool[] = [
  // ... existing tools
  yourTool,
];

export const handlers: Record<string, (args: any) => Promise<any>> = {
  // ... existing handlers
  [yourTool.name]: handleYourTool,
};
```

### Tool Description Best Practices

**Make tools discoverable by AI assistants:**

✅ **DO:**
- Start with explicit trigger phrases: "Use when user asks: 'check logs', 'search loki'"
- Use action verbs and natural language patterns
- Explain WHEN to use this tool vs. others
- Include common variations of queries

❌ **DON'T:**
- Write vague descriptions like "A useful tool for logs"
- Assume AI knows when to use the tool
- Use technical jargon without examples

## 🧪 Testing

### Type Checking

```bash
npm test
# or
npm run lint
```

### Manual Testing

1. Build the project: `npm run build`
2. Run locally with test credentials:

```bash
export LOKI_URL="http://localhost:3100"
export LOKI_USERNAME="your-user"
export LOKI_PASSWORD="your-pass"

node dist/index.js
```

3. Test with an MCP client or use the MCP Inspector

## 🚀 CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment.

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Every push to `main` and all pull requests

**What it does:**
- Runs on Node.js 18.x and 20.x (matrix build)
- Installs dependencies
- Builds TypeScript
- Verifies build output

**Status Badge:**
[![CI](https://github.com/elad12390/loki-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/elad12390/loki-mcp/actions/workflows/ci.yml)

### CD Workflow (`.github/workflows/publish.yml`)

**Triggers:** When a version tag is pushed (e.g., `v1.2.0`)

**What it does:**
1. Builds the project
2. Generates changelog from git commits
3. Creates GitHub Release with changelog
4. Publishes to npm automatically

**Required Secrets:**
- `NPM_TOKEN` - Automatically configured via `gh` CLI

## 📦 Releasing New Versions

### Semantic Versioning

We follow [semantic versioning](https://semver.org/):
- **Patch** (1.2.3 → 1.2.4): Bug fixes, minor changes
- **Minor** (1.2.3 → 1.3.0): New features, backward compatible
- **Major** (1.2.3 → 2.0.0): Breaking changes

### Release Process

**1. Make sure you're on main and up to date:**
```bash
git checkout main
git pull
```

**2. Bump the version:**
```bash
# For bug fixes
npm version patch

# For new features
npm version minor

# For breaking changes
npm version major
```

This creates a git commit and tag automatically.

**3. Push with tags:**
```bash
git push && git push --tags
```

**4. The CI/CD automatically:**
- ✅ Runs tests
- ✅ Builds the package
- ✅ Generates changelog from commits since last version
- ✅ Creates GitHub Release: https://github.com/elad12390/loki-mcp/releases
- ✅ Publishes to npm: https://www.npmjs.com/package/@elad12390/loki-mcp
- ✅ All in ~30 seconds!

### What Makes a Good Release

**Good commit messages = Good changelogs**

Since changelogs are auto-generated from commits, write clear commit messages:

✅ **Good:**
- `Add pattern analysis tool for grouping similar errors`
- `Fix timestamp parsing in get-context tool`
- `Improve search-logs description for better AI discovery`

❌ **Bad:**
- `update`
- `fix bug`
- `changes`

### Release Checklist

Before releasing:
- [ ] All CI tests passing
- [ ] README updated if needed
- [ ] Breaking changes documented
- [ ] Version number follows semver

## 🌐 Deployment

### NPM Package

The package is published to npm as `@elad12390/loki-mcp`.

**Automatic deployment:**
- Happens automatically when you push a version tag
- Managed by `.github/workflows/publish.yml`
- Uses `NPM_TOKEN` secret for authentication

**Manual deployment (not recommended):**
```bash
npm run build
npm publish
```

### GitHub Releases

Releases are automatically created at: https://github.com/elad12390/loki-mcp/releases

Each release includes:
- 📝 Auto-generated changelog from commits
- 🔗 Links to full diff
- 📦 npm package link
- ⏰ Timestamp and version info

### Monitoring Deployments

**Check CI/CD status:**
```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Open in browser
gh run view <run-id> --web
```

**View releases:**
```bash
# List releases
gh release list

# View specific release
gh release view v1.2.0

# Open release in browser
gh release view v1.2.0 --web
```

**Check npm:**
```bash
# View published version
npm view @elad12390/loki-mcp version

# View full package info
npm view @elad12390/loki-mcp
```

## 🔧 Troubleshooting

### Build Fails in CI

- Check TypeScript errors: `npm run build`
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

### Publish Fails

- Check NPM_TOKEN secret is set: `gh secret list`
- Verify package version doesn't already exist on npm
- Check npm registry status: https://status.npmjs.org/

### Release Not Created

- Verify tag was pushed: `git tag -l`
- Check workflow permissions in `.github/workflows/publish.yml`
- View workflow logs: `gh run view --log`

## 📞 Getting Help

- **Issues:** https://github.com/elad12390/loki-mcp/issues
- **Discussions:** https://github.com/elad12390/loki-mcp/discussions
- **CI/CD Logs:** https://github.com/elad12390/loki-mcp/actions

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.
