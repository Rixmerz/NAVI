import { BaseNaviTool } from './index.js';
import { GenerateTreeSchema } from '../types/index.js';
import type { GenerateTreeInput, FileNode } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';

/**
 * Tool for generating ASCII tree visualization of directory structure
 */
export class GenerateTreeTool extends BaseNaviTool {
  name = 'generate-tree';
  description = 'Generate ASCII tree visualization of directory structure';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<GenerateTreeInput>(args, GenerateTreeSchema);
      
      // Check if path exists
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      // Build file tree
      const options: Parameters<typeof this.fileSystemHelper.buildFileTree>[1] = {
        maxDepth: input.maxDepth,
        includeHidden: input.includeHidden,
        showSizes: input.showSizes
      };

      if (input.extensions) {
        options.extensions = input.extensions;
      }

      if (input.excludePatterns) {
        options.excludePatterns = input.excludePatterns;
      }

      const tree = await this.fileSystemHelper.buildFileTree(input.path, options);

      if (!tree) {
        throw new Error('Failed to build file tree');
      }

      // Generate ASCII representation
      const asciiTree = this.generateAsciiTree(tree);
      
      // Add metadata
      const metadata = {
        rootPath: input.path,
        maxDepth: input.maxDepth,
        totalNodes: this.countNodes(tree),
        timestamp: new Date().toISOString()
      };

      return this.formatResult(asciiTree, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Tree generation failed'));
    }
  }

  /**
   * Generate ASCII tree representation from FileNode structure
   */
  private generateAsciiTree(node: FileNode, prefix: string = '', isLast: boolean = true): string {
    let result = '';
    
    // Current node
    const connector = isLast ? '└── ' : '├── ';
    const nodeDisplay = this.formatNodeDisplay(node);
    result += prefix + connector + nodeDisplay + '\n';

    // Children
    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      
      node.children.forEach((child, index) => {
        const isLastChild = index === node.children!.length - 1;
        result += this.generateAsciiTree(child, childPrefix, isLastChild);
      });
    }

    return result;
  }

  /**
   * Format node display with optional metadata
   */
  private formatNodeDisplay(node: FileNode): string {
    let display = node.name;

    // Add type indicator with emoji for better visual distinction
    if (node.type === 'directory') {
      display = `📁 ${display}/`;
    } else {
      // Add file type emoji based on extension
      const emoji = this.getFileEmoji(node.name, node.language);
      display = `${emoji} ${display}`;
    }

    // Add language info
    if (node.language) {
      display += ` [${node.language}]`;
    }

    // Add size info with better formatting
    if (node.size !== undefined) {
      const sizeStr = this.formatFileSize(node.size);
      const sizeColor = this.getSizeIndicator(node.size);
      display += ` ${sizeColor}(${sizeStr})`;
    }

    return display;
  }

  /**
   * Get emoji for file type
   */
  private getFileEmoji(fileName: string, language?: string): string {
    if (language) {
      switch (language.toLowerCase()) {
        case 'typescript': return '🔷';
        case 'javascript': return '🟨';
        case 'python': return '🐍';
        case 'go': return '🐹';
        case 'java': return '☕';
        case 'rust': return '🦀';
        case 'c++': case 'c': return '⚙️';
        case 'c#': return '🔵';
        case 'php': return '🐘';
        case 'ruby': return '💎';
        case 'swift': return '🦉';
        default: return '📄';
      }
    }

    // Fallback based on extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md': case 'markdown': return '📝';
      case 'json': return '📋';
      case 'yml': case 'yaml': return '⚙️';
      case 'xml': return '📄';
      case 'css': return '🎨';
      case 'html': return '🌐';
      case 'sh': case 'bash': return '🔧';
      case 'dockerfile': return '🐳';
      case 'gitignore': return '🚫';
      default: return '📄';
    }
  }

  /**
   * Get size indicator for visual feedback
   */
  private getSizeIndicator(size: number): string {
    if (size > 500 * 1024) return '🔴'; // > 500KB (very large)
    if (size > 100 * 1024) return '🟡'; // > 100KB (large)
    if (size > 10 * 1024) return '🟢'; // > 10KB (medium)
    return '⚪'; // Small files (< 10KB)
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }

  /**
   * Count total nodes in tree
   */
  private countNodes(node: FileNode): number {
    let count = 1;
    
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }

    return count;
  }
}
