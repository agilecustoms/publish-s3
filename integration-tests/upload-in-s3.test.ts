import {LocalstackContainer, StartedLocalStackContainer} from "@testcontainers/localstack";
import {
    CreateBucketCommand,
    CreateBucketCommandInput, HeadObjectCommand, HeadObjectCommandOutput,
    ListObjectsV2Command,
    S3Client
} from "@aws-sdk/client-s3";
import {FileUploader} from "/FileUploader";
import {FileService} from "/FileService";

const REGION = "us-east-1";
const BUCKET_NAME = "testcontainers";
const LOCALSTACK_CONTAINER_START_TIMEOUT = 30_000;

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
        const output = await s3Client.send(new HeadObjectCommand({Bucket: BUCKET_NAME, Key: key}));
        expect(output.$metadata.httpStatusCode).toEqual(200);
        return output;
    }

    beforeAll(async () => {
        container = await new LocalstackContainer().start();
        s3Client = new S3Client({
            ...config(container),
            forcePathStyle: true,
            // retryMode: "standard",
            // maxAttempts: 10, // when use colima (instead of Docker Desktop) you need more retries :(
        });

        // create infrastructure that is normally created by Terraform / CloudFormation
        const input: CreateBucketCommandInput = {
            Bucket: BUCKET_NAME,
        };
        const command = new CreateBucketCommand(input);
        const createBucketResponse = await s3Client.send(command);
        expect(createBucketResponse.$metadata.httpStatusCode).toEqual(200);

        // create SUT (system under test)
        const fileService = new FileService();
        fileUploader = new FileUploader(fileService, s3Client);
    }, LOCALSTACK_CONTAINER_START_TIMEOUT);

    it('should upload static assets with valid content types', async () => {
        const srcDir = `${__dirname}/static-assets`;

        await fileUploader.upload(srcDir, BUCKET_NAME);

        const output = await s3Client.send(new ListObjectsV2Command({Bucket: BUCKET_NAME}));
        expect(output.$metadata.httpStatusCode).toEqual(200);
        expect(output.KeyCount).toEqual(2);

        const indexHtml = await headObject("index.html");
        expect(indexHtml.ContentType).toEqual("text/html; charset=utf-8");

        const stylesCss = await headObject("styles.css");
        expect(stylesCss.ContentType).toEqual("text/css; charset=utf-8");
    });

    afterAll(async () => {
        if (container) {
            await container.stop();
        }
    });
});
