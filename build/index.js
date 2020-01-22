"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var child_process_1 = require("child_process");
var readline_1 = __importDefault(require("readline"));
var Environment = /** @class */ (function () {
    function Environment(config) {
        if (!config.bridgeUrl) {
            config.bridgeUrl = 'https://api.internxt.com';
        }
        this.config = config;
    }
    Environment.prototype.getExe = function () {
        var os = process.platform;
        var pathExec = 'binaries/storj-' + os + '-' + process.arch;
        pathExec = 'binaries/storj-' + os + '-x32';
        if (os === 'win32') {
            pathExec += '.exe';
        }
        return pathExec;
    };
    Environment.prototype.getOs = function () {
        return { os: process.platform };
    };
    Environment.prototype.fileExists = function () {
        var x = fs_1.default.existsSync(this.getExe());
        return x;
    };
    Environment.prototype.storeFile = function (bucketId, filePath, options) {
        child_process_1.execFile(this.getExe(), {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl
            }
        });
    };
    Environment.prototype.resolveFile = function (bucketId, fileId, filePath, options) {
        if (fs_1.default.existsSync(filePath)) {
            if (options.overwritte) {
                fs_1.default.unlinkSync(filePath);
            }
            else {
                return options.finishedCallback(new Error('File already exists'));
            }
        }
        var storjExe = child_process_1.spawn(this.getExe(), ["download-file", bucketId, fileId, filePath], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        var rl = readline_1.default.createInterface(storjExe.stdout);
        var progressPattern = /^\[={0,}>\s+\]\s+(\d+\.\d+)%$/;
        var error = null;
        rl.on('line', function (ln) {
            console.log('Line: ', ln);
            var isProgress = progressPattern.exec(ln);
            if (isProgress) {
                if (typeof (options.progressCallback) == 'function') {
                    options.progressCallback(isProgress[1], null, null);
                }
            }
            else if (ln == 'Download Success!') {
                rl.close();
            }
        });
        rl.on('close', function () {
            options.finishedCallback(error);
        });
    };
    Environment.prototype.listBuckets = function (callback) {
        var storjExe = child_process_1.spawn(this.getExe(), ["list-buckets"], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        var rl = readline_1.default.createInterface(storjExe.stdout);
        var pattern = /^ID: ([a-z0-9]{24})\s+Decrypted: (true|false)\s+Created: (.*Z)\s+Name: (.*)$/;
        var results = [];
        var error = null;
        rl.on('line', function (ln) {
            if (ln === 'Invalid user credentials.') {
                error = new Error(ln);
                rl.close();
            }
            var r = pattern.exec(ln);
            if (r) {
                var bucket = {
                    bucketId: r[1],
                    decrypted: r[2] === 'true',
                    creationDate: new Date(r[3]),
                    bucketName: r[4]
                };
                results.push(bucket);
            }
        });
        rl.on('close', function () {
            if (typeof (callback) == 'function') {
                callback(error, results);
            }
        });
    };
    return Environment;
}());
exports.Environment = Environment;
//# sourceMappingURL=index.js.map