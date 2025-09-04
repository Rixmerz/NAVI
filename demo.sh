#!/bin/bash

# NAVI MCP Codebase Navigator Demo Script
# This script demonstrates the capabilities of the NAVI MCP server

echo "🚀 NAVI MCP Codebase Navigator Demo"
echo "=================================="
echo ""

# Check if the project is built
if [ ! -d "dist" ]; then
    echo "📦 Building the project..."
    npm run build
    echo ""
fi

echo "🔧 Testing MCP Server Connectivity..."
echo "Request: tools/list"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start | jq '.result.tools[] | {name: .name, description: .description}'
echo ""

echo "🌳 Demo 1: Basic Directory Tree"
echo "Request: generate-tree for ./src"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","maxDepth":2}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "📊 Demo 2: Tree with File Sizes"
echo "Request: generate-tree with file sizes"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","maxDepth":3,"showSizes":true}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "🔍 Demo 3: TypeScript Files Only"
echo "Request: generate-tree filtered by .ts extension"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":"./src","extensions":["ts"],"showSizes":true}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "📁 Demo 4: Project Overview (excluding node_modules)"
echo "Request: generate-tree for entire project"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate-tree","arguments":{"path":".","maxDepth":3,"excludePatterns":["node_modules",".git","dist","coverage"]}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "🔄 Demo 5: Placeholder Tools"
echo "Request: analyze-dependencies (placeholder)"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-dependencies","arguments":{"path":"./src","languages":["typescript"]}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "🔍 Demo 6: Semantic Search (placeholder)"
echo "Request: semantic-search (placeholder)"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"semantic-search","arguments":{"query":"authentication","path":"./src"}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "🔐 Demo 7: Authentication Discovery (placeholder)"
echo "Request: find-auth (placeholder)"
echo ""
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find-auth","arguments":{"path":"./src","frameworks":["express"],"minConfidence":0.8}}}' | npm start | jq -r '.result.content[0].text'
echo ""

echo "✅ Demo Complete!"
echo ""
echo "🎯 Key Features Demonstrated:"
echo "  • MCP protocol compliance with JSON-RPC 2.0"
echo "  • ASCII tree visualization with multiple options"
echo "  • Language detection and file metadata"
echo "  • Configurable filtering and depth control"
echo "  • Placeholder implementations for future tools"
echo ""
echo "📚 For more examples, see:"
echo "  • examples/usage-examples.md"
echo "  • docs/IMPLEMENTATION_STATUS.md"
echo "  • README.md"
echo ""
echo "🔧 Integration:"
echo "  • Add to Claude Desktop: see mcp-config.json"
echo "  • Use with MCP clients via stdin/stdout"
echo "  • Build custom integrations with JSON-RPC 2.0"
