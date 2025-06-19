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

  async function listDir(prefix: string): Promise<{ Key?: string }[]> {
    const output = await s3Client.send(new ListObjectsV2Command({ ...myBucket, Prefix: prefix }))
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

  async function uploadDir(srcDir: string, bucketDir: string, service: string, versions: string[], devRelease: boolean = false): Promise<void> {
    const rawVersions = versions.join(' ')
    await fileUploader.upload(`${__dirname}/${srcDir}`, BUCKET_NAME, bucketDir, service, rawVersions, devRelease)
  }

  async function upload(srcDir: string, ...versions: string[]): Promise<void> {
    await uploadDir(srcDir, '', 'myservice', versions)
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
    await uploadDir('happy-path', '', 'myservice', [VERSION])
    await assertObject(`myservice/${VERSION}/test.txt`)
  })

  it('should upload single file in specified dir and one version', async () => {
    await uploadDir('happy-path', 'dir', 'myservice', [VERSION])
    await assertObject(`dir/myservice/${VERSION}/test.txt`)
  })

  it('should upload static assets with valid content types', async () => {
    await upload('static-assets', VERSION)

    const output = await s3Client.send(new ListObjectsV2Command(myBucket))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.KeyCount).toEqual(2)

    await assertCharset(`myservice/${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`myservice/${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload binary file', async () => {
    await upload('binary-files', VERSION)

    const binaryFile = await assertObject(`myservice/${VERSION}/helloworld.jar`)
    expect(binaryFile.ContentType).toEqual('application/java-archive')
  })

  it('should add tags for devRelease file with tags', async () => {
    const devRelease = true
    await uploadDir('happy-path', '', 'myservice', [VERSION], devRelease)

    const output = await s3Client.send(new GetObjectTaggingCommand({ ...myBucket, Key: `myservice/${VERSION}/test.txt` }))
    expect(output.$metadata.httpStatusCode).toEqual(200)
    expect(output.TagSet).toEqual([{ Key: 'Release', Value: 'false' }])
  })

  it('should upload files in two versions', async () => {
    await upload('happy-path', 'v1', 'latest')
    await assertObject(`myservice/v1/test.txt`)
    await assertObject(`myservice/latest/test.txt`)
  })

  it('should upload with charset: html, css. All others w/o charset', async () => {
    await upload('test-charset', VERSION)

    await assertCharset(`myservice/${VERSION}/app.js`, 'application/javascript')
    await assertCharset(`myservice/${VERSION}/desktop.png`, 'image/png')
    await assertCharset(`myservice/${VERSION}/index.html`, 'text/html; charset=utf-8')
    await assertCharset(`myservice/${VERSION}/openapi.json`, 'application/json')
    await assertCharset(`myservice/${VERSION}/styles.css`, 'text/css; charset=utf-8')
  })

  it('should upload files from nested dirs', async () => {
    await upload('nested', VERSION)

    await assertObject(`myservice/${VERSION}/index.html`)
    await assertObject(`myservice/${VERSION}/assets/index.js`)
  })

  it('should upload files from nested dirs to specified dir', async () => {
    await uploadDir('nested', 'the-dir', 'my-service', [VERSION])

    await assertObject(`the-dir/my-service/${VERSION}/index.html`)
    await assertObject(`the-dir/my-service/${VERSION}/assets/index.js`)
  })

  it('should upload files w/o extension', async () => {
    await upload('no-extension', VERSION)

    const output = await assertObject(`myservice/${VERSION}/file`)
    expect(output.ContentType).toEqual('application/octet-stream')
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

  describe('override', () => {
    it('should override object content', async () => {
      await upload('static-assets', VERSION)
      await upload('static-assets-override', VERSION)

      const indexHtml = await assertObject(`myservice/${VERSION}/index.html`)
      expect(indexHtml.ContentLength).toEqual('<html lang="en">override</html>'.length)
    })

    it('should delete old files', async () => {
      const version = 'latest'
      await upload('static-assets', version) // 2 objects: index.html, styles.css
      await upload('static-assets-override', version) // 1 object: index.html, styles.css suppose to be deleted

      const objects = await listDir(`myservice/${version}`)
      expect(objects.length).toBe(1)
      expect(objects[0]!!.Key).toBe(`myservice/${version}/index.html`)
    })

    it('should not call delete if all files are present in new upload', async () => {
      const version = 'latest'
      await upload('static-assets', version) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // 1 x list - to get existing objects
      // 0 x delete - to delete old objects, should not happen
      // 2 x put - to upload new objects
      await upload('static-assets-override-all', version) // 2 objects: index.html, styles.css

      expect(sendSpy).toHaveBeenCalledTimes(3) // list, put, put (no delete)
    })

    it('should not call delete if all files are present in new upload - edge case', async () => {
      await uploadDir('static-assets', 'release', 'my-app', ['1.2.4', '1.2']) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // 1 x list - to get existing objects
      // 0 x delete - to delete old objects, should not happen
      // 2 x put - to upload new objects
      await uploadDir('static-assets-override-all', 'release', 'my-app', ['1.2']) // 2 objects: index.html, styles.css

      // in this test case, I check that override of '1.2' does not delete objects in '1.2.4'
      expect(sendSpy).toHaveBeenCalledTimes(3) // list, put, put (no delete)
    })

    it('should delete only files missing in new upload', async () => {
      const version = 'latest'
      await upload('static-assets', version) // 2 objects: index.html, styles.css
      const sendSpy = vi.spyOn(s3Client, 'send')

      // upload calls s3Client.send 3 times:
      // list - to get existing objects
      // delete - to delete old objects
      // put - to upload new objects
      await upload('static-assets-override', version) // 1 object: index.html, styles.css suppose to be deleted

      // should not delete index.html
      const deleteCmd = sendSpy.mock.calls[1]!![0] as DeleteObjectsCommand
      const objects = deleteCmd.input.Delete!!.Objects!!
      expect(objects.length).toBe(1)
      expect(objects[0]!!.Key).toBe('myservice/latest/styles.css')
    })

    it('should delete only files missing in new upload - nested', async () => {
      const version = 'latest'
      await uploadDir('nested', 'dir', 'my-service', [version])

      const sendSpy = vi.spyOn(s3Client, 'send')
      await uploadDir('nested-override', 'dir', 'my-service', [version])

      // should not delete index.html
      const deleteCmd = sendSpy.mock.calls[1]!![0] as DeleteObjectsCommand
      const objects = deleteCmd.input.Delete!!.Objects!!
      expect(objects.length).toBe(2)
      const keys = objects.map(obj => obj.Key)
      expect(keys).toEqual([
        'dir/my-service/latest/assets/index.js.map',
        'dir/my-service/latest/robots.txt'
      ])
    })
  })

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  })
})
