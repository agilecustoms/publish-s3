import {
  CreateBucketCommand,
  DeleteObjectsCommand, GetObjectTaggingCommand, HeadObjectCommand, type HeadObjectCommandOutput,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'
import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

type Ctx = {
  prefix: string
  s3Client: S3Client
  fileUploader: FileUploader
}

describe('FileUploader', () => {
  let container: StartedLocalStackContainer
  let s3Client: S3Client
  let fileUploader: FileUploader

  async function listDir(ctx: Ctx, prefix: string): Promise<{ Key?: string }[]> {
    const output = await ctx.s3Client.send(new ListObjectsV2Command({ ...myBucket, Prefix: `${ctx.prefix}/${prefix}` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    return output.Contents!!
  }

  async function assertObject(ctx: Ctx, key: string): Promise<HeadObjectCommandOutput> {
    // throw error if key does not exist
    const output = await s3Client.send(new HeadObjectCommand({ ...myBucket, Key: `${ctx.prefix}/${key}` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    return output
  }

  async function assertCharset(ctx: Ctx, key: string, expected: string): Promise<void> {
    const output = await assertObject(ctx, key)
    expect(output.ContentType).toEqual(expected)
  }

  async function uploadDir(ctx: Ctx, srcDir: string, bucketDir: string, service: string, versions: string[], devRelease: boolean = false): Promise<void> {
    const rawVersions = versions.join(' ')
    await fileUploader.upload(`${__dirname}/${srcDir}`, BUCKET_NAME, `${ctx.prefix}/${bucketDir}`, service, rawVersions, devRelease)
  }

  async function upload(ctx: Ctx, srcDir: string, ...versions: string[]): Promise<void> {
    await uploadDir(ctx, srcDir, '', 'myservice', versions)
  }

  beforeAll(async () => {
    container = await new LocalstackContainer('localstack/localstack:latest').start()
    const s3Client = new S3Client({
      ...config(container),
      forcePathStyle: true,
      // retryMode: "standard",
      maxAttempts: 3, // when use colima (instead of Docker Desktop) you need up to 10 retries :(
    })

    // create infrastructure that is normally created by Terraform / CloudFormation
    const command = new CreateBucketCommand(myBucket)
    const createBucketResponse = await s3Client.send(command)
    expect(createBucketResponse.$metadata.httpStatusCode).toEqual(200)
  }, LOCALSTACK_CONTAINER_START_TIMEOUT)

  let id = 0

  function create(): Ctx {
    id++
    s3Client = new S3Client({
      ...config(container),
      forcePathStyle: true,
      // retryMode: "standard",
      maxAttempts: 3, // when use colima (instead of Docker Desktop) you need up to 10 retries :(
    })
    // create SUT (system under test)
    const fileService = new FileService()
    fileUploader = new FileUploader(fileService, s3Client)
    return {
      prefix: `${id}`,
      s3Client,
      fileUploader
    }
  }

  it('should upload single file in empty dir and one version', async () => {
    const ctx = create()
    await uploadDir(ctx, 'happy-path', '', 'myservice', [VERSION])
    await assertObject(ctx, `myservice/${VERSION}/test.txt`)
  })

  it('should upload single file in specified dir and one version', async () => {
    const ctx = create()
    await uploadDir(ctx, 'happy-path', 'dir', 'myservice', [VERSION])
    await assertObject(ctx, `dir/myservice/${VERSION}/test.txt`)
  })

  it('should upload static assets with valid content types', async () => {
    const ctx = create()
    await upload(ctx, 'static-assets', VERSION)

    const output = await s3Client.send(new ListObjectsV2Command({ ...myBucket, Prefix: `${ctx.prefix}/` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.KeyCount).toEqual(2)

    await assertCharset(ctx, `myservice/${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(ctx, `myservice/${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload binary file', async () => {
    const ctx = create()
    await upload(ctx, 'binary-files', VERSION)

    const binaryFile = await assertObject(ctx, `myservice/${VERSION}/helloworld.jar`)
    expect(binaryFile.ContentType).toEqual('application/java-archive')
  })

  it('should add tag Release=true for release', async () => {
    const ctx = create()
    const devRelease = false
    await uploadDir(ctx, 'happy-path', '', 'myservice', [VERSION], devRelease)

    const output = await s3Client.send(new GetObjectTaggingCommand({ ...myBucket, Key: `${ctx.prefix}/myservice/${VERSION}/test.txt` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.TagSet).toEqual([{ Key: 'Release', Value: 'true' }])
  })

  it('should add tag Release=false for dev-release', async () => {
    const ctx = create()
    const devRelease = true
    await uploadDir(ctx, 'happy-path', '', 'myservice', [VERSION], devRelease)

    const output = await s3Client.send(new GetObjectTaggingCommand({ ...myBucket, Key: `${ctx.prefix}/myservice/${VERSION}/test.txt` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.TagSet).toEqual([{ Key: 'Release', Value: 'false' }])
  })

  it('should upload files in two versions', async () => {
    const ctx = create()
    await upload(ctx, 'happy-path', 'v1', 'latest')
    await assertObject(ctx, `myservice/v1/test.txt`)
    await assertObject(ctx, `myservice/latest/test.txt`)
  })

  it('should upload with charset: html, css. All others w/o charset', async () => {
    const ctx = create()
    await upload(ctx, 'test-charset', VERSION)

    await assertCharset(ctx, `myservice/${VERSION}/app.js`, 'application/javascript')
    await assertCharset(ctx, `myservice/${VERSION}/desktop.png`, 'image/png')
    await assertCharset(ctx, `myservice/${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(ctx, `myservice/${VERSION}/openapi.json`, 'application/json')
    await assertCharset(ctx, `myservice/${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload files from nested dirs', async () => {
    const ctx = create()
    await upload(ctx, 'nested', VERSION)

    await assertObject(ctx, `myservice/${VERSION}/index.html`)
    await assertObject(ctx, `myservice/${VERSION}/assets/index.js`)
  })

  it('should upload files from nested dirs to specified dir', async () => {
    const ctx = create()
    await uploadDir(ctx, 'nested', 'the-dir', 'my-service', [VERSION])

    await assertObject(ctx, `the-dir/my-service/${VERSION}/index.html`)
    await assertObject(ctx, `the-dir/my-service/${VERSION}/assets/index.js`)
  })

  it('should upload files w/o extension', async () => {
    const ctx = create()
    await upload(ctx, 'no-extension', VERSION)

    const output = await assertObject(ctx, `myservice/${VERSION}/file`)
    expect(output.ContentType).toEqual('application/octet-stream')
  })

  it('should fail if source dir does not exist', async () => {
    const ctx = create()
    try {
      await upload(ctx, 'non-existing', VERSION)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('ENOENT')
      return
    }
    throw new Error('should never reach here')
  })

  it('should fail if source-dir points to a file', async () => {
    const ctx = create()
    try {
      await upload(ctx, 'test-file', VERSION)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(e.message).toContain('NOTDIR')
      return
    }
    throw new Error('should never reach here')
  })

  describe('override', () => {
    it('should override object content', async () => {
      const ctx = create()
      await upload(ctx, 'static-assets', VERSION)
      await upload(ctx, 'static-assets-override', VERSION)

      const indexHtml = await assertObject(ctx, `myservice/${VERSION}/index.html`)
      expect(indexHtml.ContentLength).toEqual('<html lang="en">override</html>'.length)
    })

    it('should delete old files', async () => {
      const ctx = create()
      const version = 'latest'
      await upload(ctx, 'static-assets', version) // 2 objects: index.html, styles.css
      await upload(ctx, 'static-assets-override', version) // 1 object: index.html, styles.css suppose to be deleted

      const objects = await listDir(ctx, `myservice/${version}`)
      expect(objects.length).toBe(1)
      expect(objects[0]!!.Key).toBe(`${ctx.prefix}/myservice/${version}/index.html`)
    })

    it('should not call delete if all files are present in new upload', async () => {
      const ctx = create()
      const version = 'latest'
      await upload(ctx, 'static-assets', version) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // 1 x list - to get existing objects
      // 0 x delete - to delete old objects, should not happen
      // 2 x put - to upload new objects
      await upload(ctx, 'static-assets-override-all', version) // 2 objects: index.html, styles.css

      expect(sendSpy).toHaveBeenCalledTimes(3) // list, put, put (no delete)
    })

    it('should not call delete if all files are present in new upload - edge case', async () => {
      const ctx = create()
      await uploadDir(ctx, 'static-assets', 'release', 'my-app', ['1.2.4', '1.2']) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // 1 x list - to get existing objects
      // 0 x delete - to delete old objects, should not happen
      // 2 x put - to upload new objects
      await uploadDir(ctx, 'static-assets-override-all', 'release', 'my-app', ['1.2']) // 2 objects: index.html, styles.css

      // in this test case, I check that override of '1.2' does not delete objects in '1.2.4'
      expect(sendSpy).toHaveBeenCalledTimes(3) // list, put, put (no delete)
    })

    it('should delete only files missing in new upload', async () => {
      const ctx = create()
      const version = 'latest'
      await upload(ctx, 'static-assets', version) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // list - to get existing objects
      // delete - to delete old objects
      // put - to upload new objects
      await upload(ctx, 'static-assets-override', version) // 1 object: index.html, styles.css suppose to be deleted

      // should not delete index.html
      const deleteCmd = sendSpy.mock.calls[1]!![0] as DeleteObjectsCommand
      const objects = deleteCmd.input.Delete!!.Objects!!
      expect(objects.length).toBe(1)
      expect(objects[0]!!.Key).toBe(`${ctx.prefix}/myservice/latest/styles.css`)
    })

    it('should delete only files missing in new upload - nested', async () => {
      const ctx = create()
      const version = 'latest'
      await uploadDir(ctx, 'nested', 'dir', 'my-service', [version])

      const sendSpy = vi.spyOn(s3Client, 'send')
      await uploadDir(ctx, 'nested-override', 'dir', 'my-service', [version])

      // should not delete index.html
      const deleteCmd = sendSpy.mock.calls[1]!![0] as DeleteObjectsCommand
      const objects = deleteCmd.input.Delete!!.Objects!!
      expect(objects.length).toBe(2)
      const keys = objects.map(obj => obj.Key)
      expect(keys).toEqual([
        `${ctx.prefix}/dir/my-service/latest/assets/index.js.map`,
        `${ctx.prefix}/dir/my-service/latest/robots.txt`
      ])
    })
  })

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  })
})
