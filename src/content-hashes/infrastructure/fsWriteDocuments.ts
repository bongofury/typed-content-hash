import { RawSourceMap } from '@ampproject/remapping/dist/types/types'
import { doEffect, fromTask, map, zip } from '@typed/fp'
import { constVoid } from 'fp-ts/lib/function'
import { promises } from 'fs'

import { DocumentRegistry } from '../application/model'
import { getHashedPath } from './hashes/getHashedPath'
import { replaceHash } from './hashes/replaceHash'

const writeFile = (path: string, contents: string) => fromTask(() => promises.writeFile(path, contents))
const rename = (from: string, to: string) => fromTask(() => promises.rename(from, to))
const unlinkFile = (path: string) => fromTask(() => promises.unlink(path))
const sourceMapExt = '.map'
const sourceMapExtRegex = new RegExp(`${sourceMapExt}$`)

export const fsWriteDocuments = (registry: DocumentRegistry, hashLength: number) =>
  map(
    constVoid,
    zip(
      Array.from(registry.values()).map((document) =>
        doEffect(function* () {
          const hashedPath = getHashedPath(document, registry, hashLength)
          const pathChanged = document.filePath !== hashedPath

          if (hashedPath.endsWith(sourceMapExt) && pathChanged) {
            const raw = JSON.parse(document.contents) as RawSourceMap

            if (raw.file) {
              const extension = document.fileExtension.replace(sourceMapExtRegex, '')
              const parts = hashedPath.replace(new RegExp(`${document.fileExtension}$`), '').split(/\./g)
              const hash = parts[parts.length - 1]

              document = {
                ...document,
                contents: JSON.stringify({ ...raw, file: replaceHash(raw.file, extension, hash) }, null, 2),
              }
            }
          }

          if (!document.isBase64Encoded && pathChanged) {
            yield* unlinkFile(document.filePath)
          }

          if (!document.isBase64Encoded) {
            yield* writeFile(hashedPath, document.contents)
          }

          if (document.isBase64Encoded && pathChanged) {
            yield* rename(document.filePath, hashedPath)
          }
        }),
      ),
    ),
  )