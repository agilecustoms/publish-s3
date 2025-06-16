import * as core from '@actions/core'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput, type ObjectIdentifier
} from '@aws-sdk/client-s3'
import { FileService } from './FileService'

export class FileUploader {
  private fileService: FileService
  private s3Client: S3Client

  constructor(fileService: FileService, s3Client: S3Client) {
    this.fileService = fileService
    this.s3Client = s3Client
  }

  public async upload(srcDir: string, bucket: string, bucketDir: string, rawVersions: string, tags: string = ''): Promise<void> {
    const versions = rawVersions.trim().split(',').map(v => v.trim())

    const uploadPromises = versions.map(version =>
      this.uploadDir(srcDir, bucket, bucketDir, tags)
    )
    await Promise.all(uploadPromises)
  }

  private async uploadDir(srcDir: string, bucket: string, bucketDir: string, tags: string = ''): Promise<void> {
    if (bucketDir.endsWith('/latest')) {
      await this.deleteObjectsInDir(bucket, bucketDir)
    }

    core.info(`Uploading ${srcDir}/* to ${bucket}/${bucketDir}${tags ? ` with tags ${tags}` : ''}`)

    const files = this.fileService.listFiles(srcDir)
    for (const file of files) {
      core.debug(`uploading ${file.name}`)
      const input: PutObjectCommandInput = {
        Bucket: bucket,
        Key: `${bucketDir}/${file.name}`,
        Body: this.fileService.readFile(file.fullPath),
        ContentType: file.contentType
      }
      if (tags.length > 0) {
        input.Tagging = tags
      }
      const output = await this.s3Client.send(new PutObjectCommand(input))
      const statusCode = output.$metadata.httpStatusCode
      if (statusCode !== 200) {
        throw new Error(`Failed to upload ${file}, status code: ${statusCode}`)
      }
    }
  }

  private async deleteObjectsInDir(bucket: string, bucketDir: string): Promise<void> {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: bucketDir
    })
    const listOutput = await this.s3Client.send(listCommand)
    let statusCode = listOutput.$metadata.httpStatusCode
    if (statusCode !== 200) {
      throw new Error(`Failed to list ${bucket}/${bucketDir}, status code: ${statusCode}`)
    }

    const contents = listOutput.Contents
    if (!contents) {
      return
    }
    const keysToDelete: ObjectIdentifier[] = contents.map(obj => ({ Key: obj.Key }))

    core.info(`Deleting files in ${bucket}/${bucketDir}`)

    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keysToDelete,
        Quiet: false
      }
    })
    const deleteOutput = await this.s3Client.send(deleteObjectsCommand)
    statusCode = deleteOutput.$metadata.httpStatusCode
    if (statusCode !== 200) {
      throw new Error(`Failed to delete ${bucket}/${bucketDir}, status code: ${statusCode}`)
    }
  }
}
