import {getInput} from "@actions/core";

const sourceDir: string = getInput('source_dir', {required: true});
const bucket: string = getInput('bucket', {required: true});

console.info(`Uploading ${sourceDir} to ${bucket}`);