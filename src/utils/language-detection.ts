import { extname, basename } from 'path';
import type { LanguageInfo } from '../types/index.js';

/**
 * Language detection utilities for NAVI codebase navigator
 */

export const SUPPORTED_LANGUAGES: Record<string, LanguageInfo> = {
  javascript: {
    name: 'JavaScript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    parser: 'javascript',
    keywords: ['function', 'const', 'let', 'var', 'class', 'import', 'export', 'async', 'await'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  typescript: {
    name: 'TypeScript',
    extensions: ['ts', 'tsx', 'mts', 'cts'],
    parser: 'typescript',
    keywords: ['interface', 'type', 'enum', 'namespace', 'declare', 'abstract', 'implements'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  python: {
    name: 'Python',
    extensions: ['py', 'pyw', 'pyi'],
    parser: 'python',
    keywords: ['def', 'class', 'import', 'from', 'if', 'elif', 'else', 'for', 'while', 'try', 'except'],
    commentPatterns: {
      single: '#',
      multiStart: '"""',
      multiEnd: '"""'
    }
  },
  go: {
    name: 'Go',
    extensions: ['go'],
    parser: 'go',
    keywords: ['func', 'package', 'import', 'type', 'struct', 'interface', 'var', 'const'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  java: {
    name: 'Java',
    extensions: ['java'],
    parser: 'java',
    keywords: ['class', 'interface', 'enum', 'package', 'import', 'public', 'private', 'protected'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  rust: {
    name: 'Rust',
    extensions: ['rs'],
    keywords: ['fn', 'struct', 'enum', 'trait', 'impl', 'mod', 'use', 'pub', 'let', 'mut'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  cpp: {
    name: 'C++',
    extensions: ['cpp', 'cxx', 'cc', 'c++', 'hpp', 'hxx', 'h++'],
    keywords: ['class', 'struct', 'namespace', 'template', 'typename', 'public', 'private', 'protected'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  c: {
    name: 'C',
    extensions: ['c', 'h'],
    keywords: ['struct', 'union', 'enum', 'typedef', 'static', 'extern', 'inline'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  csharp: {
    name: 'C#',
    extensions: ['cs'],
    keywords: ['class', 'interface', 'struct', 'enum', 'namespace', 'using', 'public', 'private'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  php: {
    name: 'PHP',
    extensions: ['php', 'phtml', 'php3', 'php4', 'php5'],
    keywords: ['class', 'interface', 'trait', 'namespace', 'use', 'function', 'public', 'private'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  ruby: {
    name: 'Ruby',
    extensions: ['rb', 'rbw'],
    keywords: ['class', 'module', 'def', 'end', 'require', 'include', 'extend'],
    commentPatterns: {
      single: '#',
      multiStart: '=begin',
      multiEnd: '=end'
    }
  },
  swift: {
    name: 'Swift',
    extensions: ['swift'],
    keywords: ['class', 'struct', 'enum', 'protocol', 'extension', 'func', 'var', 'let'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  kotlin: {
    name: 'Kotlin',
    extensions: ['kt', 'kts'],
    keywords: ['class', 'interface', 'object', 'fun', 'val', 'var', 'package', 'import'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  scala: {
    name: 'Scala',
    extensions: ['scala', 'sc'],
    keywords: ['class', 'object', 'trait', 'def', 'val', 'var', 'package', 'import'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  // Configuration and Data Files
  json: {
    name: 'JSON',
    extensions: ['json', 'jsonc', 'json5'],
    keywords: [],
    commentPatterns: {}
  },
  yaml: {
    name: 'YAML',
    extensions: ['yaml', 'yml'],
    keywords: [],
    commentPatterns: {
      single: '#'
    }
  },
  xml: {
    name: 'XML',
    extensions: ['xml', 'xsd', 'xsl', 'xslt', 'svg'],
    keywords: [],
    commentPatterns: {
      multiStart: '<!--',
      multiEnd: '-->'
    }
  },
  html: {
    name: 'HTML',
    extensions: ['html', 'htm', 'xhtml'],
    keywords: ['html', 'head', 'body', 'div', 'span', 'script', 'style'],
    commentPatterns: {
      multiStart: '<!--',
      multiEnd: '-->'
    }
  },
  css: {
    name: 'CSS',
    extensions: ['css', 'scss', 'sass', 'less'],
    keywords: ['@import', '@media', '@keyframes', 'class', 'id'],
    commentPatterns: {
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  // Shell and Scripts
  shell: {
    name: 'Shell',
    extensions: ['sh', 'bash', 'zsh', 'fish'],
    keywords: ['if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done', 'function'],
    commentPatterns: {
      single: '#'
    }
  },
  powershell: {
    name: 'PowerShell',
    extensions: ['ps1', 'psm1', 'psd1'],
    keywords: ['function', 'param', 'if', 'else', 'foreach', 'while'],
    commentPatterns: {
      single: '#',
      multiStart: '<#',
      multiEnd: '#>'
    }
  },
  // Documentation
  markdown: {
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mdown', 'mkd'],
    keywords: [],
    commentPatterns: {
      multiStart: '<!--',
      multiEnd: '-->'
    }
  },
  // Database
  sql: {
    name: 'SQL',
    extensions: ['sql', 'mysql', 'pgsql', 'sqlite'],
    keywords: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER'],
    commentPatterns: {
      single: '--',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  // Build and Config Files
  dockerfile: {
    name: 'Dockerfile',
    extensions: ['dockerfile'],
    keywords: ['FROM', 'RUN', 'COPY', 'ADD', 'EXPOSE', 'CMD', 'ENTRYPOINT'],
    commentPatterns: {
      single: '#'
    }
  },
  makefile: {
    name: 'Makefile',
    extensions: ['makefile', 'mk'],
    keywords: ['all', 'clean', 'install', 'test'],
    commentPatterns: {
      single: '#'
    }
  },
  // Other Languages
  dart: {
    name: 'Dart',
    extensions: ['dart'],
    keywords: ['class', 'abstract', 'interface', 'mixin', 'enum', 'library', 'import'],
    commentPatterns: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/'
    }
  },
  lua: {
    name: 'Lua',
    extensions: ['lua'],
    keywords: ['function', 'local', 'if', 'then', 'else', 'end', 'for', 'while'],
    commentPatterns: {
      single: '--',
      multiStart: '--[[',
      multiEnd: ']]'
    }
  },
  perl: {
    name: 'Perl',
    extensions: ['pl', 'pm', 'perl'],
    keywords: ['sub', 'package', 'use', 'require', 'my', 'our', 'local'],
    commentPatterns: {
      single: '#'
    }
  },
  r: {
    name: 'R',
    extensions: ['r', 'R'],
    keywords: ['function', 'if', 'else', 'for', 'while', 'library', 'require'],
    commentPatterns: {
      single: '#'
    }
  }
};

// Special file mappings (files without extensions)
const SPECIAL_FILES: Record<string, string> = {
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'rakefile': 'ruby',
  'gemfile': 'ruby',
  'podfile': 'ruby',
  'vagrantfile': 'ruby',
  'gruntfile': 'javascript',
  'gulpfile': 'javascript',
  'webpack.config': 'javascript',
  'rollup.config': 'javascript',
  'vite.config': 'javascript',
  'jest.config': 'javascript',
  'babel.config': 'javascript',
  'eslint.config': 'javascript',
  'prettier.config': 'javascript',
  'tailwind.config': 'javascript',
  'next.config': 'javascript',
  'nuxt.config': 'javascript',
  'vue.config': 'javascript',
  'svelte.config': 'javascript',
  'astro.config': 'javascript',
  'tsconfig': 'json',
  'jsconfig': 'json',
  'package': 'json',
  'package-lock': 'json',
  'yarn.lock': 'yaml',
  'composer': 'json',
  'cargo': 'yaml',
  'pyproject': 'yaml',
  'requirements': 'text',
  'pipfile': 'yaml',
  'poetry.lock': 'yaml',
  'go.mod': 'text',
  'go.sum': 'text',
  'pom': 'xml',
  'build.gradle': 'text',
  'settings.gradle': 'text',
  'cmakelists': 'text',
  'readme': 'markdown',
  'changelog': 'markdown',
  'license': 'text',
  'authors': 'text',
  'contributors': 'text',
  'copying': 'text',
  'install': 'text',
  'news': 'text',
  'todo': 'text',
  'version': 'text',
  'gitignore': 'text',
  'gitattributes': 'text',
  'editorconfig': 'text',
  'dockerignore': 'text',
  'npmignore': 'text'
};

/**
 * Detect programming language from file path
 */
export function detectLanguage(filePath: string): LanguageInfo | null {
  const extension = extname(filePath).slice(1).toLowerCase();
  const fileName = basename(filePath).toLowerCase();

  // First try extension-based detection
  if (extension) {
    for (const [, langInfo] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (langInfo.extensions.includes(extension)) {
        return langInfo;
      }
    }
  }

  // Then try special file detection (files without extensions or special names)
  for (const [pattern, langKey] of Object.entries(SPECIAL_FILES)) {
    if (fileName === pattern || fileName.startsWith(pattern + '.')) {
      if (langKey === 'text') {
        return { name: 'Text', extensions: [], keywords: [], commentPatterns: {} };
      }
      if (langKey === 'markdown') {
        return SUPPORTED_LANGUAGES['markdown'] || null;
      }
      const lang = SUPPORTED_LANGUAGES[langKey];
      if (lang) return lang;
    }
  }

  // Check for shebang in shell scripts
  if (!extension && (fileName.includes('script') || fileName.includes('run'))) {
    return SUPPORTED_LANGUAGES['shell'] || null;
  }

  return null;
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
  const extensions = new Set<string>();
  
  for (const langInfo of Object.values(SUPPORTED_LANGUAGES)) {
    for (const ext of langInfo.extensions) {
      extensions.add(ext);
    }
  }
  
  return Array.from(extensions).sort();
}

/**
 * Get languages by extension
 */
export function getLanguagesByExtension(): Record<string, string> {
  const extToLang: Record<string, string> = {};
  
  for (const [langKey, langInfo] of Object.entries(SUPPORTED_LANGUAGES)) {
    for (const ext of langInfo.extensions) {
      extToLang[ext] = langKey;
    }
  }
  
  return extToLang;
}

/**
 * Check if file is a source code file
 */
export function isSourceFile(filePath: string): boolean {
  return detectLanguage(filePath) !== null;
}

/**
 * Get language parser name for tree-sitter
 */
export function getParserName(language: string): string | null {
  const langInfo = SUPPORTED_LANGUAGES[language];
  return langInfo?.parser || null;
}

/**
 * Check if language supports specific features
 */
export function languageSupports(language: string, feature: 'classes' | 'functions' | 'modules'): boolean {
  const langInfo = SUPPORTED_LANGUAGES[language];
  if (!langInfo) return false;

  switch (feature) {
    case 'classes':
      return langInfo.keywords.includes('class');
    case 'functions':
      return langInfo.keywords.some(kw => ['function', 'def', 'func', 'fn'].includes(kw));
    case 'modules':
      return langInfo.keywords.some(kw => ['import', 'module', 'namespace', 'package'].includes(kw));
    default:
      return false;
  }
}

/**
 * Get comment patterns for a language
 */
export function getCommentPatterns(language: string): { single?: string; multiStart?: string; multiEnd?: string } | null {
  const langInfo = SUPPORTED_LANGUAGES[language];
  return langInfo?.commentPatterns || null;
}
