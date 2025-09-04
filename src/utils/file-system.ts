import { promises as fs } from 'fs';
import { join, extname, basename, relative } from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';

import type { FileNode } from '../types/index.js';
import { detectLanguage } from './language-detection.js';

/**
 * File system utilities for NAVI codebase navigator
 */
export class FileSystemHelper {
  constructor(_excludePatterns: string[] = []) {
    // Constructor kept for compatibility but excludePatterns are now handled per-operation
  }

  /**
   * Check if a path exists and is accessible
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats safely
   */
  async getStats(path: string): Promise<{ size: number; isDirectory: boolean; isFile: boolean } | null> {
    try {
      const stats = await fs.stat(path);
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch {
      return null;
    }
  }

  /**
   * Read file content safely with size limit
   */
  async readFile(path: string, maxSize: number = 1024 * 1024): Promise<string | null> {
    try {
      const stats = await this.getStats(path);
      if (!stats || !stats.isFile || stats.size > maxSize) {
        return null;
      }
      
      return await fs.readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * List directory contents with filtering
   */
  async listDirectory(
    path: string, 
    options: {
      includeHidden?: boolean;
      extensions?: string[];
      excludePatterns?: string[];
    } = {}
  ): Promise<string[]> {
    try {
      const entries = await fs.readdir(path);
      
      return entries.filter(entry => {
        // Filter hidden files
        if (!options.includeHidden && entry.startsWith('.')) {
          return false;
        }

        // Filter by extensions
        if (options.extensions && options.extensions.length > 0) {
          const ext = extname(entry).slice(1);
          if (!options.extensions.includes(ext)) {
            return false;
          }
        }

        // Filter by exclude patterns
        if (options.excludePatterns && options.excludePatterns.length > 0) {
          for (const pattern of options.excludePatterns) {
            if (minimatch(entry, pattern)) {
              return false;
            }
          }
        }

        return true;
      });
    } catch {
      return [];
    }
  }

  /**
   * Build file tree structure recursively
   */
  async buildFileTree(
    rootPath: string,
    options: {
      maxDepth?: number;
      includeHidden?: boolean;
      extensions?: string[];
      excludePatterns?: string[];
      showSizes?: boolean;
      currentDepth?: number;
    } = {}
  ): Promise<FileNode | null> {
    const { maxDepth = 10, currentDepth = 0 } = options;

    if (currentDepth >= maxDepth) {
      return null;
    }

    const stats = await this.getStats(rootPath);
    if (!stats) {
      return null;
    }

    const name = basename(rootPath);
    const node: FileNode = {
      name,
      path: rootPath,
      type: stats.isDirectory ? 'directory' : 'file'
    };

    if (stats.isFile) {
      if (options.showSizes) {
        node.size = stats.size;
      }
      
      const language = detectLanguage(rootPath);
      if (language) {
        node.language = language.name;
        node.extension = extname(rootPath).slice(1);
      }
    } else if (stats.isDirectory) {
      const entries = await this.listDirectory(rootPath, options);
      const children: FileNode[] = [];

      for (const entry of entries) {
        const childPath = join(rootPath, entry);
        const childNode = await this.buildFileTree(childPath, {
          ...options,
          currentDepth: currentDepth + 1
        });
        
        if (childNode) {
          children.push(childNode);
        }
      }

      // Sort children: directories first, then files, both alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      node.children = children;
    }

    return node;
  }

  /**
   * Find files matching patterns
   */
  async findFiles(
    rootPath: string,
    patterns: string[],
    options: {
      includeHidden?: boolean;
      maxDepth?: number;
      excludePatterns?: string[];
    } = {}
  ): Promise<string[]> {
    // Convert exclude patterns to glob patterns
    const ignorePatterns = options.excludePatterns?.map(pattern => {
      // If pattern doesn't contain wildcards, treat as directory/file name
      if (!pattern.includes('*') && !pattern.includes('?')) {
        return `**/${pattern}/**`;
      }
      return pattern;
    }) || [];

    const globOptions = {
      cwd: rootPath,
      dot: options.includeHidden || false,
      ignore: ignorePatterns,
      absolute: true
    };

    const results: string[] = [];

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, globOptions);
        results.push(...matches);
      } catch {
        // Ignore glob errors for individual patterns
      }
    }

    // Remove duplicates and sort
    return [...new Set(results)].sort();
  }

  /**
   * Get all files in directory recursively
   */
  async getAllFiles(
    rootPath: string,
    options: {
      extensions?: string[];
      excludePatterns?: string[];
      maxDepth?: number;
    } = {}
  ): Promise<string[]> {
    const patterns = options.extensions 
      ? options.extensions.map(ext => `**/*.${ext}`)
      : ['**/*'];

    return this.findFiles(rootPath, patterns, options);
  }

  /**
   * Check if file matches any pattern
   */
  matchesPattern(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => minimatch(filePath, pattern));
  }

  /**
   * Get relative path from root
   */
  getRelativePath(filePath: string, rootPath: string): string {
    return relative(rootPath, filePath);
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Get file extension without dot
   */
  getExtension(filePath: string): string {
    return extname(filePath).slice(1).toLowerCase();
  }

  /**
   * Check if path is within root directory
   */
  isWithinRoot(filePath: string, rootPath: string): boolean {
    const relativePath = relative(rootPath, filePath);
    return !relativePath.startsWith('..') && !relativePath.startsWith('/');
  }
}
