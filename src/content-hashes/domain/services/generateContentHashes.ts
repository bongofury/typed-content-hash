import { Effect, fromEnv, Resume } from '@typed/fp'

import { ContentHash, Document, FilePath } from '../model'

export interface GenerateContentHashes {
  readonly generateContentHashes: (
    document: Document,
    hashLength?: number,
  ) => Resume<ReadonlyMap<FilePath, ContentHash>>
}

/**
 * Generate a mapping of a Document's FilePath to those with the computed content hash
 */
export const generateContentHashes = (
  contents: Document,
  hashLength?: number,
): Effect<GenerateContentHashes, ReadonlyMap<FilePath, ContentHash>> =>
  fromEnv((e: GenerateContentHashes) => e.generateContentHashes(contents, hashLength))