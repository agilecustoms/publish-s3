import {S3Client, ListObjectsV2Command, PutObjectCommand} from "@aws-sdk/client-s3";
import * as fs from "node:fs";
import mime from "mime-types";

export class FileUploader {
    private s3Client: S3Client;

    constructor(s3Client: S3Client) {
        this.s3Client = s3Client;
    }

    public async upload(srcDir: string, bucket: string): Promise<void> {
        console.info(`Uploading ${srcDir} to ${bucket}`);

        const files = fs.readdirSync(srcDir);
        for (const file of files) {
            const filePath = `${srcDir}/${file}`;
            const contentType = mime.lookup(filePath);
            if (contentType === false) {
                throw new Error(`Could not determine content type for ${filePath}`);
            }
            const contentTypeHeader = mime.contentType(contentType);

            const s3Dir = 'test';
            console.log(`${file} => ${contentTypeHeader}`);
            const output = await this.s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: `${file}`,
                Body: fs.readFileSync(filePath),
            }));
            const statusCode = output.$metadata.httpStatusCode;
            if (statusCode !== 200) {
                throw new Error(`Failed to upload ${file}, status code: ${statusCode}`);
            }
        }

        // a client can be shared by different commands.
        const output = await this.s3Client.send(new ListObjectsV2Command({Bucket: bucket}));
        console.log("key count: " + output.KeyCount);
    }
}
