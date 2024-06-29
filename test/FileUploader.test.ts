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
        // mock method (optional)
        s3Client.send = jest.fn(() => Promise.resolve({}));

        await fileUploader.upload('srcDir', 'bucket');

        // assert on mock
        // expect(dao.getUser).toHaveBeenCalled();
    });
});