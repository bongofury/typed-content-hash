import { pipe } from 'fp-ts/lib/function'
import { chain, Option, option } from 'fp-ts/lib/Option'

import { DocumentRegistry } from '../../application/model'
import { Document, DocumentHash } from '../../domain/model'

export const getContentHash = (document: Document, registry: DocumentRegistry, hashLength: number): Option<string> =>
  pipe(
    document.contentHash,
    chain((hash: DocumentHash) => {
      switch (hash.type) {
        case 'hash':
          return option.of(hash.hash.slice(0, hashLength))
        case 'hashFor':
          return getContentHash(registry.get(hash.filePath)!, registry, hashLength)
      }
    }),
  )
