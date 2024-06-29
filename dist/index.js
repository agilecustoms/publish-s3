"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const sourceDir = (0, core_1.getInput)('source_dir', { required: true });
const bucket = (0, core_1.getInput)('bucket', { required: true });
console.info(`Uploading ${sourceDir} to ${bucket}`);
