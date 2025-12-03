import { Prompt } from "@modelcontextprotocol/sdk/types.js";

export const prompts: Prompt[] = [
  {
    name: "debug-error",
    description: "Guided workflow to debug an error in production. Searches for the error, gets surrounding context, and checks if it's a recurring pattern.",
    arguments: [
      {
        name: "error_text",
        description: "The error message or text to search for",
        required: true
      },
      {
        name: "service",
        description: "Optional: specific service/app to search in",
        required: false
      },
      {
        name: "time_window",
        description: "How far back to search (default: 1h)",
        required: false
      }
    ]
  },
  {
    name: "trace-request",
    description: "Follow a request across all services using its trace/correlation ID. Shows the complete journey of a request through your distributed system.",
    arguments: [
      {
        name: "trace_id",
        description: "The trace ID, correlation ID, or request ID to follow",
        required: true
      },
      {
        name: "time_window",
        description: "How far back to search (default: 1h)",
        required: false
      }
    ]
  },
  {
    name: "health-check",
    description: "Quick production health check. Lists services, counts recent errors, and identifies any error patterns.",
    arguments: [
      {
        name: "service",
        description: "Optional: focus on a specific service",
        required: false
      },
      {
        name: "time_window",
        description: "Time window to check (default: 1h)",
        required: false
      }
    ]
  }
];

export function getPromptMessages(name: string, args: Record<string, string>): { role: string; content: string }[] {
  switch (name) {
    case "debug-error":
      return getDebugErrorMessages(args);
    case "trace-request":
      return getTraceRequestMessages(args);
    case "health-check":
      return getHealthCheckMessages(args);
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

function getDebugErrorMessages(args: Record<string, string>): { role: string; content: string }[] {
  const { error_text, service, time_window = "1h" } = args;
  
  let serviceFilter = service ? `in the "${service}" service` : "across all services";
  
  return [
    {
      role: "user",
      content: `Debug this error ${serviceFilter}: "${error_text}"

Follow this workflow:

1. **Search for the error** using \`loki_search_logs\`:
   - search_term: "${error_text}"
   ${service ? `- labels: {"app": "${service}"} or {"k8s_container_name": "${service}"}` : "- No labels needed (searches all services)"}
   - time_window: "${time_window}"
   - limit: 20

2. **Get context** around the first error you find using \`loki_get_context\`:
   - Use the timestamp and labels from step 1
   - direction: "both" to see what happened before AND after

3. **Check if it's a pattern** using \`loki_pattern_analysis\`:
   - Same search_term and labels
   - This tells us if it's one error or many similar ones

4. **Summarize findings**:
   - How many times did this error occur?
   - What happened right before the error?
   - Is it a recurring pattern or a one-off?
   - What's the likely root cause?`
    }
  ];
}

function getTraceRequestMessages(args: Record<string, string>): { role: string; content: string }[] {
  const { trace_id, time_window = "1h" } = args;
  
  return [
    {
      role: "user",
      content: `Trace this request across all services: ${trace_id}

Follow this workflow:

1. **Find all logs for this trace** using \`loki_scan_correlations\`:
   - trace_id: "${trace_id}"
   - time_window: "${time_window}"
   - This shows all services touched and the timeline

2. **If you find errors or interesting points**, use \`loki_get_context\` to see surrounding logs

3. **Summarize the request flow**:
   - Which services did the request pass through?
   - What operations were performed?
   - Did any errors occur?
   - How long did each step take (if timing info available)?
   - Where did the request originate and where did it end?`
    }
  ];
}

function getHealthCheckMessages(args: Record<string, string>): { role: string; content: string }[] {
  const { service, time_window = "1h" } = args;
  
  let serviceScope = service ? `for "${service}"` : "across all services";
  
  return [
    {
      role: "user",
      content: `Run a production health check ${serviceScope}.

Follow this workflow:

1. ${!service ? `**List available services** by reading the \`loki://services\` resource to see what's running\n\n2. ` : ""}**Count errors** using \`loki_count_errors\`:
   ${service ? `- labels: {"app": "${service}"} or {"k8s_container_name": "${service}"}` : "- No labels (check all services)"}
   - time_window: "${time_window}"
   - This shows error rate over time

${!service ? "3" : "2"}. **If errors found, analyze patterns** using \`loki_pattern_analysis\`:
   - Same filters as above
   - Groups similar errors together
   - Helps identify if it's one problem or many

${!service ? "4" : "3"}. **Summarize health status**:
   - Overall error count and trend (increasing/decreasing?)
   - Top error types if any
   - Which services are healthy vs problematic
   - Recommended actions if issues found`
    }
  ];
}
