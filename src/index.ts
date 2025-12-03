#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { tools, handlers } from "./tools/index.js";
import { prompts, getPromptMessages } from "./prompts/index.js";
import { lokiClient } from "./lib/loki-client.js";

const server = new McpServer(
  {
    name: "loki-mcp",
    version: "1.3.0",
  }
);

// Register all tools from tools/index.ts
for (const tool of tools) {
  const handler = handlers[tool.name];
  if (handler) {
    // Convert JSON schema properties to Zod schema
    const properties = (tool.inputSchema as any).properties || {};
    const zodSchema: Record<string, z.ZodTypeAny> = {};
    
    for (const [key, prop] of Object.entries(properties)) {
      const p = prop as any;
      let zodType: z.ZodTypeAny;
      
      if (p.type === "string") {
        zodType = z.string().describe(p.description || "");
      } else if (p.type === "number") {
        zodType = z.number().describe(p.description || "");
      } else if (p.type === "object") {
        zodType = z.record(z.string()).describe(p.description || "");
      } else if (p.type === "array") {
        zodType = z.array(z.string()).describe(p.description || "");
      } else {
        zodType = z.any().describe(p.description || "");
      }
      
      // Make optional if not in required array
      const required = (tool.inputSchema as any).required || [];
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }
      
      zodSchema[key] = zodType;
    }
    
    server.tool(
      tool.name,
      tool.description || "",
      zodSchema,
      async (args) => {
        try {
          return await handler(args);
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      }
    );
  }
}

// Register prompts
for (const prompt of prompts) {
  const argsSchema: Record<string, z.ZodTypeAny> = {};
  
  for (const arg of prompt.arguments || []) {
    let zodType: z.ZodTypeAny = z.string().describe(arg.description || "");
    if (!arg.required) {
      zodType = zodType.optional();
    }
    argsSchema[arg.name] = zodType;
  }
  
  server.prompt(
    prompt.name,
    prompt.description || "",
    argsSchema,
    (args) => {
      const messages = getPromptMessages(prompt.name, args as Record<string, string>);
      return {
        messages: messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: { type: "text" as const, text: m.content }
        }))
      };
    }
  );
}

// Register resources

// Static resource: loki://services
server.resource(
  "services",
  "loki://services",
  {
    description: "List of all services/apps currently logging to Loki",
    mimeType: "application/json"
  },
  async () => {
    const candidates = ["service_name", "app", "service", "application", "k8s_container_name"];
    const allLabels = await lokiClient.getLabels();
    const label = candidates.find(c => allLabels.includes(c));
    
    if (!label) {
      return {
        contents: [{
          uri: "loki://services",
          mimeType: "application/json",
          text: JSON.stringify({
            error: "No standard service label found",
            available_labels: allLabels,
            hint: "Try reading loki://labels to see available label keys"
          }, null, 2)
        }]
      };
    }
    
    const values = await lokiClient.getLabelValues(label);
    
    return {
      contents: [{
        uri: "loki://services",
        mimeType: "application/json",
        text: JSON.stringify({
          label_used: label,
          services: values,
          count: values.length,
          hint: `Use {"${label}": "service_name"} in your search labels`
        }, null, 2)
      }]
    };
  }
);

// Static resource: loki://labels
server.resource(
  "labels",
  "loki://labels",
  {
    description: "All label keys (metadata fields) available in Loki",
    mimeType: "application/json"
  },
  async () => {
    const labels = await lokiClient.getLabels();
    
    return {
      contents: [{
        uri: "loki://labels",
        mimeType: "application/json",
        text: JSON.stringify({
          labels: labels,
          count: labels.length,
          hint: "Read loki://labels/{label_name}/values to see values for a specific label"
        }, null, 2)
      }]
    };
  }
);

// Dynamic resource template: loki://labels/{label}/values
server.resource(
  "label-values",
  new ResourceTemplate("loki://labels/{label}/values", { list: undefined }),
  {
    description: "Get all values for a specific label (e.g., loki://labels/app/values)",
    mimeType: "application/json"
  },
  async (uri, params) => {
    const label = params.label as string;
    const values = await lokiClient.getLabelValues(label);
    
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          label: label,
          values: values,
          count: values.length,
          hint: `Use {"${label}": "value"} in your search labels`
        }, null, 2)
      }]
    };
  }
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Loki MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
