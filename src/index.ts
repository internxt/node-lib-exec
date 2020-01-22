
import fs, { read } from 'fs'
import { execFile, spawn } from 'child_process';
import readline from 'readline'

interface EnvironmentOptions {
    bridgeUrl?: string,
    bridgeUser: string,
    bridgePass: string,
    encryptionKey: string
}

interface UploadProgressCallback {
    (progress: Number, uploadedBytes: Number, totalBytes: Number): void
}

interface DownloadProgressCallback {
    (progress: Number | string, downloadedBytes: Number | null, totalBytes: Number | null): void
}

interface UploadFinishedCallback {
    (err: Error, newFileId: string): void
}

interface DownloadFinishedCallback {
    (err: Error | null): void
}

interface StoreFileOptions {
    filename: string,
    progressCallback: UploadProgressCallback,
    finishedCallback: UploadFinishedCallback
}

interface ResolveFileOptions {
    progressCallback: DownloadProgressCallback,
    finishedCallback: DownloadFinishedCallback,
    overwritte?: boolean
}


interface BucketFormat {
    bucketId: string,
    decrypted: boolean,
    creationDate: Date,
    bucketName: string
}

interface ListBucketsCallback {
    (err: Error | null, bucketList: BucketFormat[]): void
}

class Environment {
    constructor(config: EnvironmentOptions) {
        if (!config.bridgeUrl) {
            config.bridgeUrl = 'https://api.internxt.com'
        }

        this.config = config
    }

    config: EnvironmentOptions

    private getExe() {
        const os = process.platform
        let pathExec = 'binaries/storj-' + os + '-' + process.arch
        pathExec = 'binaries/storj-' + os + '-x32'
        if (os === 'win32') { pathExec += '.exe' }
        return pathExec
    }

    private getOs() {
        return { os: process.platform }
    }

    private fileExists() {
        const x = fs.existsSync(this.getExe())
        return x;
    }

    storeFile(bucketId: string, filePath: string, options: StoreFileOptions) {
        execFile(this.getExe(), {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl
            }
        })
    }

    resolveFile(bucketId: string, fileId: string, filePath: string, options: ResolveFileOptions) {

        if (fs.existsSync(filePath)) {
            if (options.overwritte) {
                fs.unlinkSync(filePath)
            } else {
                return options.finishedCallback(new Error('File already exists'))
            }
        }

        const storjExe = spawn(this.getExe(), ["download-file", bucketId, fileId, filePath], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const rl = readline.createInterface(storjExe.stdout)

        const progressPattern = /^\[={0,}>\s+\]\s+(\d+\.\d+)%$/
        let error: Error | null = null

        rl.on('line', (ln) => {
            console.log('Line: ', ln)
            const isProgress = progressPattern.exec(ln)
            if (isProgress) {
                if (typeof(options.progressCallback) == 'function') {
                    options.progressCallback(isProgress[1], null, null)
                }
            } else if (ln == 'Download Success!') {
                rl.close()
            }
        });

        rl.on('close', () => {
            options.finishedCallback(error)
        })


    }

    listBuckets(callback: ListBucketsCallback) {
        const storjExe = spawn(this.getExe(), ["list-buckets"], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const rl = readline.createInterface(storjExe.stdout)

        const pattern = /^ID: ([a-z0-9]{24})\s+Decrypted: (true|false)\s+Created: (.*Z)\s+Name: (.*)$/

        let results: BucketFormat[] = [];
        let error: Error | null = null

        rl.on('line', (ln) => {
            if (ln === 'Invalid user credentials.') {
                error = new Error(ln)
                rl.close()
            }
            const r = pattern.exec(ln)
            if (r) {
                const bucket: BucketFormat = {
                    bucketId: r[1],
                    decrypted: r[2] === 'true',
                    creationDate: new Date(r[3]),
                    bucketName: r[4]
                }
                results.push(bucket)
            }
        })

        rl.on('close', () => {
            if (typeof (callback) == 'function') {
                callback(error, results)
            }
        })

    }


}

export { Environment }