# NAVI Usage Examples

This document provides practical examples of using the NAVI MCP Codebase Navigator.

## Basic Tree Generation

### Simple Directory Tree
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src"}}}' | npm start
```

### Tree with File Sizes
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","showSizes":true}}}' | npm start
```

### Limited Depth Tree
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","maxDepth":2}}}' | npm start
```

### Filter by Extensions
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","extensions":["ts","js"]}}}' | npm start
```

### Include Hidden Files
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","includeHidden":true}}}' | npm start
```

### Exclude Patterns
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","excludePatterns":["node_modules","*.test.ts"]}}}' | npm start
```

## Dependency Analysis (Placeholder)

### Basic Dependency Analysis
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-dependencies","arguments":{"path":"./src"}}}' | npm start
```

### Language-Specific Analysis
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-dependencies","arguments":{"path":"./src","languages":["typescript","javascript"]}}}' | npm start
```

## Semantic Search (Placeholder)

### Basic Search
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"semantic-search","arguments":{"query":"authentication","path":"./src"}}}' | npm start
```

### Fuzzy Search
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"semantic-search","arguments":{"query":"auth","path":"./src","searchType":"fuzzy"}}}' | npm start
```

## Authentication Discovery (Placeholder)

### Find Authentication Logic
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find-auth","arguments":{"path":"./src"}}}' | npm start
```

### Framework-Specific Search
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find-auth","arguments":{"path":"./src","frameworks":["express","fastapi"],"minConfidence":0.8}}}' | npm start
```

## Graph Visualization (Placeholder)

### ASCII Graph
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"visualize-graph","arguments":{"dependencyData":"{}","format":"ascii"}}}' | npm start
```

## Testing the Server

### List Available Tools
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start
```

### Test Server Connectivity
```bash
npm run test:mcp
```

## Integration with MCP Clients

### Claude Desktop Configuration
Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "navi": {
      "command": "node",
      "args": ["/path/to/NAVI/dist/index.js"],
      "env": {}
    }
  }
}
```

### VS Code Integration
Use with MCP-compatible VS Code extensions by configuring the server path.

## Common Use Cases

### 1. Project Overview
Get a quick overview of project structure:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":".","maxDepth":3,"excludePatterns":["node_modules",".git","dist"]}}}' | npm start
```

### 2. Source Code Analysis
Focus on source code files:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","extensions":["ts","js","py","go"],"showSizes":true}}}' | npm start
```

### 3. Documentation Structure
View documentation organization:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./docs","extensions":["md","rst","txt"]}}}' | npm start
```

## Error Handling

### Invalid Path
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"/nonexistent"}}}' | npm start
```

### Missing Required Parameters
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{}}}' | npm start
```

## Performance Considerations

- Use `maxDepth` to limit traversal for large directories
- Use `excludePatterns` to skip unnecessary directories like `node_modules`
- Filter by `extensions` to focus on relevant files
- Be cautious with `showSizes` on directories with many large files
