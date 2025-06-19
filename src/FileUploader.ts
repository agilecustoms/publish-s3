import * as core from '@actions/core'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput, type ObjectIdentifier
} from '@aws-sdk/client-s3'
import type { MetadataBearer } from '@smithy/types/dist-types/response'
import { type FileInfo, FileService } from './FileService'

export class FileUploader {
  private fileService: FileService
  private s3Client: S3Client

  constructor(fileService: FileService, s3Client: S3Client) {
    this.fileService = fileService
    this.s3Client = s3Client
  }

  public async upload(srcDir: string, bucket: string, bucketDir: string, service: string, rawVersions: string, devRelease: boolean): Promise<void> {
    const versions = rawVersions.trim().split(' ').map(v => v.trim())
    if (bucketDir && !bucketDir.endsWith('/')) {
      bucketDir += '/'
    }

    const tags = devRelease ? 'Release=false' : 'Release=true'
    const files = this.fileService.listFiles(srcDir)
    const uploadPromises = versions.map(version =>
      this.uploadDir(srcDir, files, bucket, `${bucketDir}${service}/${version}`, tags)
    )
    await Promise.all(uploadPromises)
  }

  private async uploadDir(srcDir: string, files: FileInfo[], bucket: string, bucketDir: string, tags: string = ''): Promise<void> {
    await this.deleteObjectsInDir(files, bucket, bucketDir)

    core.info(`Uploading ${srcDir}/* to ${bucket}/${bucketDir}${tags ? ` with tags ${tags}` : ''}`)

    for (const file of files) {
      core.debug(`uploading ${file.relativePath}`)
      if (!file.content) {
        const filePath = `${srcDir}/${file.relativePath}`
        file.content = this.fileService.readFile(filePath)
      }
      const input: PutObjectCommandInput = {
        Bucket: bucket,
        Key: `${bucketDir}/${file.relativePath}`,
        Body: file.content,
        ContentType: file.contentType
      }
      if (tags.length > 0) {
        input.Tagging = tags
      }
      const output = await this.s3Client.send(new PutObjectCommand(input))
      this.assertStatusCode(output, `Failed to upload ${file}`)
    }
  }

  private async deleteObjectsInDir(newFiles: FileInfo[], bucket: string, bucketDir: string): Promise<void> {
    const prefix = `${bucketDir}/`
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    })
    const listOutput = await this.s3Client.send(listCommand)
    this.assertStatusCode(listOutput, `Failed to list ${bucket}/${bucketDir}`)

    const contents = listOutput.Contents
    if (!contents) {
      return
    }
    const prefixLength = prefix.length
    const newFilesSet = new Set(newFiles.map(file => file.relativePath))
    const keysToDelete: ObjectIdentifier[] = contents
      .filter((obj) => {
        const fileName = obj.Key!.substring(prefixLength) // turn service/latest/index.html into index.html
        return !newFilesSet.has(fileName)
      })
      .map(obj => ({ Key: obj.Key }))
    if (keysToDelete.length === 0) {
      return
    }

    core.info(`Deleting ${keysToDelete.length} files in ${bucket}/${bucketDir}`)

    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keysToDelete,
        Quiet: false
      }
    })
    const deleteOutput = await this.s3Client.send(deleteObjectsCommand)
    this.assertStatusCode(deleteOutput, `Failed to delete ${bucket}/${bucketDir}`)
  }

  private assertStatusCode(output: MetadataBearer, message: string): void {
    const statusCode = output.$metadata.httpStatusCode
    if (statusCode !== 200) {
      throw new Error(`${message}, status code: ${statusCode}`)
    }
  }
}
