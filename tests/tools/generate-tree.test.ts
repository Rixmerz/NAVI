// Basic test to verify the module structure
describe('NAVI MCP Server', () => {
  it('should be able to import core types', async () => {
    const { DEFAULT_CONFIG } = await import('../../src/types/index.js');
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(DEFAULT_CONFIG.maxFileSize).toBe(1024 * 1024);
  });

  it('should be able to register tools', async () => {
    const { registerTools } = await import('../../src/tools/index.js');
    const { DEFAULT_CONFIG } = await import('../../src/types/index.js');

    const tools = await registerTools(DEFAULT_CONFIG);
    expect(tools.size).toBe(5);
    expect(tools.has('generate-tree')).toBe(true);
    expect(tools.has('analyze-dependencies')).toBe(true);
    expect(tools.has('semantic-search')).toBe(true);
    expect(tools.has('find-auth')).toBe(true);
    expect(tools.has('visualize-graph')).toBe(true);
  });

  it('should validate tool arguments', async () => {
    const { registerTools } = await import('../../src/tools/index.js');
    const { DEFAULT_CONFIG } = await import('../../src/types/index.js');

    const tools = await registerTools(DEFAULT_CONFIG);
    const generateTreeTool = tools.get('generate-tree');

    expect(generateTreeTool).toBeDefined();

    // Test invalid arguments
    await expect(generateTreeTool!.execute({})).rejects.toThrow('Invalid arguments');

    // Test missing required path
    await expect(generateTreeTool!.execute({ maxDepth: 5 })).rejects.toThrow('Invalid arguments');
  });
});
