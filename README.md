# Second-Order Thinking MCP

A Model Context Protocol server that gives Claude structured **second-order thinking** tools —
mapping not just *what happens next* but *what happens after that*, including blind spots
your first-order analysis will miss.

## Why Second-Order Thinking?

First-order: *"Cutting costs saves money."*
Second-order: *"…morale drops, top performers leave, replacement costs exceed the savings,
and 18 months later you're worse off."*

## Tools

| Tool | Purpose |
|------|---------|
| `analyze_decision` | Full first + second-order consequence tree, systemic risks, recommendations |
| `compare_decisions` | Side-by-side second-order risk comparison of two options |
| `probe_blind_spots` | Stress-test for effects invisible to normal analysis |
| `invert_decision` | Munger inversion: how to guarantee failure → prevention map |

## 8 Consequence Dimensions

Economic · Social · Psychological · Systemic · Temporal · Political · Technological · Environmental

## Installation

```bash
npm install
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "second-order-thinking": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/second-order-thinking-mcp/src/server.js"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add second-order-thinking node /ABSOLUTE/PATH/TO/second-order-thinking-mcp/src/server.js
```

## Example Prompts

```
Analyse the second-order consequences of reducing engineering headcount by 30%.

Compare: (A) build in-house vs (B) acquire a startup — second-order view.

Probe the blind spots in migrating all infra to a single cloud provider.

Invert our freemium strategy — show me exactly how it fails.
```

## Parameters (analyze_decision)

| Param | Default | Notes |
|-------|---------|-------|
| `decision` | required | Be specific |
| `context` | optional | Industry, size, constraints |
| `stakeholders` | `[]` | e.g. `["employees","customers"]` |
| `timeHorizon` | `"medium"` | immediate/near/medium/long |
| `dimensions` | all 8 | Filter to specific domains |
| `depth` | `2` | 1=first-order, 2=full analysis |
| `format` | `"full"` | full report or quick top-3 scan |
