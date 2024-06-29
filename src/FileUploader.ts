import {S3Client, ListObjectsV2Command} from "@aws-sdk/client-s3";

export class FileUploader {
    private s3Client: S3Client;

    constructor(s3Client: S3Client) {
        this.s3Client = s3Client;
    }

    public async upload(srcDir: string, bucket: string): Promise<void> {
        console.info(`Uploading ${srcDir} to ${bucket}`);

        // a client can be shared by different commands.
        const output = await this.s3Client.send(new ListObjectsV2Command({Bucket: bucket}));
        console.log("key count: " + output.KeyCount);
    }
}