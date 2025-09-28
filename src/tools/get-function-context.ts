import { BaseNaviTool } from './index.js';
import { GetFunctionContextSchema } from '../types/index.js';
import type { GetFunctionContextInput, FunctionContext, FunctionDefinition } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { basename, relative } from 'path';

/**
 * Tool for getting the containing class/module context for a given function
 */
export class GetFunctionContextTool extends BaseNaviTool {
  name = 'get-function-context';
  description = 'Find the containing class/module context for a given function';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<GetFunctionContextInput>(args, GetFunctionContextSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const context = await this.getFunctionContext(input);
      const report = this.generateReport(context, input);
      
      const metadata = {
        functionName: input.functionName,
        searchPath: input.path,
        hasContext: !!context,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Function context analysis failed'));
    }
  }

  private async getFunctionContext(input: GetFunctionContextInput): Promise<FunctionContext | null> {
    // First, find the function definition
    const functionDef = await this.findFunctionDefinition(input);
    if (!functionDef) {
      return null;
    }

    // Get the file content to analyze context
    const fullPath = this.resolveFullPath(functionDef.path, input.path);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Build the context
    const context: FunctionContext = {
      function: functionDef,
      module: await this.analyzeModule(fullPath, lines, functionDef.language, input.path),
      relatedFunctions: await this.findRelatedFunctions(lines, functionDef)
    };

    // Add parent class if requested and found
    if (input.includeParentClass) {
      const parentClass = this.findParentClass(lines, functionDef.line - 1, functionDef.language);
      if (parentClass) {
        context.parentClass = parentClass;
      }
    }

    return context;
  }

  private async findFunctionDefinition(input: GetFunctionContextInput): Promise<FunctionDefinition | null> {
    // Get all files to search
    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};
    if (input.languages) {
      const extensions = this.getExtensionsForLanguages(input.languages);
      options.extensions = extensions;
    }

    // Add default excludePatterns
    options.excludePatterns = this.config.excludePatterns;

    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, options);

    for (const filePath of allFiles) {
      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const functionDef = await this.searchFunctionInFile(
        filePath,
        input.functionName,
        language?.name || 'Unknown',
        input.includeDocumentation,
        input.path
      );
      
      if (functionDef) {
        return functionDef;
      }
    }

    return null;
  }

  private async searchFunctionInFile(
    filePath: string,
    functionName: string,
    language: string,
    includeDocumentation: boolean,
    rootPath: string
  ): Promise<FunctionDefinition | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const patterns = this.getFunctionDeclarationPatterns(language, functionName);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            const signature = this.extractFunctionSignature(line, lines, i, language);
            const documentation = includeDocumentation ? 
              this.extractDocumentation(lines, i) : undefined;
            const parameters = this.extractParameters(signature, language);
            const returnType = this.extractReturnType(signature, language);
            const parentClass = this.findParentClass(lines, i, language);
            const module = basename(filePath, this.getFileExtension(filePath));

            return {
              name: functionName,
              path: relative(rootPath, filePath),
              line: i + 1,
              column: (match.index || 0) + 1,
              language,
              signature,
              documentation: documentation || '',
              parentClass: parentClass?.name || '',
              module,
              parameters,
              returnType: returnType || ''
            };
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async analyzeModule(
    filePath: string, 
    lines: string[], 
    language: string,
    rootPath: string
  ): Promise<FunctionContext['module']> {
    const moduleName = basename(filePath, this.getFileExtension(filePath));
    const exports = this.findExports(lines, language);
    const imports = this.findImports(lines, language);

    return {
      name: moduleName,
      path: relative(rootPath, filePath),
      exports,
      imports
    };
  }

  private findExports(lines: string[], language: string): string[] {
    const exports: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          // Named exports
          const namedExportMatch = trimmedLine.match(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/);
          if (namedExportMatch && namedExportMatch[1]) {
            exports.push(namedExportMatch[1]);
          }
          
          // Export statements
          const exportStatementMatch = trimmedLine.match(/export\s*{\s*([^}]+)\s*}/);
          if (exportStatementMatch && exportStatementMatch[1]) {
            const exportedItems = exportStatementMatch[1].split(',')
              .map(item => item.trim().split(/\s+as\s+/)[0])
              .filter((item): item is string => Boolean(item));
            exports.push(...exportedItems);
          }
          
          // Default export
          if (trimmedLine.match(/export\s+default/)) {
            exports.push('default');
          }
          break;

        case 'python':
          // __all__ definition
          const allMatch = trimmedLine.match(/__all__\s*=\s*\[([^\]]+)\]/);
          if (allMatch && allMatch[1]) {
            const items = allMatch[1].split(',').map(item => item.trim().replace(/['"]/g, ''));
            exports.push(...items);
          }

          // Function and class definitions (public by default)
          const defMatch = trimmedLine.match(/^(?:def|class)\s+(\w+)/);
          if (defMatch && defMatch[1] && !defMatch[1].startsWith('_')) {
            exports.push(defMatch[1]);
          }
          break;

        case 'java':
          // Public classes and methods
          const publicMatch = trimmedLine.match(/public\s+(?:class|interface)\s+(\w+)/);
          if (publicMatch && publicMatch[1]) {
            exports.push(publicMatch[1]);
          }
          break;

        case 'go':
          // Capitalized functions and types (public in Go)
          const goPublicMatch = trimmedLine.match(/^(?:func|type)\s+([A-Z]\w*)/);
          if (goPublicMatch && goPublicMatch[1]) {
            exports.push(goPublicMatch[1]);
          }
          break;
      }
    }

    return [...new Set(exports)]; // Remove duplicates
  }

  private findImports(lines: string[], language: string): string[] {
    const imports: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          // ES6 imports
          const importMatch = trimmedLine.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
          if (importMatch && importMatch[1]) {
            imports.push(importMatch[1]);
          }

          // CommonJS requires
          const requireMatch = trimmedLine.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
          if (requireMatch && requireMatch[1]) {
            imports.push(requireMatch[1]);
          }
          break;

        case 'python':
          // import statements
          const pythonImportMatch = trimmedLine.match(/^(?:import|from)\s+(\w+(?:\.\w+)*)/);
          if (pythonImportMatch && pythonImportMatch[1]) {
            imports.push(pythonImportMatch[1]);
          }
          break;

        case 'java':
          // import statements
          const javaImportMatch = trimmedLine.match(/^import\s+(?:static\s+)?([^;]+);/);
          if (javaImportMatch && javaImportMatch[1]) {
            imports.push(javaImportMatch[1]);
          }
          break;

        case 'go':
          // import statements
          const goImportMatch = trimmedLine.match(/^import\s+(?:"([^"]+)"|(\w+)\s+"([^"]+)")/);
          if (goImportMatch && (goImportMatch[1] || goImportMatch[3])) {
            const importPath = goImportMatch[1] || goImportMatch[3];
            if (importPath) {
              imports.push(importPath);
            }
          }
          break;
      }
    }

    return [...new Set(imports)]; // Remove duplicates
  }

  private async findRelatedFunctions(
    lines: string[],
    functionDef: FunctionDefinition
  ): Promise<string[]> {
    const relatedFunctions: string[] = [];
    
    // Find functions in the same class (if any)
    if (functionDef.parentClass) {
      const classFunctions = this.findClassMethods(lines, functionDef.parentClass, functionDef.language);
      relatedFunctions.push(...classFunctions.filter(f => f !== functionDef.name));
    }
    
    // Find functions in the same module
    const moduleFunctions = this.findModuleFunctions(lines, functionDef.language);
    relatedFunctions.push(...moduleFunctions.filter(f => f !== functionDef.name));
    
    return [...new Set(relatedFunctions)]; // Remove duplicates
  }

  private findClassMethods(lines: string[], className: string, language: string): string[] {
    const methods: string[] = [];
    let inClass = false;
    let braceCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if we're entering the class
      if (!inClass && trimmedLine.includes(`class ${className}`)) {
        inClass = true;
        continue;
      }
      
      if (inClass) {
        // Track braces to know when we exit the class
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        if (braceCount < 0) {
          break; // Exited the class
        }
        
        // Find method definitions
        const methodPatterns = this.getMethodPatterns(language);
        for (const pattern of methodPatterns) {
          const match = trimmedLine.match(pattern);
          if (match && match[1]) {
            methods.push(match[1]);
          }
        }
      }
    }

    return methods;
  }

  private findModuleFunctions(lines: string[], language: string): string[] {
    const functions: string[] = [];
    
    const functionPatterns = this.getFunctionDeclarationPatterns(language);
    
    for (const line of lines) {
      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const functionName = match[1] || match[2] || match[0];
          if (functionName && !functions.includes(functionName)) {
            functions.push(functionName);
          }
        }
      }
    }
    
    return functions;
  }

  private findParentClass(lines: string[], lineIndex: number, language: string): { name: string; line: number; methods: string[]; properties: string[] } | undefined {
    // Look backwards for class definition
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      const classPatterns = this.getClassPatterns(language);
      for (const pattern of classPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const className = match[1];
          const methods = this.findClassMethods(lines, className, language);
          const properties = this.findClassProperties(lines, className, language, i);

          return {
            name: className,
            line: i + 1,
            methods,
            properties
          };
        }
      }
    }
    
    return undefined;
  }

  private findClassProperties(lines: string[], className: string, language: string, startLine: number): string[] {
    const properties: string[] = [];
    let inClass = false;
    let braceCount = 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();
      
      if (!inClass && trimmedLine.includes(`class ${className}`)) {
        inClass = true;
        continue;
      }
      
      if (inClass) {
        // Track braces
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        if (braceCount < 0) break;
        
        // Find property definitions
        const propertyPatterns = this.getPropertyPatterns(language);
        for (const pattern of propertyPatterns) {
          const match = trimmedLine.match(pattern);
          if (match && match[1]) {
            properties.push(match[1]);
          }
        }
      }
    }

    return properties;
  }

  private getFunctionDeclarationPatterns(language: string, functionName?: string): RegExp[] {
    const name = functionName ? functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(\\w+)';
    const patterns: RegExp[] = [];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        patterns.push(
          new RegExp(`\\b(?:function|async\\s+function)\\s+${name}\\s*\\(`, 'i'),
          new RegExp(`\\b${name}\\s*[:=]\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>`, 'i'),
          new RegExp(`\\b${name}\\s*\\([^)]*\\)\\s*{`, 'i')
        );
        break;

      case 'python':
        patterns.push(new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\s*\\(`, 'im'));
        break;

      case 'java':
        patterns.push(new RegExp(`\\b(?:public|private|protected|static|final|abstract)\\s+.*\\s+${name}\\s*\\(`, 'i'));
        break;

      case 'go':
        patterns.push(new RegExp(`^\\s*func\\s+(?:\\([^)]*\\)\\s+)?${name}\\s*\\(`, 'im'));
        break;

      default:
        patterns.push(new RegExp(`\\b${name}\\s*\\(`, 'i'));
    }

    return patterns;
  }

  private getClassPatterns(language: string): RegExp[] {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return [/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/];
        
      case 'python':
        return [/^class\s+(\w+)/];
        
      case 'java':
        return [/\b(?:public|private|protected|abstract|final)\s+class\s+(\w+)/];
        
      case 'go':
        return [/^type\s+(\w+)\s+struct/];
        
      default:
        return [/class\s+(\w+)/];
    }
  }

  private getMethodPatterns(language: string): RegExp[] {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return [
          /(\w+)\s*\([^)]*\)\s*{/,
          /(\w+)\s*[:=]\s*(?:async\s+)?\([^)]*\)\s*=>/
        ];
        
      case 'python':
        return [/^\s*(?:async\s+)?def\s+(\w+)\s*\(/];
        
      case 'java':
        return [/\b(?:public|private|protected|static|final|abstract)\s+.*\s+(\w+)\s*\(/];
        
      case 'go':
        return [/^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/];
        
      default:
        return [/(\w+)\s*\(/];
    }
  }

  private getPropertyPatterns(language: string): RegExp[] {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return [
          /(\w+)\s*[:=]/,
          /(?:public|private|protected|readonly)\s+(\w+)\s*[:=]/
        ];
        
      case 'python':
        return [/^\s*(\w+)\s*=/];
        
      case 'java':
        return [/\b(?:public|private|protected|static|final)\s+\w+\s+(\w+)/];
        
      case 'go':
        return [/(\w+)\s+\w+/]; // struct fields
        
      default:
        return [/(\w+)\s*[:=]/];
    }
  }

  private extractFunctionSignature(currentLine: string, allLines: string[], lineIndex: number, language: string): string {
    let signature = currentLine.trim();
    
    // Try to get complete signature for multi-line functions
    if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript') {
      let parenCount = 0;
      let i = lineIndex;
      
      while (i < allLines.length && i < lineIndex + 3) {
        const line = allLines[i];
        if (!line) {
          i++;
          continue;
        }
        for (const char of line) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
        
        if (i > lineIndex) {
          signature += ' ' + line.trim();
        }
        
        if (parenCount === 0 && (line.includes('{') || line.includes('=>'))) {
          break;
        }
        i++;
      }
    }
    
    return signature;
  }

  private extractDocumentation(allLines: string[], lineIndex: number): string | undefined {
    const docLines: string[] = [];
    let i = lineIndex - 1;
    
    while (i >= 0 && i >= lineIndex - 10) {
      const line = allLines[i]?.trim();
      if (!line) {
        i--;
        continue;
      }
      
      if (line.startsWith('/**') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) {
        docLines.unshift(line);
      } else if (line === '' || line.startsWith('*')) {
        docLines.unshift(line);
      } else {
        break;
      }
      i--;
    }
    
    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  private extractParameters(signature: string, language: string): Array<{ name: string; type?: string; optional?: boolean }> {
    const parameters: Array<{ name: string; type?: string; optional?: boolean }> = [];
    
    const parenMatch = signature.match(/\(([^)]*)\)/);
    if (!parenMatch) return parameters;
    
    const paramStr = parenMatch[1]?.trim();
    if (!paramStr) return [];
    if (!paramStr) return parameters;
    
    const params = paramStr.split(',').map(p => p.trim());
    
    for (const param of params) {
      if (!param) continue;
      
      const paramInfo: { name: string; type?: string; optional?: boolean } = { name: param };
      
      if (language.toLowerCase() === 'typescript') {
        const tsMatch = param.match(/^(\w+)(\?)?:\s*(.+)$/);
        if (tsMatch && tsMatch[1]) {
          paramInfo.name = tsMatch[1];
          paramInfo.optional = !!tsMatch[2];
          if (tsMatch[3]) {
            paramInfo.type = tsMatch[3];
          }
        }
      }
      
      parameters.push(paramInfo);
    }
    
    return parameters;
  }

  private extractReturnType(signature: string, language: string): string | undefined {
    if (language.toLowerCase() === 'typescript') {
      const returnMatch = signature.match(/:\s*([^{=]+)(?:\s*[{=]|$)/);
      return returnMatch && returnMatch[1] ? returnMatch[1].trim() : undefined;
    }
    return undefined;
  }

  private getExtensionsForLanguages(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      javascript: ['js', 'jsx', 'mjs'],
      typescript: ['ts', 'tsx'],
      python: ['py', 'pyx'],
      java: ['java'],
      go: ['go'],
      rust: ['rs'],
      cpp: ['cpp', 'cc', 'cxx', 'c++', 'c'],
      csharp: ['cs']
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const langExtensions = extensionMap[lang.toLowerCase()];
      if (langExtensions) {
        extensions.push(...langExtensions);
      }
    }

    return extensions.length > 0 ? extensions : [];
  }

  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  private resolveFullPath(relativePath: string, rootPath: string): string {
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return `${rootPath}/${relativePath}`;
  }

  private generateReport(context: FunctionContext | null, input: GetFunctionContextInput): string {
    let report = `# 🔍 Function Context Analysis\n\n`;
    report += `**Function:** \`${input.functionName}\`\n`;
    report += `**Search Path:** \`${input.path}\`\n\n`;

    if (!context) {
      report += `## ❌ Function Not Found\n\n`;
      report += `The function \`${input.functionName}\` was not found in the specified path.\n`;
      return report;
    }

    // Function definition
    report += `## 🎯 Function Definition\n\n`;
    report += `**Location:** \`${context.function.path}:${context.function.line}:${context.function.column}\`\n`;
    report += `**Language:** ${context.function.language}\n`;
    report += `**Signature:** \`${context.function.signature}\`\n\n`;

    if (context.function.parameters.length > 0) {
      report += `**Parameters:**\n`;
      for (const param of context.function.parameters) {
        report += `- \`${param.name}\``;
        if (param.type) report += `: ${param.type}`;
        if (param.optional) report += ` (optional)`;
        report += `\n`;
      }
      report += `\n`;
    }

    if (context.function.documentation) {
      report += `**Documentation:**\n\`\`\`\n${context.function.documentation}\n\`\`\`\n\n`;
    }

    // Parent class context
    if (context.parentClass) {
      report += `## 🏗️ Parent Class\n\n`;
      report += `**Class:** \`${context.parentClass.name}\`\n`;
      report += `**Line:** ${context.parentClass.line}\n\n`;
      
      if (context.parentClass.methods.length > 0) {
        report += `**Methods (${context.parentClass.methods.length}):**\n`;
        for (const method of context.parentClass.methods.slice(0, 10)) {
          report += `- \`${method}\`\n`;
        }
        if (context.parentClass.methods.length > 10) {
          report += `- ... and ${context.parentClass.methods.length - 10} more\n`;
        }
        report += `\n`;
      }
      
      if (context.parentClass.properties.length > 0) {
        report += `**Properties (${context.parentClass.properties.length}):**\n`;
        for (const property of context.parentClass.properties.slice(0, 10)) {
          report += `- \`${property}\`\n`;
        }
        if (context.parentClass.properties.length > 10) {
          report += `- ... and ${context.parentClass.properties.length - 10} more\n`;
        }
        report += `\n`;
      }
    }

    // Module context
    report += `## 📦 Module Context\n\n`;
    report += `**Module:** \`${context.module.name}\`\n`;
    report += `**Path:** \`${context.module.path}\`\n\n`;

    if (context.module.exports.length > 0) {
      report += `**Exports (${context.module.exports.length}):**\n`;
      for (const exp of context.module.exports.slice(0, 15)) {
        report += `- \`${exp}\`\n`;
      }
      if (context.module.exports.length > 15) {
        report += `- ... and ${context.module.exports.length - 15} more\n`;
      }
      report += `\n`;
    }

    if (context.module.imports.length > 0) {
      report += `**Imports (${context.module.imports.length}):**\n`;
      for (const imp of context.module.imports.slice(0, 15)) {
        report += `- \`${imp}\`\n`;
      }
      if (context.module.imports.length > 15) {
        report += `- ... and ${context.module.imports.length - 15} more\n`;
      }
      report += `\n`;
    }

    // Related functions
    if (context.relatedFunctions.length > 0) {
      report += `## 🔗 Related Functions\n\n`;
      report += `**Functions in same scope (${context.relatedFunctions.length}):**\n`;
      for (const func of context.relatedFunctions.slice(0, 20)) {
        report += `- \`${func}\`\n`;
      }
      if (context.relatedFunctions.length > 20) {
        report += `- ... and ${context.relatedFunctions.length - 20} more\n`;
      }
    }

    return report;
  }

  protected override formatResult(report: string, metadata: Record<string, any>): string {
    return `${report}\n---\n\n**Metadata:**\n${JSON.stringify(metadata, null, 2)}`;
  }

  protected override formatError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
