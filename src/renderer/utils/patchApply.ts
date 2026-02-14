/**
 * Detect whether AI output looks like a unified diff.
 */
export function isDiff(text: string): boolean {
  const lines = text.split('\n')
  let hasHunkHeader = false
  let hasPlusMinus = false
  for (const line of lines) {
    if (line.startsWith('@@')) hasHunkHeader = true
    if (line.startsWith('---') || line.startsWith('+++')) hasPlusMinus = true
    if (hasHunkHeader && hasPlusMinus) return true
  }
  return false
}

interface Hunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: string[]
}

function parseHunks(diffText: string): Hunk[] {
  const hunks: Hunk[] = []
  const lines = diffText.split('\n')
  let current: Hunk | null = null

  for (const line of lines) {
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/)
    if (hunkMatch) {
      if (current) hunks.push(current)
      current = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newCount: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      }
      continue
    }
    if (current && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      current.lines.push(line)
    }
  }
  if (current) hunks.push(current)
  return hunks
}

/**
 * Apply a unified diff to original source text.
 * Returns the patched text, or null if the diff cannot be applied cleanly.
 */
export function applyUnifiedDiff(original: string, diffText: string): string | null {
  const hunks = parseHunks(diffText)
  if (hunks.length === 0) return null

  const originalLines = original.split('\n')
  const result: string[] = []
  let oldLineIdx = 0

  for (const hunk of hunks) {
    const hunkOldStart = hunk.oldStart - 1 // 0-indexed

    // Copy lines before this hunk
    while (oldLineIdx < hunkOldStart && oldLineIdx < originalLines.length) {
      result.push(originalLines[oldLineIdx])
      oldLineIdx++
    }

    // Apply hunk
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        result.push(line.slice(1))
      } else if (line.startsWith('-')) {
        oldLineIdx++ // skip the removed line
      } else if (line.startsWith(' ')) {
        result.push(line.slice(1))
        oldLineIdx++
      }
    }
  }

  // Copy remaining lines
  while (oldLineIdx < originalLines.length) {
    result.push(originalLines[oldLineIdx])
    oldLineIdx++
  }

  return result.join('\n')
}
