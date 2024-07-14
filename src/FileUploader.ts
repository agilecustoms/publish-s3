import * as core from "@actions/core";
import {S3Client, PutObjectCommand, PutObjectCommandInput} from "@aws-sdk/client-s3";
import {FileService} from "FileService";

export class FileUploader {
    private fileService: FileService;
    private s3Client: S3Client;

    constructor(fileService: FileService, s3Client: S3Client) {
        this.fileService = fileService;
        this.s3Client = s3Client;
    }

    public async upload(srcDir: string, bucket: string, bucketDirs: string[], tags: string = ''): Promise<void> {
        for (const bucketDir of bucketDirs) {
            await this.uploadDir(srcDir, bucket, bucketDir, tags);
        }
    }

    private async uploadDir(srcDir: string, bucket: string, bucketDir: string, tags: string = ''): Promise<void> {
        core.info(`Uploading ${srcDir} to ${bucket}/${bucketDir}${tags ? ` with tags ${tags}`: ''}`);

        const files = this.fileService.listFiles(srcDir);
        for (const file of files) {
            core.debug(`uploading ${file.name}`);
            const input: PutObjectCommandInput = {
                Bucket: bucket,
                Key: `${bucketDir}/${file.name}`,
                Body: this.fileService.readFile(file.fullPath),
                ContentType: file.contentType
            };
            if (tags.length > 0) {
                input.Tagging = tags;
            }
            const output = await this.s3Client.send(new PutObjectCommand(input));
            const statusCode = output.$metadata.httpStatusCode;
            if (statusCode !== 200) {
                throw new Error(`Failed to upload ${file}, status code: ${statusCode}`);
            }
        }
    }
}
