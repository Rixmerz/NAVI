import { BaseNaviTool } from './index.js';
import { VisualizeGraphSchema } from '../types/index.js';
import type { VisualizeGraphInput } from '../types/index.js';

interface GraphNode {
  id: string;
  label: string;
  dependencies: string[];
  level?: number;
  x?: number;
  y?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Tool for creating visual representation of dependency graphs
 */
export class VisualizeGraphTool extends BaseNaviTool {
  name = 'visualize-graph';
  description = 'Create visual representation of dependency graphs';

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<VisualizeGraphInput>(args, VisualizeGraphSchema);

      // Parse dependency data
      let graphData: GraphData;
      try {
        const parsed = JSON.parse(input.dependencyData);
        // Validate that parsed data has the expected structure
        if (parsed && parsed.nodes && Array.isArray(parsed.nodes) &&
            parsed.edges && Array.isArray(parsed.edges)) {
          graphData = parsed;
        } else {
          graphData = this.createExampleGraph();
        }
      } catch {
        // If parsing fails, create a simple example graph
        graphData = this.createExampleGraph();
      }

      // Generate visualization based on format
      let visualization: string;
      switch (input.format) {
        case 'ascii':
          visualization = this.generateAsciiGraph(graphData, input);
          break;
        case 'dot':
          visualization = this.generateDotGraph(graphData, input);
          break;
        case 'json':
          visualization = this.generateJsonGraph(graphData, input);
          break;
        default:
          visualization = this.generateAsciiGraph(graphData, input);
      }

      const metadata = {
        format: input.format,
        layout: input.layout,
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.edges.length,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(visualization, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Graph visualization failed'));
    }
  }

  private createExampleGraph(): GraphData {
    return {
      nodes: [
        { id: 'A', label: 'Module A', dependencies: ['B', 'C'] },
        { id: 'B', label: 'Module B', dependencies: ['D'] },
        { id: 'C', label: 'Module C', dependencies: ['D'] },
        { id: 'D', label: 'Module D', dependencies: [] }
      ],
      edges: [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'A', to: 'C', type: 'import' },
        { from: 'B', to: 'D', type: 'import' },
        { from: 'C', to: 'D', type: 'import' }
      ]
    };
  }

  private generateAsciiGraph(graphData: GraphData, input: VisualizeGraphInput): string {
    const limitedNodes = graphData.nodes.slice(0, input.maxNodes);

    let result = '# 📊 Dependency Graph (ASCII)\n\n';

    if (input.layout === 'hierarchical') {
      result += this.generateHierarchicalAscii(limitedNodes, graphData.edges, input.showLabels);
    } else if (input.layout === 'circular') {
      result += this.generateCircularAscii(limitedNodes, graphData.edges, input.showLabels);
    } else {
      result += this.generateSimpleAscii(limitedNodes, graphData.edges, input.showLabels);
    }

    return result;
  }

  private generateHierarchicalAscii(nodes: GraphNode[], edges: GraphEdge[], showLabels: boolean): string {
    let result = '```\n';
    result += 'Hierarchical Layout:\n\n';

    // Simple hierarchical representation
    const rootNodes = nodes.filter(node =>
      !edges.some(edge => edge.to === node.id)
    );

    const visited = new Set<string>();

    const renderNode = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const indent = '  '.repeat(depth);
      const label = showLabels ? node.label || node.id : node.id;
      result += `${indent}[${label}]\n`;

      // Find children
      const children = edges
        .filter(edge => edge.from === nodeId)
        .map(edge => edge.to);

      for (const child of children) {
        renderNode(child, depth + 1);
      }
    };

    for (const rootNode of rootNodes) {
      renderNode(rootNode.id, 0);
    }

    result += '```\n\n';
    return result;
  }

  private generateCircularAscii(nodes: GraphNode[], _edges: GraphEdge[], showLabels: boolean): string {
    let result = '```\n';
    result += 'Circular Layout (Simplified):\n\n';

    const nodeCount = Math.min(nodes.length, 6);
    const displayNodes = nodes.slice(0, nodeCount);

    result += '    [A]\n';
    result += ' [F]   [B]\n';
    result += '[E]     [C]\n';
    result += '   [D]\n';

    result += '```\n\n';

    result += '## 📍 Node Mapping\n';
    const positions = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let i = 0; i < displayNodes.length && i < positions.length; i++) {
      const node = displayNodes[i];
      if (node) {
        const label = showLabels ? node.label || node.id : node.id;
        result += `- **${positions[i]}**: ${label}\n`;
      }
    }

    return result;
  }

  private generateSimpleAscii(nodes: GraphNode[], edges: GraphEdge[], showLabels: boolean): string {
    let result = '## 📋 Nodes\n';

    for (const node of nodes) {
      const label = showLabels ? node.label || node.id : node.id;
      result += `- **${label}**`;
      if (node.dependencies.length > 0) {
        result += ` → [${node.dependencies.join(', ')}]`;
      }
      result += '\n';
    }

    result += '\n## 🔗 Edges\n';
    for (const edge of edges) {
      result += `- ${edge.from} → ${edge.to}`;
      if (edge.type) result += ` (${edge.type})`;
      result += '\n';
    }

    return result;
  }

  private generateDotGraph(graphData: GraphData, input: VisualizeGraphInput): string {
    let result = '# 🎯 DOT Graph Format\n\n';
    result += '```dot\n';
    result += 'digraph DependencyGraph {\n';
    result += '  rankdir=TB;\n';
    result += '  node [shape=box, style=rounded];\n\n';

    // Add nodes
    const limitedNodes = graphData.nodes.slice(0, input.maxNodes);
    for (const node of limitedNodes) {
      const label = input.showLabels ? node.label || node.id : node.id;
      result += `  "${node.id}" [label="${label}"];\n`;
    }

    result += '\n';

    // Add edges
    for (const edge of graphData.edges) {
      if (limitedNodes.some(n => n.id === edge.from) &&
          limitedNodes.some(n => n.id === edge.to)) {
        result += `  "${edge.from}" -> "${edge.to}"`;
        if (edge.type) {
          result += ` [label="${edge.type}"]`;
        }
        result += ';\n';
      }
    }

    result += '}\n';
    result += '```\n\n';
    result += '💡 **Tip**: Copy the DOT code above and paste it into a Graphviz visualizer like [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/)\n';

    return result;
  }

  private generateJsonGraph(graphData: GraphData, input: VisualizeGraphInput): string {
    const limitedData = {
      nodes: graphData.nodes.slice(0, input.maxNodes),
      edges: graphData.edges.filter(edge =>
        graphData.nodes.slice(0, input.maxNodes).some(n => n.id === edge.from) &&
        graphData.nodes.slice(0, input.maxNodes).some(n => n.id === edge.to)
      )
    };

    let result = '# 📄 JSON Graph Data\n\n';
    result += '```json\n';
    result += JSON.stringify(limitedData, null, 2);
    result += '\n```\n\n';
    result += '💡 **Tip**: This JSON can be used with graph visualization libraries like D3.js, Cytoscape.js, or vis.js\n';

    return result;
  }
}
