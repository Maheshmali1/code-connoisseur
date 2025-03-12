const diffLib = require('diff');

/**
 * Analyzes differences between two code versions
 * @param {string} oldCode - Original code
 * @param {string} newCode - New code
 * @returns {Array<{added: boolean, removed: boolean, value: string, lineNumber: number}>} - Array of changes
 */
function analyzeDiff(oldCode, newCode) {
  // Use line by line diff
  const changes = diffLib.diffLines(oldCode, newCode);
  
  // Add line numbers to the changes
  let oldLineNumber = 0;
  let newLineNumber = 0;
  
  const detailedChanges = changes.map(change => {
    const currentOldLineNumber = oldLineNumber;
    const currentNewLineNumber = newLineNumber;
    
    // Update line numbers for next iteration
    if (!change.added) {
      oldLineNumber += (change.count || 0);
    }
    if (!change.removed) {
      newLineNumber += (change.count || 0);
    }
    
    return {
      added: change.added || false,
      removed: change.removed || false,
      value: change.value,
      oldLineNumber: !change.added ? currentOldLineNumber : null,
      newLineNumber: !change.removed ? currentNewLineNumber : null,
      lineCount: change.count || 0
    };
  });
  
  return detailedChanges;
}

/**
 * Creates a human-readable summary of the diff
 * @param {Array<{added: boolean, removed: boolean, value: string, oldLineNumber: number, newLineNumber: number}>} changes - Diff changes
 * @returns {string} - Human-readable diff summary
 */
function formatDiff(changes) {
  let formattedDiff = '';
  
  changes.forEach(change => {
    if (change.added) {
      formattedDiff += `\n+ Added at line ${change.newLineNumber}:\n`;
      formattedDiff += change.value.split('\n').map(line => {
        if (line.trim()) return `+  ${line}`;
        return '';
      }).join('\n');
    } else if (change.removed) {
      formattedDiff += `\n- Removed at line ${change.oldLineNumber}:\n`;
      formattedDiff += change.value.split('\n').map(line => {
        if (line.trim()) return `-  ${line}`;
        return '';
      }).join('\n');
    }
  });
  
  return formattedDiff;
}

/**
 * Generates a summary of what changed between two code versions
 * @param {string} oldCode - Original code
 * @param {string} newCode - New code
 * @returns {Object} - Object containing analysis details
 */
function analyzeCodeChanges(oldCode, newCode) {
  const changes = analyzeDiff(oldCode, newCode);
  const formattedDiff = formatDiff(changes);
  
  // Basic statistics about the changes
  const stats = {
    linesAdded: changes.filter(c => c.added).reduce((sum, c) => sum + c.lineCount, 0),
    linesRemoved: changes.filter(c => c.removed).reduce((sum, c) => sum + c.lineCount, 0),
    changeCount: changes.filter(c => c.added || c.removed).length
  };
  
  // Identify potentially risky changes
  const potentialRisks = [];
  
  // Check for commented out code
  changes.filter(c => c.added).forEach(change => {
    const lines = change.value.split('\n');
    if (lines.some(line => line.trim().startsWith('//'))) {
      potentialRisks.push('Added commented code');
    }
  });
  
  // Check for console statements
  changes.filter(c => c.added).forEach(change => {
    if (change.value.includes('console.log') || 
        change.value.includes('console.error') || 
        change.value.includes('console.warn')) {
      potentialRisks.push('Added console statements');
    }
  });
  
  return {
    changes,
    formattedDiff,
    stats,
    potentialRisks
  };
}

module.exports = {
  analyzeDiff,
  formatDiff,
  analyzeCodeChanges
};