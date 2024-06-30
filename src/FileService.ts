import fs from "node:fs";
import mime from "mime-types";

export class FileService {
    public listFiles(dir: string): FileInfo[] {
        const fileInfos: FileInfo[] = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = `${dir}/${file}`;
            const contentType = mime.lookup(filePath);
            if (contentType === false) {
                throw new Error(`Could not determine content type for ${filePath}`);
            }
            const contentTypeHeader = mime.contentType(contentType);
            if (contentTypeHeader === false) {
                throw new Error(`Could not infer Content-Type header for ${contentType}`);
            }
            fileInfos.push({
                name: file,
                fullPath: filePath,
                contentType: contentTypeHeader
            });
        }
        return fileInfos;
    }

    /**
     * Wrapper around fs.readFileSync to make it easier to mock
     * @param filePath
     */
    public readFile(filePath: string): Buffer {
        return fs.readFileSync(filePath);
    }
}

export type FileInfo = {
    name: string
    fullPath: string
    contentType: string
}
