import remapping from '@ampproject/remapping'
import { ask, doEffect } from '@typed/fp'
import { pipe } from 'fp-ts/lib/function'
import { fold, isNone, none, some } from 'fp-ts/lib/Option'
import MagicString from 'magic-string'
import { basename, extname } from 'path'

import { DocumentRegistryEnv } from '../application/model'
import { Document, DocumentHash } from '../domain/model'
import { sha512Hash } from './sha512Hash'

const sourceMapExt = '.map'

const rewriteContentHash = (document: Document) =>
  pipe(
    document.contentHash,
    fold(
      () => document,
      (hash) => ({
        ...document,
        contentHash: some(
          hash.type === 'hash' ? ({ type: 'hash', hash: sha512Hash(document.contents) } as DocumentHash) : hash,
        ),
      }),
    ),
  )

const remapSourceMaps = (current: Document, updated: Document): Document => ({
  ...updated,
  contentHash: current.contentHash,
  contents: JSON.stringify(JSON.parse(remapping([updated.contents, current.contents], () => null).toString()), null, 2),
})

export function rewriteDocumentContents(document: Document, f: (magicString: MagicString) => void) {
  return doEffect(function* () {
    const { documentRegistry } = yield* ask<DocumentRegistryEnv>()

    const { filePath, contents, sourceMap, isBase64Encoded } = document
    const filename = basename(filePath)
    const ext = extname(filename)

    // We don't rewrite source maps or base64 encoded documents
    if (ext === sourceMapExt || isBase64Encoded) {
      return documentRegistry
    }

    const magicString = new MagicString(contents, {
      filename,
      indentExclusionRanges: [],
    })

    f(magicString)

    const updatedContents = magicString.toString()
    const updatedDocument: Document = rewriteContentHash({
      ...document,
      contents: updatedContents,
    })
    const updatedRegistry = new Map([...documentRegistry, [filePath, updatedDocument]])

    if (isNone(sourceMap)) {
      return updatedRegistry
    }

    const sourceMapPath = sourceMap.value
    const updatedSourceMapContents = JSON.parse(
      magicString
        .generateMap({ hires: true, file: filename, source: magicString.original, includeContent: true })
        .toString(),
    )
    const updatedSourceMap: Document = {
      filePath: sourceMapPath,
      fileExtension: document.fileExtension + sourceMapExt,
      contents: updatedSourceMapContents,
      contentHash: some({ type: 'hashFor', filePath: document.filePath }),
      dependencies: [],
      sourceMap: none,
      isBase64Encoded: false,
    }
    const currentSourceMap = documentRegistry.get(sourceMapPath)

    return new Map([
      ...updatedRegistry,
      [sourceMapPath, currentSourceMap ? remapSourceMaps(currentSourceMap, updatedSourceMap) : updatedSourceMap],
    ])
  })
}
