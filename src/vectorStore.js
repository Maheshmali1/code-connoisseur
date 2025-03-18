const { OpenAIEmbeddings } = require('@langchain/openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Local storage path for vectors - store in the current repository
// This will create a .code-connoisseur directory in the project root
const LOCAL_VECTOR_PATH = path.join(process.cwd(), '.code-connoisseur', 'vectors');

// Initialize embeddings based on available API keys
let embeddings;
let usingValidOpenAI = false;
let usingValidAnthropic = false;

// Check for valid OpenAI key
if (process.env.OPENAI_API_KEY && 
    process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && 
    process.env.OPENAI_API_KEY !== 'placeholder' &&
    process.env.OPENAI_API_KEY.startsWith('sk-')) {
  
  try {
    usingValidOpenAI = true;
    // Initialize OpenAI embeddings
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-ada-002'
    });
    console.log('Using OpenAI for embeddings');
  } catch (error) {
    console.error('Error initializing OpenAI embeddings:', error.message);
    usingValidOpenAI = false;
  }
} 

// Check for valid Anthropic key (even though we can't use it directly for embeddings yet)
if (process.env.ANTHROPIC_API_KEY && 
    process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here' && 
    process.env.ANTHROPIC_API_KEY !== 'placeholder' &&
    process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
  usingValidAnthropic = true;
  console.log('Valid Anthropic API key detected');
}

// If we don't have valid OpenAI (for embeddings) or Anthropic (for main functionality)
// use mock embeddings for development
if (!usingValidOpenAI && !usingValidAnthropic) {
  console.warn('No valid embedding API key available - using mock embeddings for development');
} 

// If we don't have OpenAI for embeddings but have Anthropic
if (!usingValidOpenAI && usingValidAnthropic) {
  console.log('Using mock embeddings with valid Anthropic key (Anthropic embedding API not yet implemented)');
}

// Create mock embeddings if we don't have OpenAI
if (!usingValidOpenAI) {
  // Create a simple mock embedding function for development
  embeddings = {
    embedDocuments: async (texts) => texts.map(() => Array(1536).fill(0).map(() => Math.random())),
    embedQuery: async (text) => Array(1536).fill(0).map(() => Math.random())
  };
}

// Initialize Pinecone (only if API key is set properly)
let pinecone;
let usingLocalStorage = false;
if (process.env.PINECONE_API_KEY && 
    process.env.PINECONE_API_KEY !== 'your_pinecone_api_key_here' && 
    process.env.PINECONE_API_KEY !== 'placeholder') {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
} else {
  // Will use local storage fallback
  usingLocalStorage = true;
  console.log('Using local vector storage instead of Pinecone');
  // Ensure the local storage directory exists
  fs.ensureDirSync(LOCAL_VECTOR_PATH);
}

/**
 * Generates embeddings for code chunks
 * @param {Array<{type: string, name: string, code: string, path: string}>} chunks - Array of code chunks
 * @returns {Promise<Array<{id: string, values: number[], metadata: object}>>} - Array of embedded chunks
 */
async function embedChunks(chunks) {
  console.log(`Embedding ${chunks.length} chunks...`);
  
  const embeddedChunks = [];
  
  // Process in batches to avoid rate limiting
  const batchSize = 100; // Increased batch size for mock embeddings
  const totalBatches = Math.ceil(chunks.length / batchSize);
  let lastProgressReport = 0;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;
    
    // Only log progress occasionally to reduce console spam
    const progress = Math.floor((currentBatch / totalBatches) * 100);
    if (progress >= lastProgressReport + 10 || currentBatch === 1 || currentBatch === totalBatches) {
      console.log(`Processing ${progress}% (batch ${currentBatch}/${totalBatches})`);
      lastProgressReport = progress;
    }
    
    const texts = batch.map(chunk => chunk.code);
    const vectors = await embeddings.embedDocuments(texts);
    
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      // Create a hash of the path and name to keep ID shorter
      const idHash = Buffer.from(`${chunk.path}-${chunk.name}`).toString('base64').substring(0, 12);
      embeddedChunks.push({
        id: `${idHash}-${i + j}`,
        values: vectors[j],
        metadata: {
          path: chunk.path,
          type: chunk.type,
          name: chunk.name,
          // Truncate very long code to save space - we keep full content in separate storage
          code: chunk.code.substring(0, Math.min(chunk.code.length, 5000)) 
        }
      });
    }
  }
  
  return embeddedChunks;
}

/**
 * Stores embeddings in Pinecone or local storage
 * @param {Array<{id: string, values: number[], metadata: object}>} embeddedChunks - Array of embedded chunks
 * @param {string} indexName - Name of the Pinecone index or local storage directory
 * @returns {Promise<void>}
 */
async function storeEmbeddings(embeddedChunks, indexName) {
  if (usingLocalStorage) {
    return storeEmbeddingsLocally(embeddedChunks, indexName);
  } else {
    return storeEmbeddingsInPinecone(embeddedChunks, indexName);
  }
}

/**
 * Stores embeddings in Pinecone
 * @param {Array<{id: string, values: number[], metadata: object}>} embeddedChunks - Array of embedded chunks
 * @param {string} indexName - Name of the Pinecone index
 * @returns {Promise<void>}
 */
async function storeEmbeddingsInPinecone(embeddedChunks, indexName) {
  console.log(`Storing ${embeddedChunks.length} embeddings in Pinecone index: ${indexName}`);
  
  // Get or create index
  let index = pinecone.Index(indexName);
  
  // Check if index exists
  let indexExists = false;
  try {
    const indexList = await pinecone.listIndexes();
    // Handle different response formats from Pinecone API
    if (Array.isArray(indexList)) {
      indexExists = indexList.some(idx => idx.name === indexName);
    } else if (indexList.indexes && Array.isArray(indexList.indexes)) {
      indexExists = indexList.indexes.some(idx => idx.name === indexName);
    } else {
      console.log('Unexpected Pinecone API response format:', indexList);
      // Assume index doesn't exist if we can't determine
      indexExists = false;
    }
  } catch (error) {
    console.error('Error checking if index exists:', error.message);
    // Assume index doesn't exist if we can't check
    indexExists = false;
  }

  if (!indexExists) {
    console.log(`Creating index: ${indexName}`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // Dimension for text-embedding-ada-002
      metric: 'cosine'
    });
    // Wait for index to initialize
    await new Promise(resolve => setTimeout(resolve, 30000)); 
    index = pinecone.Index(indexName);
  }
  
  // Upload in batches
  const batchSize = 100;
  for (let i = 0; i < embeddedChunks.length; i += batchSize) {
    const batch = embeddedChunks.slice(i, i + batchSize);
    console.log(`Uploading batch ${i / batchSize + 1}/${Math.ceil(embeddedChunks.length / batchSize)}`);
    await index.upsert(batch);
  }
  
  console.log('All embeddings stored successfully in Pinecone');
}

/**
 * Stores embeddings in chunked local files to handle large datasets
 * @param {Array<{id: string, values: number[], metadata: object}>} embeddedChunks - Array of embedded chunks
 * @param {string} indexName - Name of the local storage directory
 * @returns {Promise<void>}
 */
async function storeEmbeddingsLocally(embeddedChunks, indexName) {
  console.log(`Storing ${embeddedChunks.length} embeddings locally in: ${indexName}`);
  
  // Get or create a writable directory for storage
  let indexDir;
  try {
    // Create the vector store directory if it doesn't exist
    await fs.ensureDir(LOCAL_VECTOR_PATH);
    console.log(`Using vector storage directory: ${LOCAL_VECTOR_PATH}`);
    
    // Check if we have write permissions by writing a test file
    const testFilePath = path.join(LOCAL_VECTOR_PATH, 'test-write-permission.txt');
    await fs.writeFile(testFilePath, 'test', { flag: 'w' });
    await fs.unlink(testFilePath); // Remove test file if successful
    
    // Create a specific directory for this index
    indexDir = path.join(LOCAL_VECTOR_PATH, indexName);
    await fs.ensureDir(indexDir);
    
    // Make sure the permissions are set correctly
    try {
      // On Unix-like systems, ensure user has read/write permissions
      if (process.platform !== 'win32') {
        await fs.chmod(LOCAL_VECTOR_PATH, 0o755);
        await fs.chmod(indexDir, 0o755);
      }
    } catch (chmodError) {
      console.warn(`Could not set permissions: ${chmodError.message}`);
      // Continue anyway, the write test passed
    }
  } catch (dirError) {
    // If there was an error creating the directory or checking permissions
    console.error(`Error with vector storage directory: ${dirError.message}`);
    
    // Try an alternative directory within the repository in case of permission issues
    try {
      const alternatePath = path.join(process.cwd(), '.code-connoisseur-alt', 'vectors');
      console.log(`Trying alternate storage location: ${alternatePath}`);
      
      await fs.ensureDir(alternatePath);
      // Update the path for this session only
      indexDir = path.join(alternatePath, indexName);
      await fs.ensureDir(indexDir);
    } catch (altError) {
      // If all else fails, throw the original error
      throw dirError;
    }
  }
  
  // Create index metadata file
  const indexMetaPath = path.join(indexDir, 'meta.json');
  await fs.writeJson(indexMetaPath, {
    name: indexName,
    dimension: 1536,
    metric: 'cosine',
    chunkCount: embeddedChunks.length,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    path: indexDir // Store the actual path used
  }, { spaces: 2 });
  
  try {
    // Store chunks in batches to avoid "Invalid string length" error
    const BATCH_SIZE = 500; // Smaller batches to avoid JSON stringify limits
    const totalBatches = Math.ceil(embeddedChunks.length / BATCH_SIZE);
    
    console.log(`Splitting into ${totalBatches} batches of ${BATCH_SIZE} chunks each`);
    
    // Save index mappings for batch lookup
    const indexMappings = {};
    let lastProgressReport = 0;
    
    // Create path mapping lookup to reduce duplicate file storage
    const pathMappings = {};
    let pathId = 0;
    
    // Function to get or create a path ID for deduplication
    const getPathId = (filepath) => {
      if (!pathMappings[filepath]) {
        pathMappings[filepath] = `p${pathId++}`;
      }
      return pathMappings[filepath];
    };
    
    // Progress tracking
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, embeddedChunks.length);
      const batchChunks = embeddedChunks.slice(start, end);
      
      // Only log progress occasionally to reduce console spam
      const progress = Math.floor((i / totalBatches) * 100);
      if (progress >= lastProgressReport + 10 || i === 0 || i === totalBatches - 1) {
        console.log(`Writing ${progress}% (batch ${i+1}/${totalBatches})`);
        lastProgressReport = progress;
      }
      
      // Process batch to reduce size - store vectors separately from metadata
      const batchVectors = [];
      const batchMetadata = [];
      
      batchChunks.forEach((chunk, idx) => {
        const chunkId = chunk.id;
        const pathId = getPathId(chunk.metadata.path);
        
        // Store mapping from chunk ID to batch number for lookups
        indexMappings[chunkId] = {
          batch: i,
          index: idx
        };
        
        // Add to batch arrays - separating vectors and metadata to reduce size
        batchVectors.push({
          id: chunkId,
          values: chunk.values
        });
        
        // Use path ID instead of full path to reduce storage size
        batchMetadata.push({
          id: chunkId,
          metadata: {
            p: pathId, // path ID for lookup
            t: chunk.metadata.type, // shortened property name
            n: chunk.metadata.name, // shortened property name
            c: chunk.metadata.code  // shortened property name
          }
        });
      });
      
      // Save vectors and metadata separately
      const vectorPath = path.join(indexDir, `vec-${i}.json`);
      const metadataPath = path.join(indexDir, `meta-${i}.json`);
      
      await fs.writeJson(vectorPath, batchVectors);
      await fs.writeJson(metadataPath, batchMetadata);
    }
    
    // Save path mappings for lookup
    const pathMappingsPath = path.join(indexDir, 'paths.json');
    await fs.writeJson(pathMappingsPath, pathMappings);
    
    // Save index mappings for fast lookup
    const mappingsPath = path.join(indexDir, 'map.json');
    await fs.writeJson(mappingsPath, indexMappings);
    
    console.log(`Saved ${embeddedChunks.length} chunks in ${totalBatches} batches`);
    console.log(`Storage location: ${indexDir}`);
    
    // Create a .location file in the metadata directory to help find the alternate location
    if (!indexDir.startsWith(LOCAL_VECTOR_PATH)) {
      try {
        const metaDir = path.join(process.cwd(), '.code-connoisseur', 'metadata');
        await fs.ensureDir(metaDir);
        await fs.writeJson(path.join(metaDir, `${indexName}-location.json`), {
          alternate_path: indexDir,
          created: new Date().toISOString()
        });
      } catch (locationError) {
        // Ignore errors writing the location file, it's just a convenience
      }
    }
    
    console.log('All embeddings stored successfully locally in chunked format');
  } catch (storageError) {
    console.error(`Failed to store embeddings: ${storageError.message}`);
    throw storageError;
  }
}

/**
 * Searches the vector database for similar code
 * @param {string} query - Search query
 * @param {string} indexName - Name of the Pinecone index or local storage directory
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array<{metadata: object, score: number}>>} - Search results
 */
async function searchCodebase(query, indexName, topK = 5) {
  if (usingLocalStorage) {
    return searchCodebaseLocally(query, indexName, topK);
  } else {
    return searchCodebaseInPinecone(query, indexName, topK);
  }
}

/**
 * Searches Pinecone for similar code
 * @param {string} query - Search query
 * @param {string} indexName - Name of the Pinecone index
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array<{metadata: object, score: number}>>} - Search results
 */
async function searchCodebaseInPinecone(query, indexName, topK = 5) {
  console.log(`Searching for: "${query}" in Pinecone index: ${indexName}`);
  
  const index = pinecone.Index(indexName);
  const queryEmbedding = await embeddings.embedQuery(query);
  
  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  });
  
  return results.matches.map(match => ({
    metadata: match.metadata,
    score: match.score
  }));
}

/**
 * Searches local storage for similar code using vector similarity
 * @param {string} query - Search query
 * @param {string} indexName - Name of the local storage directory
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array<{metadata: object, score: number}>>} - Search results
 */
async function searchCodebaseLocally(query, indexName, topK = 5) {
  console.log(`Searching for: "${query}" in local storage: ${indexName}`);
  
  // Get the storage location - might be standard or alternate
  const indexDir = await getStorageLocation(indexName);
  if (!indexDir) {
    console.error(`Index ${indexName} not found in any storage location`);
    return [];
  }
  
  console.log(`Using storage location: ${indexDir}`);
  
  const metaPath = path.join(indexDir, 'meta.json');
  const pathsPath = path.join(indexDir, 'paths.json');
  
  if (!await fs.pathExists(metaPath)) {
    console.error(`Index metadata not found for ${indexName}`);
    return [];
  }
  
  // Load path mappings if available
  let pathMappings = {};
  try {
    if (await fs.pathExists(pathsPath)) {
      pathMappings = await fs.readJson(pathsPath);
    }
  } catch (error) {
    console.warn('Error loading path mappings:', error.message);
  }
  
  // Function to resolve path ID to full path
  const resolvePath = (pathId) => {
    // Find the key in pathMappings where the value matches pathId
    for (const [path, id] of Object.entries(pathMappings)) {
      if (id === pathId) {
        return path;
      }
    }
    return pathId; // Return the ID if path not found
  };
  
  // Generate query embedding
  const queryEmbedding = await embeddings.embedQuery(query);
  
  // Process each batch of vectors
  let allResults = [];
  let batchIndex = 0;
  let batchExists = true;
  const SIMILARITY_THRESHOLD = 0.5; // Only keep matches above this threshold
  
  while (batchExists) {
    const vectorPath = path.join(indexDir, `vec-${batchIndex}.json`);
    const metadataPath = path.join(indexDir, `meta-${batchIndex}.json`);
    
    // Handle either old format or new format files
    const oldVectorPath = path.join(indexDir, `vectors-${batchIndex}.json`);
    const oldMetadataPath = path.join(indexDir, `metadata-${batchIndex}.json`);
    
    const vectorExists = await fs.pathExists(vectorPath) || await fs.pathExists(oldVectorPath);
    const metaExists = await fs.pathExists(metadataPath) || await fs.pathExists(oldMetadataPath);
    
    if (vectorExists && metaExists) {
      try {
        // Load vectors and metadata for this batch
        const useOldFormat = await fs.pathExists(oldVectorPath);
        const actualVectorPath = useOldFormat ? oldVectorPath : vectorPath;
        const actualMetadataPath = useOldFormat ? oldMetadataPath : metadataPath;
        
        const vectorBatch = await fs.readJson(actualVectorPath);
        const metadataBatch = await fs.readJson(actualMetadataPath);
        
        // Calculate similarity for each vector in this batch
        for (let i = 0; i < vectorBatch.length; i++) {
          const vector = vectorBatch[i].values;
          const metadataEntry = metadataBatch[i].metadata;
          
          // Convert optimized metadata format to original format if needed
          let metadata;
          if (metadataEntry.p !== undefined) {
            // This is the optimized format with shortened property names
            metadata = {
              path: resolvePath(metadataEntry.p),
              type: metadataEntry.t,
              name: metadataEntry.n,
              code: metadataEntry.c
            };
          } else {
            // This is the original format
            metadata = metadataEntry;
          }
          
          const similarity = calculateCosineSimilarity(queryEmbedding, vector);
          
          // Only keep track of items above the similarity threshold
          if (similarity > SIMILARITY_THRESHOLD) {
            allResults.push({
              metadata,
              score: similarity
            });
          }
        }
        
        batchIndex++;
      } catch (error) {
        console.error(`Error processing batch ${batchIndex}:`, error.message);
        break;
      }
    } else {
      batchExists = false;
    }
  }
  
  console.log(`Found ${allResults.length} relevant items above similarity threshold`);
  
  // Sort by similarity score (descending) and return top K
  const topResults = allResults.sort((a, b) => b.score - a.score).slice(0, topK);
  
  return topResults;
}

/**
 * Get the storage location for an index, checking multiple possible locations
 * @param {string} indexName - The name of the index to locate
 * @returns {Promise<string|null>} - Path to the index directory, or null if not found
 */
async function getStorageLocation(indexName) {
  // Check the primary location first
  const standardPath = path.join(LOCAL_VECTOR_PATH, indexName);
  if (await fs.pathExists(standardPath)) {
    return standardPath;
  }
  
  // Check if we have a location file pointing to an alternate location
  const locationFile = path.join(LOCAL_VECTOR_PATH, `${indexName}-location.json`);
  if (await fs.pathExists(locationFile)) {
    try {
      const location = await fs.readJson(locationFile);
      if (location.alternate_path && await fs.pathExists(location.alternate_path)) {
        return location.alternate_path;
      }
    } catch (error) {
      console.warn(`Error reading location file: ${error.message}`);
    }
  }
  
  // Check legacy location in user's home directory
  const legacyPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.code-connoisseur-vectors', indexName);
  if (await fs.pathExists(legacyPath)) {
    console.log(`Found legacy index at ${legacyPath}`);
    console.log('Consider reindexing to use the new centralized storage location');
    return legacyPath;
  }
  
  // Check common alternate locations
  const alternateLocations = [
    // Primary repository storage location
    path.join(process.cwd(), '.code-connoisseur', 'vectors', indexName),
    // Alternate repository storage location
    path.join(process.cwd(), '.code-connoisseur-alt', 'vectors', indexName),
    // Legacy location in home directory (for backward compatibility)
    path.join(process.env.HOME || process.env.USERPROFILE || '.', '.code-connoisseur-vectors', indexName)
  ];
  
  // Try each alternative
  for (const altPattern of alternateLocations) {
    try {
      // Use glob to find matching directories
      const matches = glob.sync(altPattern);
      for (const match of matches) {
        if (await fs.pathExists(path.join(match, 'meta.json'))) {
          return match;
        }
      }
    } catch (error) {
      // Continue to next option
    }
  }
  
  // Not found anywhere
  return null;
}

/**
 * Calculates cosine similarity between two vectors
 * @param {Array<number>} vecA - First vector
 * @param {Array<number>} vecB - Second vector
 * @returns {number} - Cosine similarity (0-1)
 */
function calculateCosineSimilarity(vecA, vecB) {
  // Dot product
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += Math.pow(vecA[i], 2);
    normB += Math.pow(vecB[i], 2);
  }
  
  // Handle zero vectors
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  // Cosine similarity
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  embedChunks,
  storeEmbeddings,
  searchCodebase
};