import {S3Client, ListObjectsV2Command, PutObjectCommand} from "@aws-sdk/client-s3";
import {FileService} from "FileService";

export class FileUploader {
    private fileService: FileService;
    private s3Client: S3Client;

    constructor(fileService: FileService, s3Client: S3Client) {
        this.fileService = fileService;
        this.s3Client = s3Client;
    }

    public async upload(srcDir: string, bucket: string): Promise<void> {
        console.info(`Uploading ${srcDir} to ${bucket}`);

        const files = this.fileService.listFiles(srcDir);
        for (const file of files) {
            console.log(`uploading ${file.name}`);
            const output = await this.s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: `${file.name}`,
                Body: this.fileService.readFile(file.fullPath),
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
