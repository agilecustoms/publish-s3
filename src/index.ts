import * as core from '@actions/core'
import { ExitCode } from '@actions/core'
import { S3Client } from '@aws-sdk/client-s3'
import { FileService } from './FileService'
import { FileUploader } from './FileUploader'

const accessKeyId: string = core.getInput('access-key-id', { required: true })
const secretAccessKey: string = core.getInput('secret-access-key', { required: true })
const sessionToken: string = core.getInput('session-token', { required: true })
const bucket: string = core.getInput('bucket', { required: true })
const bucketDir: string = core.getInput('bucket-dir', { required: false })
const devRelease: boolean = core.getBooleanInput('dev-release', { required: false })
const versions: string = core.getInput('versions', { required: true })

const githubRepository = process.env.GITHUB_REPOSITORY
const repoName = githubRepository!.split('/')[1]!

const fileService = new FileService()
const s3Client = new S3Client({
  credentials: {
    secretAccessKey,
    accessKeyId,
    sessionToken
  },
})
const fileUploader = new FileUploader(fileService, s3Client)

fileUploader.upload('s3', bucket, bucketDir, repoName, versions, devRelease)
  .then(() => core.info('Upload completed'))
  .catch((error) => {
    core.error('Upload failed..')
    core.error(error)
    process.exitCode = ExitCode.Failure
  })
