import * as core from '@actions/core'
import { ExitCode } from '@actions/core'
import { S3Client } from '@aws-sdk/client-s3'
import { FileService } from './FileService'
import { FileUploader } from './FileUploader'

const accessKeyId: string = core.getInput('access-key-id', { required: true })
const secretAccessKey: string = core.getInput('secret-access-key', { required: true })
const sessionToken: string = core.getInput('session-token', { required: true })
const sourceDir: string = core.getInput('source-dir', { required: true })
const bucket: string = core.getInput('bucket', { required: true })
const bucketDir: string = core.getInput('bucket-dir', { required: true })
const tags = core.getInput('tags', { trimWhitespace: true })

const bucketDirs = bucketDir.trim().split(',').map(dir => dir.trim())

const fileService = new FileService()
const s3Client = new S3Client({
  credentials: {
    secretAccessKey,
    accessKeyId,
    sessionToken
  },
})
const fileUploader = new FileUploader(fileService, s3Client)

fileUploader.upload(sourceDir, bucket, bucketDirs, tags)
  .then(() => core.info('Upload completed'))
  .catch((error) => {
    core.error('Upload failed')
    core.error(error)
    console.error(error) // TODO: remove?
    process.exitCode = ExitCode.Failure
  })
