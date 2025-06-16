import {
  CreateBucketCommand,
  DeleteObjectsCommand, GetObjectTaggingCommand, HeadObjectCommand, type HeadObjectCommandOutput,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'
import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileService } from '../src/FileService'
import { FileUploader } from '../src/FileUploader'

const REGION = 'us-east-1'
const BUCKET_NAME = 'testcontainers'
const myBucket = { Bucket: BUCKET_NAME }
const VERSION = 'v1'
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

  async function assertObject(key: string): Promise<HeadObjectCommandOutput> {
    // throw error if key does not exist
    const output = await s3Client.send(new HeadObjectCommand({ ...myBucket, Key: key }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    return output
  }

  async function assertCharset(key: string, expected: string): Promise<void> {
    const output = await assertObject(key)
    expect(output.ContentType).toEqual(expected)
  }

  async function uploadDir(srcDir: string, bucketDir: string, versions: string[], tags: string = ''): Promise<void> {
    const rawVersions = versions.join(' ')
    await fileUploader.upload(`${__dirname}/${srcDir}`, BUCKET_NAME, bucketDir, rawVersions, tags)
  }

  async function upload(srcDir: string, ...versions: string[]): Promise<void> {
    await uploadDir(srcDir, '', versions)
  }

  beforeAll(async () => {
    container = await new LocalstackContainer('localstack/localstack:latest').start()
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

  it('should upload single file in empty dir and one version', async () => {
    await uploadDir('happy-path', '', [VERSION])
    await assertObject(`${VERSION}/test.txt`)
  })

  it('should upload single file in specified dir and one version', async () => {
    await uploadDir('happy-path', 'my-service', [VERSION])
    await assertObject(`my-service/${VERSION}/test.txt`)
  })

  it('should upload static assets with valid content types', async () => {
    await upload('static-assets', VERSION)

    const output = await s3Client.send(new ListObjectsV2Command(myBucket))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.KeyCount).toEqual(2)

    await assertCharset(`${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload binary file', async () => {
    await upload('binary-files', VERSION)

    const binaryFile = await assertObject(`${VERSION}/helloworld.jar`)
    expect(binaryFile.ContentType).toEqual('application/java-archive')
  })

  it('should upload file with tags', async () => {
    const tags = 'Release=false&tag2=1.1'

    await uploadDir('happy-path', '', [VERSION], tags)

    const output = await s3Client.send(new GetObjectTaggingCommand({ ...myBucket, Key: `${VERSION}/test.txt` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.TagSet).toEqual([{ Key: 'Release', Value: 'false' }, { Key: 'tag2', Value: '1.1' }])
  })

  it('should override object', async () => {
    await upload('static-assets', VERSION)
    await upload('override', VERSION)

    const indexHtml = await assertObject(`${VERSION}/index.html`)
    expect(indexHtml.ContentLength).toEqual('<html lang="en">override</html>'.length)
  })

  it('should upload files in two versions', async () => {
    await upload('happy-path', 'v1', 'latest')
    await assertObject(`v1/test.txt`)
    await assertObject(`latest/test.txt`)
  })

  it('should upload with charset: html, css. All others w/o charset', async () => {
    await upload('test-charset', VERSION)

    await assertCharset(`${VERSION}/app.js`, 'application/javascript')
    await assertCharset(`${VERSION}/desktop.png`, 'image/png')
    await assertCharset(`${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`${VERSION}/openapi.json`, 'application/json')
    await assertCharset(`${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload files from nested dirs', async () => {
    await upload('nested', VERSION)

    await assertObject(`${VERSION}/index.html`)
    await assertObject(`${VERSION}/assets/index.js`)
  })

  it('should upload files from nexted dirs to specified dir', async () => {
    await uploadDir('nested', 'my-service', [VERSION])

    await assertObject(`my-service/${VERSION}/index.html`)
    await assertObject(`my-service/${VERSION}/assets/index.js`)
  })

  it('should fail if source dir does not exist', async () => {
    try {
      await upload('non-existing', VERSION)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('ENOENT')
      return
    }
    throw new Error('should never reach here')
  })

  it('should fail if source-dir points to a file', async () => {
    try {
      await upload('test-file', VERSION)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('NOTDIR')
      return
    }
    throw new Error('should never reach here')
  })

  it('should delete old files when re-upload in /latest dir', async () => {
    const version = 'latest'
    await upload('static-assets', version) // 2 objects: index.html, styles.css
    await upload('override', version) // 1 object: index.html, styles.css suppose to be deleted

    const objects = await listDir(version)
    expect(objects.length).toBe(1)
    expect(objects[0].Key).toBe(`${version}/index.html`)
  })

  it('when re-upload files, should delete only files missing in new upload', async () => {
    const version = 'latest'
    await upload('static-assets', version) // 2 objects: index.html, styles.css
    const sendSpy = vi.spyOn(s3Client, 'send')

    // upload calls s3Client.send 3 times:
    // list - to get existing objects
    // delete - to delete old objects
    // put - to upload new objects
    await upload('override', version) // 1 object: index.html, styles.css suppose to be deleted

    // should not delete index.html
    const deleteCmd: DeleteObjectsCommand = sendSpy.mock.calls[1][0]
    const objects = deleteCmd.input.Delete!!.Objects!!
    expect(objects.length).toBe(1)
    expect(objects[0]!!.Key).toBe('latest/styles.css')
  })

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  })
})
