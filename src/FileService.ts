import fs from 'node:fs'
import mime from 'mime-types'

export class FileService {
  public listFiles(dir: string): FileInfo[] {
    const fileInfos: FileInfo[] = []
    const relativeFilePaths: string[] = fs.readdirSync(dir, { recursive: true }) as string[]
    for (const relativePath of relativeFilePaths) {
      const fullPath = `${dir}/${relativePath}`
      if (!fs.statSync(fullPath).isFile()) continue

      const contentType = this.getContentType(fullPath)
      fileInfos.push({
        relativePath,
        contentType
      })
    }
    return fileInfos
  }

  private getContentType(filePath: string): string | undefined {
    let contentType = mime.lookup(filePath)
    if (contentType === false) {
      return undefined
    }
    if (contentType.startsWith('text/')) {
      contentType = mime.contentType(contentType)
      if (contentType === false) {
        return undefined
      }
    }
    return contentType
  }

  /**
   * Wrapper around fs.readFileSync to make it easier to mock
   * @param filePath
   */
  public readFile(filePath: string): Buffer {
    return fs.readFileSync(filePath)
  }
}

export type FileInfo = {
  relativePath: string
  contentType?: string
  content?: Buffer
}
