import * as core from "@actions/core";
import {FileUploader} from "FileUploader";
import {S3Client} from "@aws-sdk/client-s3";
import {ExitCode} from "@actions/core";
import {FileService} from "FileService";

const accessKeyId: string = core.getInput('access-key-id', {required: true});
const secretAccessKey: string = core.getInput('secret-access-key', {required: true});
const sessionToken: string = core.getInput('session-token', {required: true});
const sourceDir: string = core.getInput('source-dir', {required: true});
const bucket: string = core.getInput('bucket', {required: true});

const fileService = new FileService();
const s3Client = new S3Client({
    credentials: {
        secretAccessKey,
        accessKeyId,
        sessionToken
    },
});
const fileUploader = new FileUploader(fileService, s3Client);

fileUploader.upload(sourceDir, bucket)
    .then(() => core.info("Upload completed"))
    .catch((error) => {
        core.error("Upload failed")
        core.error(error);
        console.error(error); // TODO: remove?
        process.exitCode = ExitCode.Failure;
    });
