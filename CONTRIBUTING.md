# Contributing to NAVI

Thank you for your interest in contributing to NAVI! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/your-username/NAVI.git
   cd NAVI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development mode**
   ```bash
   npm run dev
   ```

## 📝 Code Style Guidelines

### TypeScript Standards
- Use TypeScript for all new code
- Follow existing naming conventions (camelCase for variables, PascalCase for classes)
- Add JSDoc comments for public APIs
- Use strict type checking

### Code Organization
- Place new tools in `src/tools/`
- Add utilities to `src/utils/`
- Update type definitions in `src/types/`
- Follow the existing file structure

### Example Tool Implementation
```typescript
import { BaseNaviTool } from './index.js';
import { z } from 'zod';

const MyToolSchema = z.object({
  path: z.string(),
  option: z.boolean().optional()
});

export class MyTool extends BaseNaviTool {
  name = 'my-tool';
  description = 'Description of what this tool does';

  async execute(args: unknown): Promise<string> {
    const input = this.validateArgs(args, MyToolSchema);
    // Implementation here
    return this.formatResult(result, metadata);
  }
}
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testNamePattern="tool-name"
```

### Writing Tests
- Add tests for new tools in `tests/tools/`
- Test both success and error cases
- Use descriptive test names
- Mock external dependencies

### Test Example
```typescript
describe('MyTool', () => {
  it('should process valid input correctly', async () => {
    const tool = new MyTool({});
    const result = await tool.execute({
      path: '/test/path',
      option: true
    });
    expect(result).toContain('expected output');
  });
});
```

## 📋 Pull Request Process

### Before Submitting
1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run build
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new semantic search algorithm"
   ```

### Submitting the PR
1. Push your branch to your fork
2. Create a pull request on GitHub
3. Fill out the PR template completely
4. Link any related issues

### PR Requirements
- ✅ All tests pass
- ✅ Code follows style guidelines
- ✅ Documentation is updated
- ✅ No merge conflicts
- ✅ Descriptive commit messages

## 🐛 Reporting Issues

### Bug Reports
Include the following information:
- **Environment**: Node.js version, OS, npm version
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Sample code**: Minimal reproduction case
- **Error messages**: Full error output

### Feature Requests
- Describe the problem you're trying to solve
- Explain why this feature would be valuable
- Provide examples of how it would be used
- Consider implementation complexity

## 🏗️ Architecture Guidelines

### Adding New Tools
1. Create tool file in `src/tools/`
2. Extend `BaseNaviTool` class
3. Define Zod schema for validation
4. Implement `execute` method
5. Register in `src/tools/index.ts`
6. Add to server tool list in `src/index.ts`
7. Write comprehensive tests
8. Update documentation

### Code Quality
- Follow SOLID principles
- Use composition over inheritance where appropriate
- Keep functions small and focused
- Handle errors gracefully
- Write self-documenting code

## 📚 Documentation

### README Updates
- Update tool descriptions for new features
- Add usage examples
- Update performance metrics if applicable
- Keep the table of contents current

### Code Documentation
- Add JSDoc comments for public methods
- Document complex algorithms
- Explain non-obvious code decisions
- Include usage examples in comments

## 🎯 Contribution Ideas

### High Priority
- Improve dependency resolution in `analyze-dependencies`
- Add more programming language support
- Enhance security pattern detection
- Optimize performance for very large projects

### Medium Priority
- Add configuration file support
- Implement caching for large projects
- Add more visualization formats
- Improve error messages

### Documentation
- Add more usage examples
- Create video tutorials
- Improve API documentation
- Add troubleshooting guide

## 📞 Getting Help

- 💬 [GitHub Discussions](https://github.com/Rixmerz/NAVI/discussions)
- 🐛 [Issue Tracker](https://github.com/Rixmerz/NAVI/issues)
- 📖 [Documentation](https://github.com/Rixmerz/NAVI/wiki)

## 📄 License

By contributing to NAVI, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to NAVI! 🚀
