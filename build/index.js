"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var child_process_1 = require("child_process");
var readline_1 = __importDefault(require("readline"));
var os_1 = __importDefault(require("os"));
var State_1 = require("./State");
var Environment = /** @class */ (function () {
    function Environment(config) {
        if (!config.bridgeUrl) {
            config.bridgeUrl = 'https://api.internxt.com';
        }
        this.config = config;
    }
    Environment.prototype.getExe = function () {
        var os = process.platform;
        var pathExec = path_1.default.join('binaries', 'inxt-' + os + '-' + process.arch);
        pathExec = path_1.default.join(__dirname, '..', pathExec);
        if (os === 'win32') {
            pathExec += '.exe';
        }
        pathExec = pathExec.replace('app.asar', 'app.asar.unpacked');
        return pathExec;
    };
    Environment.prototype.getOs = function () {
        return { os: process.platform };
    };
    Environment.prototype.fileExists = function () {
        var x = fs_1.default.existsSync(this.getExe());
        return x;
    };
    Environment.prototype.exeSpawn = function (command, args, options) {
        fs_1.default.accessSync(command, fs_1.default.constants.X_OK);
        return child_process_1.spawn(command, args, options);
    };
    Environment.prototype.storeFile = function (bucketId, filePath, options) {
        if (!path_1.default.isAbsolute(filePath)) {
            return options.finishedCallback(new Error('Path must be absolute'), null);
        }
        if (!fs_1.default.existsSync(filePath)) {
            return options.finishedCallback(new Error('Cannot upload file: Doesn\'t exists'), null);
        }
        // Spawn child process, call to .EXE
        var storjExe = this.exeSpawn(this.getExe(), ["upload-file", bucketId, filePath], {
            env: {
                HOME: os_1.default.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        var state = new State_1.State(storjExe);
        // Output results
        var result = null;
        var error = null;
        state.handler.on('kill', function () {
            error = new Error('Process killed by user');
            state.handler.kill();
        });
        // Pipe the stdout steam to a readline interface
        var rl = readline_1.default.createInterface(storjExe.stdout);
        // Possible outputs
        var uploadFailurePattern = /^Upload failure\:\s+(.*)/;
        var progressPattern = /^\[={0,}>?\s*\]\s+(\d+\.\d+)%$/;
        var uploadSuccessPattern = /^Upload Success! File ID: ([a-z0-9]{24})$/;
        var invalidFilePathPattern = /^Invalid file path: (.*)$/;
        // Process each line of output
        rl.on('line', function (ln) {
            if (options.debug) {
                options.debug(ln);
            }
            var invalidFilePathFailure = invalidFilePathPattern.exec(ln);
            if (invalidFilePathFailure) {
                error = new Error(invalidFilePathFailure[0]);
                return rl.close();
            }
            var uploadFailure = uploadFailurePattern.exec(ln);
            if (uploadFailure) {
                error = new Error(uploadFailure[1]);
                return rl.close();
            }
            var uploadSuccess = uploadSuccessPattern.exec(ln);
            if (uploadSuccess) {
                result = uploadSuccess[1];
            }
            var isProgress = progressPattern.exec(ln);
            if (isProgress) {
                var progressPercentage = parseFloat(isProgress[1]) / 100;
                if (typeof (options.progressCallback) === 'function') {
                    options.progressCallback(progressPercentage, null, null);
                }
            }
        });
        // Manage closed stream
        rl.on('close', function () {
            if (!error && !result) {
                options.finishedCallback(new Error('Unexpected process finish'), null);
            }
            else {
                options.finishedCallback(error, result);
            }
        });
        return state;
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
        var storjExe = this.exeSpawn(this.getExe(), ["download-file", bucketId, fileId, filePath], {
            env: {
                HOME: os_1.default.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        var state = new State_1.State(storjExe);
        // Output results
        var error = null;
        state.handler.on('kill', function () {
            error = new Error('Process killed by user');
            state.handler.kill();
        });
        var rl = readline_1.default.createInterface(storjExe.stdout);
        // Possible outputs
        var progressPattern = /^\[={0,}>?\s*\]\s+(\d+\.\d+)%$/;
        var downloadFailurePattern = /^Download failure: (.*)$/;
        rl.on('line', function (ln) {
            if (options.debug) {
                options.debug(ln);
            }
            var downloadFailure = downloadFailurePattern.exec(ln);
            if (downloadFailure) {
                error = new Error(downloadFailure[1]);
                return rl.close();
            }
            var isProgress = progressPattern.exec(ln);
            if (isProgress) {
                var progressPercentage = parseFloat(isProgress[1]) / 100;
                if (typeof (options.progressCallback) === 'function') {
                    options.progressCallback(progressPercentage, null, null);
                }
                return;
            }
        });
        rl.on('close', function () {
            options.finishedCallback(error);
        });
        return state;
    };
    Environment.prototype.getBuckets = function (callback) {
        var storjExe = this.exeSpawn(this.getExe(), ["list-buckets"], {
            env: {
                HOME: os_1.default.homedir(),
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
            if (typeof (callback) === 'function') {
                callback(error, results);
            }
        });
    };
    Environment.prototype.listFiles = function (bucketId, callback) {
        // Spawn child process, call to .EXE
        var storjExe = this.exeSpawn(this.getExe(), ["list-files", bucketId], {
            env: {
                HOME: os_1.default.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        // Pipe the stdout steam to a readline interface
        var rl = readline_1.default.createInterface(storjExe.stdout);
        // Output results
        var results = [];
        var error = null;
        var pattern = /^ID: ([a-z0-9]{24})\s+Size:\s+(\d+) bytes\s+Decrypted: (true|false)\s+Type:\s+(.*)\s+Created: (.*Z)\s+Name: (.*)$/;
        var nonExists = /^Bucket id .* does not exist$/;
        rl.on('line', function (ln) {
            var errorExists = nonExists.exec(ln);
            if (errorExists) {
                error = new Error(ln);
                return rl.close();
            }
            var isFile = pattern.exec(ln);
            if (isFile) {
                var file = {
                    id: isFile[1],
                    size: parseInt(isFile[2]),
                    decrypted: isFile[3] === 'true',
                    mimetype: isFile[4],
                    created: new Date(isFile[5]),
                    filename: isFile[6]
                };
                return results.push(file);
            }
            console.log('List files=>', ln);
        });
        rl.on('close', function () {
            callback(error, results);
        });
    };
    Environment.prototype.removeFile = function (bucketId, fileId, callback) {
        var storjExe = this.exeSpawn(this.getExe(), ["remove-file", bucketId, fileId], {
            env: {
                HOME: os_1.default.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        });
        var rl = readline_1.default.createInterface(storjExe.stdout);
        var error = null;
        var removeSuccessPattern = /^File was successfully removed from bucket\.$/;
        var removeErrorPattern = /^Failed to remove file from bucket.*/;
        rl.on('line', function (ln) {
            var removeError = removeErrorPattern.exec(ln);
            if (removeError) {
                error = new Error(removeError[0]);
                return rl.close();
            }
            var removeSuccess = removeSuccessPattern.exec(ln);
            if (removeSuccess) {
                return rl.close();
            }
            console.log(ln);
        });
        rl.on('close', function () {
            callback(error);
        });
    };
    Environment.prototype.resolveFileCancel = function (state) {
        state.handler.emit('kill');
    };
    Environment.prototype.storeFileCancel = function (state) {
        state.handler.emit('kill');
    };
    return Environment;
}());
exports.Environment = Environment;
