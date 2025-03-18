import {
  CreateBucketCommand,
  DeleteObjectsCommand, GetObjectTaggingCommand, HeadObjectCommand, type HeadObjectCommandOutput,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'
import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FileService } from '../src/FileService'
import { FileUploader } from '../src/FileUploader'

const REGION = 'us-east-1'
const BUCKET_NAME = 'testcontainers'
const myBucket = { Bucket: BUCKET_NAME }
const BUCKET_DIR = 'v1'
const LOCALSTACK_CONTAINER_START_TIMEOUT = 60_000

function config(container: StartedLocalStackContainer): object {
  return {
    endpoint: container.getConnectionUri(),
    region: REGION,
    credentials: {
      secretAccessKey: 'test',
      accessKeyId: 'test',
    },
  }
}

describe('FileUploader', () => {
  let container: StartedLocalStackContainer
  let s3Client: S3Client
  let fileUploader: FileUploader

  async function listDir(key: string): Promise<object[]> {
    const output = await s3Client.send(new ListObjectsV2Command({ ...myBucket, Prefix: key }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    return output.Contents!!
  }

  async function headObject(key: string): Promise<HeadObjectCommandOutput> {
    const output = await s3Client.send(new HeadObjectCommand({ ...myBucket, Key: key }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    return output
  }

  async function assertCharset(key: string, expected: string): Promise<void> {
    const output = await headObject(key)
    expect(output.ContentType).toEqual(expected)
  }

  async function upload(srcDir: string, ...bucketDirs: string[]): Promise<void> {
    await fileUploader.upload(`${__dirname}/${srcDir}`, BUCKET_NAME, bucketDirs)
  }

  beforeAll(async () => {
    container = await new LocalstackContainer().start()
    s3Client = new S3Client({
      ...config(container),
      forcePathStyle: true,
      // retryMode: "standard",
      maxAttempts: 3, // when use colima (instead of Docker Desktop) you need up to 10 retries :(
    })

    // create infrastructure that is normally created by Terraform / CloudFormation
    const command = new CreateBucketCommand(myBucket)
    const createBucketResponse = await s3Client.send(command)
    expect(createBucketResponse.$metadata.httpStatusCode).toEqual(200)

    // create SUT (system under test)
    const fileService = new FileService()
    fileUploader = new FileUploader(fileService, s3Client)
  }, LOCALSTACK_CONTAINER_START_TIMEOUT)

  beforeEach(async () => {
    const listOutput = await s3Client.send(new ListObjectsV2Command(myBucket))
    expect(listOutput.$metadata.httpStatusCode).toEqual(200)
    if (listOutput.KeyCount === 0 || !listOutput.Contents) return
    const keys: { Key: string }[] = listOutput.Contents.map(content => ({ Key: content.Key!! }))
    const deleteOutput = await s3Client.send(new DeleteObjectsCommand({ ...myBucket, Delete: { Objects: keys } }))
    expect(deleteOutput.$metadata.httpStatusCode).toEqual(200)
  })

  it('should upload 1) static assets; 2) with valid content types; 3) to specified bucket dir', async () => {
    await upload('static-assets', BUCKET_DIR)

    const output = await s3Client.send(new ListObjectsV2Command(myBucket))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.KeyCount).toEqual(2)

    await assertCharset(`${BUCKET_DIR}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`${BUCKET_DIR}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload binary file', async () => {
    await upload('binary-files', BUCKET_DIR)

    const binaryFile = await headObject(`${BUCKET_DIR}/helloworld.jar`)
    expect(binaryFile.ContentType).toEqual('application/java-archive')
  })

  it('should upload file with tags', async () => {
    const srcDir = `${__dirname}/static-assets`
    const tags = 'Release=false&tag2=1.1'

    await fileUploader.upload(srcDir, BUCKET_NAME, [BUCKET_DIR], tags)

    const output = await s3Client.send(new GetObjectTaggingCommand({ ...myBucket, Key: `${BUCKET_DIR}/index.html` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.TagSet).toEqual([{ Key: 'Release', Value: 'false' }, { Key: 'tag2', Value: '1.1' }])
  })

  it('should override object', async () => {
    await upload('static-assets', BUCKET_DIR)
    await upload('override', BUCKET_DIR)

    const indexHtml = await headObject(`${BUCKET_DIR}/index.html`)
    expect(indexHtml.ContentLength).toEqual('<html lang="en">override</html>'.length)
  })

  it('should upload files in two dirs', async () => {
    await upload('static-assets', 'v1', 'latest')

    await assertCharset(`v1/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`v1/styles.css`, 'text/css; charset=utf-8')

    await assertCharset(`latest/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`latest/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload with charset: html, css. All others w/o charset', async () => {
    await upload('test-charset', BUCKET_DIR)

    await assertCharset(`${BUCKET_DIR}/app.js`, 'application/javascript')
    await assertCharset(`${BUCKET_DIR}/desktop.png`, 'image/png')
    await assertCharset(`${BUCKET_DIR}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`${BUCKET_DIR}/openapi.json`, 'application/json')
    await assertCharset(`${BUCKET_DIR}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload files from nested dirs', async () => {
    await upload('nested', BUCKET_DIR)

    await assertCharset(`${BUCKET_DIR}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`${BUCKET_DIR}/assets/index.js`, 'application/javascript')
  })

  it('should fail if source dir does not exist', async () => {
    try {
      await upload('non-existing', BUCKET_DIR)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('ENOENT')
      return
    }
    throw new Error('should never reach here')
  })

  it('should fail if source-dir points to a file', async () => {
    try {
      await upload('test-file', BUCKET_DIR)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('NOTDIR')
      return
    }
    throw new Error('should never reach here')
  })

  it('should delete old files when re-upload in /latest dir', async () => {
    const dir = 'service/latest'
    await upload('static-assets', dir) // 2 objects: index.html, styles.css
    await upload('override', dir) // 1 object: index.html, styles.css suppose to be deleted

    const objects = await listDir(dir)
    expect(objects.length).toBe(1)
  })

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  })
})
