import * as core from "@actions/core";
import {FileUploader} from "FileUploader";
import {S3Client} from "@aws-sdk/client-s3";

const accessKeyId: string = core.getInput('access-key-id', {required: true});
const secretAccessKey: string = core.getInput('secret-access-key', {required: true});
const sourceDir: string = core.getInput('source-dir', {required: true});
const bucket: string = core.getInput('bucket', {required: true});

const s3Client = new S3Client({
    // region: "us-east-1",
    credentials: {
        secretAccessKey,
        accessKeyId,
    },
});
const fileUploader = new FileUploader(s3Client);

fileUploader.upload(sourceDir, bucket)
    .then(() => core.info("Upload completed"))
    .catch((error) => core.error("Upload failed", error));
