import {S3Client, ListBucketsCommand, ListBucketsCommandInput} from "@aws-sdk/client-s3";
import {ListBucketsOutput} from "@aws-sdk/client-s3/dist-types/models/models_0";

export class FileUploader {
    private s3Client: S3Client;

    constructor(s3Client: S3Client) {
        this.s3Client = s3Client;
    }

    public async upload(srcDir: string, bucket: string): Promise<void> {
        console.info(`Uploading ${srcDir} to ${bucket}`);

        // a client can be shared by different commands.
        const params: ListBucketsCommandInput = {};
        const command: ListBucketsCommand = new ListBucketsCommand(params);
        const data: ListBucketsOutput = await this.s3Client.send(command);
        console.log("bucket count: " + data.Buckets?.length);
    }
}