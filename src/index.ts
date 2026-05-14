import * as core from '@actions/core'
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3'
import { FileService } from './FileService'
import { FileUploader } from './FileUploader'

const accessKeyId: string = core.getInput('access-key-id', { required: true })
const awsRegion: string = core.getInput('aws-region', { required: false })
const bucket: string = core.getInput('bucket', { required: true })
const bucketDir: string = core.getInput('bucket-dir', { required: false })
const devRelease: boolean = core.getInput('dev-release', { required: false }) === 'true'
const secretAccessKey: string = core.getInput('secret-access-key', { required: true })
const sessionToken: string = core.getInput('session-token', { required: true })
const versions: string = core.getInput('versions', { required: true })

const githubRepository = process.env.GITHUB_REPOSITORY
const repoName = githubRepository!.split('/')[1]!

const fileService = new FileService()
const s3Config: S3ClientConfig = {
  credentials: {
    secretAccessKey,
    accessKeyId,
    sessionToken
  },
}
if (awsRegion) {
  s3Config.region = awsRegion
}
const s3Client = new S3Client(s3Config)
const fileUploader = new FileUploader(fileService, s3Client)

fileUploader.upload('s3', bucket, bucketDir, repoName, versions, devRelease)
  .catch(core.setFailed)
