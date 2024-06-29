import {LocalstackContainer, StartedLocalStackContainer} from "@testcontainers/localstack";
import {
    CreateBucketCommand,
    DeleteObjectsCommand, GetObjectTaggingCommand, HeadObjectCommand, HeadObjectCommandOutput,
    ListObjectsV2Command,
    S3Client
} from "@aws-sdk/client-s3";
import {FileUploader} from "/FileUploader";
import {FileService} from "/FileService";

const REGION = "us-east-1";
const BUCKET_NAME = "testcontainers";
const myBucket = {Bucket: BUCKET_NAME};
const BUCKET_DIR = "v1";
const LOCALSTACK_CONTAINER_START_TIMEOUT = 60_000;

function config(container: StartedLocalStackContainer): object {
    return {
        endpoint: container.getConnectionUri(),
        region: REGION,
        credentials: {
            secretAccessKey: "test",
            accessKeyId: "test",
        },
    }
}

describe("FileUploader", () => {
    let container: StartedLocalStackContainer;
    let s3Client: S3Client;
    let fileUploader: FileUploader;

    async function headObject(key: string): Promise<HeadObjectCommandOutput> {
        const output = await s3Client.send(new HeadObjectCommand({...myBucket, Key: key}));
        expect(output.$metadata.httpStatusCode).toEqual(200);
        return output;
    }

    beforeAll(async () => {
        container = await new LocalstackContainer().start();
        s3Client = new S3Client({
            ...config(container),
            forcePathStyle: true,
            // retryMode: "standard",
            maxAttempts: 3, // when use colima (instead of Docker Desktop) you need up to 10 retries :(
        });

        // create infrastructure that is normally created by Terraform / CloudFormation
        const command = new CreateBucketCommand(myBucket);
        const createBucketResponse = await s3Client.send(command);
        expect(createBucketResponse.$metadata.httpStatusCode).toEqual(200);

        // create SUT (system under test)
        const fileService = new FileService();
        fileUploader = new FileUploader(fileService, s3Client);
    }, LOCALSTACK_CONTAINER_START_TIMEOUT);

    beforeEach(async () => {
        const listOutput = await s3Client.send(new ListObjectsV2Command(myBucket));
        expect(listOutput.$metadata.httpStatusCode).toEqual(200);
        if (listOutput.KeyCount === 0) return;
        const keys: {Key: string}[] = listOutput.Contents!!.map((content) => ({Key: content.Key!!}));
        const deleteOutput = await s3Client.send(new DeleteObjectsCommand({...myBucket, Delete: {Objects: keys}}));
        expect(deleteOutput.$metadata.httpStatusCode).toEqual(200);
    });

    it('should upload 1) static assets; 2) with valid content types; 3) to specified bucket dir', async () => {
        const srcDir = `${__dirname}/static-assets`;

        await fileUploader.upload(srcDir, BUCKET_NAME, BUCKET_DIR);

        const output = await s3Client.send(new ListObjectsV2Command(myBucket));
        expect(output.$metadata.httpStatusCode).toEqual(200);
        expect(output.KeyCount).toEqual(2);

        const indexHtml = await headObject(`${BUCKET_DIR}/index.html`);
        expect(indexHtml.ContentType).toEqual("text/html; charset=utf-8");

        const stylesCss = await headObject(`${BUCKET_DIR}/styles.css`);
        expect(stylesCss.ContentType).toEqual("text/css; charset=utf-8");
    });

    it('should upload binary file', async () => {
        const srcDir = `${__dirname}/binary-files`;

        await fileUploader.upload(srcDir, BUCKET_NAME, BUCKET_DIR);

        const binaryFile = await headObject(`${BUCKET_DIR}/helloworld.jar`);
        expect(binaryFile.ContentType).toEqual("application/java-archive");
    });

    it('should upload file with tags', async () => {
        const srcDir = `${__dirname}/static-assets`;
        const tags = "Release=false&tag2=1.1";

        await fileUploader.upload(srcDir, BUCKET_NAME, BUCKET_DIR, tags);

        const output = await s3Client.send(new GetObjectTaggingCommand({...myBucket, Key: `${BUCKET_DIR}/index.html`}));
        expect(output.$metadata.httpStatusCode).toEqual(200);
        expect(output.TagSet).toEqual([{Key: "Release", Value: "false"}, {Key: "tag2", Value: "1.1"}]);
    });

    it('should override object', async () => {
        await fileUploader.upload(`${__dirname}/static-assets`, BUCKET_NAME, BUCKET_DIR);
        await fileUploader.upload(`${__dirname}/override`, BUCKET_NAME, BUCKET_DIR);

        const indexHtml = await headObject(`${BUCKET_DIR}/index.html`);
        expect(indexHtml.ContentLength).toEqual("<html>override</html>".length);
    });

    afterAll(async () => {
        if (container) {
            await container.stop();
        }
    });
});
