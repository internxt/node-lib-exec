interface EnvironmentOptions {
    bridgeUrl?: string;
    bridgeUser: string;
    bridgePass: string;
    encryptionKey: string;
}
interface UploadProgressCallback {
    (progress: Number, uploadedBytes: Number | null, totalBytes: Number | null): void;
}
interface DownloadProgressCallback {
    (progress: Number, downloadedBytes: Number | null, totalBytes: Number | null): void;
}
interface UploadFinishedCallback {
    (err: Error | null, newFileId: string | null): void;
}
interface OnlyErrorCallback {
    (err: Error | null): void;
}
interface StoreFileOptions {
    filename: string;
    progressCallback: UploadProgressCallback;
    finishedCallback: UploadFinishedCallback;
}
interface ResolveFileOptions {
    progressCallback: DownloadProgressCallback;
    finishedCallback: OnlyErrorCallback;
    overwritte?: boolean;
}
interface BucketFormat {
    bucketId: string;
    decrypted: boolean;
    creationDate: Date;
    bucketName: string;
}
interface FileFormat {
    id: string;
    size: Number;
    decrypted: boolean;
    mimetype: string;
    created: Date;
    filename: string;
}
interface GetBucketsCallback {
    (err: Error | null, bucketList: BucketFormat[]): void;
}
interface ListFilesCallback {
    (err: Error | null, filesList: FileFormat[]): void;
}
declare class Environment {
    constructor(config: EnvironmentOptions);
    config: EnvironmentOptions;
    private getExe;
    private getOs;
    private fileExists;
    storeFile(bucketId: string, filePath: string, options: StoreFileOptions): void;
    resolveFile(bucketId: string, fileId: string, filePath: string, options: ResolveFileOptions): void;
    getBuckets(callback: GetBucketsCallback): void;
    listFiles(bucketId: string, callback: ListFilesCallback): void;
    removeFile(bucketId: string, fileId: string, callback: OnlyErrorCallback): void;
}
export { Environment };
