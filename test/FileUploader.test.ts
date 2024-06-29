import {FileUploader} from "/FileUploader";
import {S3Client} from "@aws-sdk/client-s3";

describe('FileUploader', () => {
    let s3Client: S3Client;
    let fileUploader: FileUploader;

    // re-create mocks and sut (system under test) for each test, so you do not need to care about mock reset
    beforeEach(() => {
        // mock dependency
        s3Client = <Partial<S3Client>>{
            send: jest.fn()
        } as S3Client;
        fileUploader = new FileUploader(s3Client);
    });

    it('should upload files', async () => {
        // mock method (optional)
        s3Client.send = jest.fn(() => Promise.resolve({}));

        await fileUploader.upload('srcDir', 'bucket');

        // assert on mock
        // expect(dao.getUser).toHaveBeenCalled();
    });
});