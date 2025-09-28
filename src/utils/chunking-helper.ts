/**
 * Utility for handling large result sets that exceed token limits
 * Provides automatic chunking and pagination for better user experience
 */

export interface ChunkingOptions {
  maxTokens?: number;
  maxResults?: number;
  chunkOverlap?: number;
  prioritizeRecent?: boolean;
}

export interface ChunkedResult<T> {
  data: T[];
  totalItems: number;
  currentChunk: number;
  totalChunks: number;
  hasMore: boolean;
  nextChunkInfo?: string | undefined;
  estimatedTokens: number;
}

export class ChunkingHelper {
  private static readonly DEFAULT_MAX_TOKENS = 20000; // Conservative limit
  private static readonly CHARS_PER_TOKEN = 4; // Rough estimate
  private static readonly DEFAULT_CHUNK_OVERLAP = 0;

  /**
   * Estimate token count for a string
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Estimate token count for an object by serializing it
   */
  static estimateObjectTokens(obj: any): number {
    try {
      const serialized = JSON.stringify(obj);
      return this.estimateTokens(serialized);
    } catch {
      return 1000; // Fallback estimate
    }
  }

  /**
   * Chunk an array of items based on token limits
   */
  static chunkByTokens<T>(
    items: T[],
    options: ChunkingOptions = {},
    itemSerializer?: (item: T) => string
  ): ChunkedResult<T>[] {
    const {
      maxTokens = this.DEFAULT_MAX_TOKENS,
      chunkOverlap = this.DEFAULT_CHUNK_OVERLAP,
      prioritizeRecent = false
    } = options;

    if (items.length === 0) {
      return [{
        data: [],
        totalItems: 0,
        currentChunk: 1,
        totalChunks: 1,
        hasMore: false,
        estimatedTokens: 0
      }];
    }

    // Sort items if prioritizing recent (assuming items have a timestamp or similar)
    const sortedItems = prioritizeRecent ? [...items].reverse() : items;

    const chunks: ChunkedResult<T>[] = [];
    let currentChunk: T[] = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      if (!item) continue;
      const itemText = itemSerializer ? itemSerializer(item) : JSON.stringify(item);
      const itemTokens = this.estimateTokens(itemText);

      // If adding this item would exceed the limit, start a new chunk
      if (currentTokens + itemTokens > maxTokens && currentChunk.length > 0) {
        chunks.push({
          data: [...currentChunk],
          totalItems: items.length,
          currentChunk: chunkIndex + 1,
          totalChunks: 0, // Will be set later
          hasMore: i < sortedItems.length - 1,
          estimatedTokens: currentTokens,
          nextChunkInfo: i < sortedItems.length - 1 ?
            `Next chunk contains ${Math.min(50, sortedItems.length - i)} more items` as string | undefined : undefined
        });

        // Handle overlap
        if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
          currentChunk = currentChunk.slice(-chunkOverlap);
          currentTokens = currentChunk.reduce((sum, overlappedItem) => {
            const overlappedText = itemSerializer ? itemSerializer(overlappedItem) : JSON.stringify(overlappedItem);
            return sum + this.estimateTokens(overlappedText);
          }, 0);
        } else {
          currentChunk = [];
          currentTokens = 0;
        }

        chunkIndex++;
      }

      currentChunk.push(item);
      currentTokens += itemTokens;
    }

    // Add the last chunk if it has items
    if (currentChunk.length > 0) {
      chunks.push({
        data: currentChunk,
        totalItems: items.length,
        currentChunk: chunkIndex + 1,
        totalChunks: 0, // Will be set later
        hasMore: false,
        estimatedTokens: currentTokens
      });
    }

    // Set total chunks for all chunks
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
      chunk.totalChunks = totalChunks;
    });

    return chunks;
  }

  /**
   * Chunk by maximum number of results
   */
  static chunkByCount<T>(
    items: T[],
    maxResults: number,
    prioritizeRecent: boolean = false
  ): ChunkedResult<T>[] {
    if (items.length === 0) {
      return [{
        data: [],
        totalItems: 0,
        currentChunk: 1,
        totalChunks: 1,
        hasMore: false,
        estimatedTokens: 0
      }];
    }

    const sortedItems = prioritizeRecent ? [...items].reverse() : items;
    const chunks: ChunkedResult<T>[] = [];
    const totalChunks = Math.ceil(sortedItems.length / maxResults);

    for (let i = 0; i < sortedItems.length; i += maxResults) {
      const chunkData = sortedItems.slice(i, i + maxResults);
      const chunkIndex = Math.floor(i / maxResults);
      
      chunks.push({
        data: chunkData,
        totalItems: items.length,
        currentChunk: chunkIndex + 1,
        totalChunks,
        hasMore: i + maxResults < sortedItems.length,
        estimatedTokens: this.estimateObjectTokens(chunkData),
        nextChunkInfo: i + maxResults < sortedItems.length ?
          `Next chunk contains ${Math.min(maxResults, sortedItems.length - i - maxResults)} more items` as string | undefined : undefined
      });
    }

    return chunks;
  }

  /**
   * Smart chunking that considers both token limits and result counts
   */
  static smartChunk<T>(
    items: T[],
    options: ChunkingOptions = {},
    itemSerializer?: (item: T) => string
  ): ChunkedResult<T>[] {
    const {
      maxResults,
      prioritizeRecent = false
    } = options;

    // If maxResults is specified and would create smaller chunks, use count-based chunking
    if (maxResults && maxResults < items.length) {
      const countChunks = this.chunkByCount(items, maxResults, prioritizeRecent);
      const tokenChunks = this.chunkByTokens(items, options, itemSerializer);
      
      // Use whichever creates more chunks (more conservative)
      return countChunks.length >= tokenChunks.length ? countChunks : tokenChunks;
    }

    return this.chunkByTokens(items, options, itemSerializer);
  }

  /**
   * Format chunked result for display
   */
  static formatChunkInfo<T>(chunk: ChunkedResult<T>): string {
    let info = `\n\n---\n**📊 Results Summary:**\n`;
    info += `- Showing ${chunk.data.length} of ${chunk.totalItems} total items\n`;
    info += `- Chunk ${chunk.currentChunk} of ${chunk.totalChunks}\n`;
    info += `- Estimated tokens: ${chunk.estimatedTokens.toLocaleString()}\n`;
    
    if (chunk.hasMore) {
      info += `- ${chunk.nextChunkInfo || 'More results available'}\n`;
      info += `\n💡 **Tip:** Use more specific filters or increase maxResults to see more items in one response.\n`;
    }
    
    return info;
  }

  /**
   * Create a summary when results are chunked
   */
  static createChunkSummary<T>(
    allChunks: ChunkedResult<T>[],
    itemDescriptor: string = 'items'
  ): string {
    if (allChunks.length <= 1) return '';

    const totalItems = allChunks[0]?.totalItems || 0;
    const totalTokens = allChunks.reduce((sum, chunk) => sum + chunk.estimatedTokens, 0);

    let summary = `\n\n🔄 **Auto-Chunking Applied**\n`;
    summary += `Due to the large result set (${totalItems} ${itemDescriptor}, ~${totalTokens.toLocaleString()} tokens), `;
    summary += `results have been automatically split into ${allChunks.length} chunks for better performance.\n\n`;
    summary += `**This is chunk 1 of ${allChunks.length}**\n`;
    summary += `To see more results, you can:\n`;
    summary += `- Use more specific search criteria\n`;
    summary += `- Increase the maxResults parameter\n`;
    summary += `- Request specific chunks if needed\n`;

    return summary;
  }
}
