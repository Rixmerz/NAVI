![NAVI - MCP Codebase Navigator](NAVI.png)

# 🧭 NAVI - MCP Codebase Navigator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io/)

**NAVI** is a powerful Model Context Protocol (MCP) server that provides intelligent codebase navigation and analysis tools. Built for developers who need deep insights into their code architecture, dependencies, and security patterns.

## ✨ **Key Features**

🌳 **Smart Code Exploration** - ASCII tree visualization with emoji indicators and size analysis  
📊 **Comprehensive Analytics** - Language distribution, file composition, and project health metrics  
🔍 **Advanced Search** - Semantic, fuzzy, and regex search with intelligent scoring  
🔗 **Dependency Analysis** - Circular dependency detection and dependency graph generation  
📈 **Visual Insights** - ASCII, DOT, and JSON graph visualizations  
🔐 **Security Scanning** - Authentication pattern detection and security analysis  
⚖️ **Project Comparison** - Side-by-side project structure and content analysis  
🎯 **Multi-Language Support** - TypeScript, JavaScript, Python, Go, Java, Rust, and more

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Rixmerz/NAVI.git
cd NAVI

# Install dependencies
npm install

# Build the project
npm run build

# Start the MCP server
npm start
```

### Basic Usage

NAVI operates as an MCP server, communicating via JSON-RPC 2.0 over stdin/stdout:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start
```

## 🛠️ **Available Tools**

### 1. 🌳 **generate-tree** - Directory Visualization
Create beautiful ASCII tree visualizations with emoji indicators and file size information.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"generate-tree",
    "arguments":{
      "path":"/path/to/project",
      "maxDepth":3,
      "showSizes":true,
      "excludePatterns":["node_modules","dist"]
    }
  }
}' | npm start
```

**Output:**
```
📁 project/
├── 📄 package.json [JSON] ⚪ (2.1KB)
├── 🔷 index.ts [TypeScript] 🟢 (15.3KB)
├── 📁 src/
│   ├── 🔷 main.ts [TypeScript] 🟢 (12.8KB)
│   └── 📁 utils/
│       └── 🔷 helpers.ts [TypeScript] ⚪ (3.2KB)
└── 📄 README.md [Markdown] ⚪ (8.1KB)
```

### 2. 📊 **analyze-codebase** - Project Analytics
Comprehensive analysis of codebase composition, language distribution, and file statistics.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"analyze-codebase",
    "arguments":{
      "path":"/path/to/project",
      "detailed":true,
      "excludePatterns":["node_modules"]
    }
  }
}' | npm start
```

**Key Insights:**
- Language distribution with visual progress bars
- File size analysis and largest files identification
- Directory-level statistics
- Project health indicators

### 3. 🔍 **find-files** - Advanced File Search
Multi-criteria file search with pattern matching, content search, and size filtering.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"find-files",
    "arguments":{
      "path":"/path/to/project",
      "content":"export function",
      "extensions":["ts","js"],
      "minSize":1000,
      "maxResults":10,
      "excludePatterns":["node_modules"]
    }
  }
}' | npm start
```

### 4. ⚖️ **compare-projects** - Project Comparison
Side-by-side comparison of project structures with detailed difference analysis.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"compare-projects",
    "arguments":{
      "pathA":"/path/to/project-v1",
      "pathB":"/path/to/project-v2",
      "compareContent":true
    }
  }
}' | npm start
```

### 5. 🔗 **analyze-dependencies** - Dependency Analysis
Analyze code dependencies, detect circular dependencies, and generate dependency graphs.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"analyze-dependencies",
    "arguments":{
      "path":"/path/to/project",
      "languages":["typescript"],
      "includeExternal":true,
      "maxDepth":5
    }
  }
}' | npm start
```

### 6. 📈 **visualize-graph** - Graph Visualization
Create visual representations of dependency graphs in multiple formats.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"visualize-graph",
    "arguments":{
      "dependencyData":"{}",
      "format":"dot",
      "layout":"hierarchical",
      "showLabels":true
    }
  }
}' | npm start
```

**Supported Formats:**
- **ASCII**: Terminal-friendly hierarchical visualization
- **DOT**: Graphviz-compatible format for professional diagrams
- **JSON**: Structured data for integration with visualization libraries

### 7. 🔍 **semantic-search** - Intelligent Code Search
Advanced semantic search with fuzzy matching, regex support, and intelligent scoring.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"semantic-search",
    "arguments":{
      "query":"authentication middleware",
      "path":"/path/to/project",
      "searchType":"semantic",
      "maxResults":10,
      "includeContext":true
    }
  }
}' | npm start
```

**Search Types:**
- **Semantic**: Intelligent matching with programming context
- **Fuzzy**: Tolerant to typos and partial matches
- **Exact**: Precise string matching
- **Regex**: Pattern-based search with full regex support

### 8. 🔐 **find-auth** - Security Pattern Detection
Discover authentication logic, security implementations, and potential vulnerabilities.

**Example:**
```bash
echo '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"find-auth",
    "arguments":{
      "path":"/path/to/project",
      "frameworks":["express","fastify"],
      "minConfidence":0.8,
      "includeTests":false
    }
  }
}' | npm start
```

**Detection Categories:**
- JWT token handling
- Session management
- Password hashing (bcrypt, argon2, scrypt)
- OAuth implementations
- API key authentication
- Security middleware (CORS, Helmet)
- Express.js authentication patterns

## 📈 **Performance Metrics**

NAVI has been extensively tested on real-world projects with impressive performance:

| Project Size | Files | Processing Time | Memory Usage | Accuracy |
|--------------|-------|----------------|--------------|----------|
| Small (< 50 files) | 14 files, 60KB | < 1 second | Low | 100% |
| Medium (< 100 files) | 91 files, 1.3MB | < 5 seconds | Low | 95%+ |
| Large (> 400K files) | 445K files, 4.8GB | ~20 seconds | Moderate | 90%+ |

### Real-World Test Results

**🔍 Semantic Search Performance:**
- Query: "export function" → 5 perfect matches in 26ms
- Query: "authentication middleware" → 167 matches across 3 files
- Average confidence score: 85-100%

**🔐 Security Analysis Results:**
- RIXA project: 2,637 security patterns detected (78.6% avg confidence)
- Categories: Session (93%), Middleware (6.3%), Security, JWT, Password
- Processing: 71 files analyzed in < 1 second

**📊 Codebase Analysis Capabilities:**
- Analyzed 445,638 files (4.8GB) in 20 seconds
- Detected 14 programming languages
- Identified largest files for refactoring priorities

## 🔧 **API Reference**

### JSON-RPC 2.0 Protocol

NAVI uses the Model Context Protocol (MCP) with JSON-RPC 2.0 for communication.

#### List Available Tools
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

#### Call a Tool
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool-name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
```

#### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool output in markdown format\n\n--- Metadata ---\nkey: value"
      }
    ]
  }
}
```

## 🏗️ **Architecture**

NAVI is built with a modular, extensible architecture:

```
src/
├── index.ts              # MCP server entry point
├── tools/                # Tool implementations
│   ├── index.ts          # Tool registry
│   ├── generate-tree.ts  # Directory visualization
│   ├── analyze-codebase.ts
│   ├── find-files.ts
│   ├── compare-projects.ts
│   ├── analyze-dependencies.ts
│   ├── visualize-graph.ts
│   ├── semantic-search.ts
│   └── find-auth.ts
├── utils/                # Shared utilities
│   ├── file-system.ts    # File operations
│   └── language-detection.ts
└── types/                # TypeScript definitions
    └── index.ts
```

### Key Design Patterns
- **Inheritance**: `BaseNaviTool` provides common functionality
- **Composition**: `FileSystemHelper` for reusable file operations
- **Factory**: Dynamic tool registration and discovery
- **Strategy**: Multiple algorithms for search and analysis

## 🤝 **Contributing**

We welcome contributions! Please follow these guidelines:

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/NAVI.git
cd NAVI

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Include unit tests for new features

### Pull Request Process
1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Add tests for new functionality
4. Update documentation as needed
5. Submit a pull request with a detailed description

### Reporting Issues
- Use the GitHub issue tracker
- Include reproduction steps
- Provide sample code or project structure when relevant
- Specify your environment (Node.js version, OS, etc.)

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- Built on the [Model Context Protocol](https://modelcontextprotocol.io/) specification
- Inspired by the need for better codebase navigation tools
- Thanks to the open-source community for excellent libraries and tools

## 📞 **Support**

- 📖 [Documentation](https://github.com/Rixmerz/NAVI/wiki)
- 🐛 [Issue Tracker](https://github.com/Rixmerz/NAVI/issues)
- 💬 [Discussions](https://github.com/Rixmerz/NAVI/discussions)

---

**Made with ❤️ for developers who love clean, analyzable code**
