import {FileService} from "/FileService";
import {FileUploader} from "/FileUploader";
import {S3Client} from "@aws-sdk/client-s3";

describe('FileUploader', () => {
    // dependencies
    let fileService: FileService;
    let s3Client: S3Client;
    // end SUT
    let fileUploader: FileUploader;

    // re-create mocks and sut (system under test) for each test, so you do not need to care about mock reset
    beforeEach(() => {
        // mock dependency
        fileService = <Partial<FileService>>{
            listFiles: jest.fn(() => [])
        } as FileService;
        s3Client = <Partial<S3Client>>{
            send: jest.fn()
        } as S3Client;
        fileUploader = new FileUploader(fileService, s3Client);
    });

    it('should upload files', async () => {
        await fileUploader.upload('srcDir', 'bucket', 'dstDir');

        // assert on mock
        expect(fileService.listFiles).toHaveBeenCalled();
    });
});