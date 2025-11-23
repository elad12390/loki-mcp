# Roadmap & Usage Frequency Analysis

Based on the [Comprehensive Guide](./01-COMPREHENSIVE-GUIDE.md) and common observability workflows, here is a prioritized list of tasks/features for the Loki MCP server, rated by estimated daily usage frequency.

## 🟢 Tier 1: High Frequency (Daily Usage)
*Essential tools for active debugging, incident response, and "checking the pulse" of the system.*

### 1. `loki_get_context` (Context Drilldown)
**Usage:** ⭐⭐⭐⭐⭐
**Description:** When a specific error log is found, users almost always need to see what happened *immediately before* and *after* that line to understand the root cause.
**Implementation:** Fetch `N` lines surrounding a specific timestamp or log entry ID within the same stream.
**Why:** Directly maps to the "Live tail + Logs Drilldown exploration" workflow.

### 2. `loki_tail_logs` (Live Monitoring)
**Usage:** ⭐⭐⭐⭐⭐
**Description:** "I just deployed a fix, show me the logs coming in *right now*."
**Implementation:** A simplified wrapper around search that defaults to the last 1-5 minutes and refreshes easily.
**Why:** Replaces the need to open a terminal to run `CLI tail` during active development.

### 3. `loki_count_errors` (Metric Queries)
**Usage:** ⭐⭐⭐⭐
**Description:** "How many errors happened in the last hour?" or "Is the error rate increasing?"
**Implementation:** Utilize LogQL metric queries (e.g., `count_over_time`, `rate`) to return numbers/graphs instead of raw log lines.
**Why:** LLMs are bad at counting thousands of raw log lines. Offloading this to Loki's engine is much more efficient and accurate for "Metrics-first detection".

---

## 🟡 Tier 2: Medium Frequency (Weekly/Deep Analysis)
*Tools for complex forensics, pattern matching, and data extraction.*

### 4. `loki_extract_field` (Structured Data Analysis)
**Usage:** ⭐⭐⭐
**Description:** "Give me a list of all unique `user_id`s that experienced a timeout."
**Implementation:** Use LogQL line formats (`| json`, `| logfmt`) to extract a specific JSON field and return unique values or frequency distribution.
**Why:** Support for "Business/analytics extraction" mentioned in the guide.

### 5. `loki_pattern_analysis` (Log Clustering)
**Usage:** ⭐⭐⭐
**Description:** "Group these 10,000 logs into unique error patterns."
**Implementation:** Use Loki's `pattern` parser to group similar log lines (ignoring dynamic IDs) and show the most common templates.
**Why:** Helps with "Incident forensics" by reducing noise and identifying new vs. recurring issues.

---

## 🔴 Tier 3: Low Frequency (Setup & Optimization)
*Administrative tasks and health checks.*

### 6. `loki_check_cardinality` (Label Health)
**Usage:** ⭐⭐
**Description:** Analyze label usage to warn about high-cardinality issues (e.g., putting `user_id` in a label).
**Implementation:** Query `index_stats` or analyze label value counts.
**Why:** Directly addresses "Label design and cardinality" best practices, preventing performance degradation.

### 7. `loki_verify_ingestion` (Pipeline Health)
**Usage:** ⭐
**Description:** Check if logs are being dropped or if timestamps are out of order.
**Implementation:** Query internal Loki metrics or look for common ingestion errors.
**Why:** Ensures "Ingestion and reliability".
