"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var fs_1 = __importDefault(require("fs"));
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var os_1 = __importDefault(require("os"));
var path_1 = __importDefault(require("path"));
var rimraf_1 = __importDefault(require("rimraf"));
var hash_utils_1 = require("../lib/hash-utils");
var CURRENT_CLAIM_VERSION = '1.0.0';
var METADATA_FILE_NAME = '.codepushrelease';
var deletePreviousSignatureIfExists = function (targetPackage) {
    var signatureFilePath = path_1.default.join(targetPackage, METADATA_FILE_NAME);
    var prevSignatureExists = true;
    try {
        fs_1.default.accessSync(signatureFilePath, fs_1.default.constants.R_OK);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            prevSignatureExists = false;
        }
        else {
            return Promise.reject(new Error("Could not delete previous release signature at ".concat(signatureFilePath, ".\n                Please, check your access rights.")));
        }
    }
    if (prevSignatureExists) {
        console.log("Deleting previous release signature at ".concat(signatureFilePath));
        rimraf_1.default.sync(signatureFilePath);
    }
    return Promise.resolve(null);
};
var sign = function (currentCommand, originalCommand, sdk) {
    if (!currentCommand.privateKeyPath) {
        if (fs_1.default.lstatSync(currentCommand.package).isDirectory()) {
            // If new update wasn't signed, but signature file for some reason still appears in the package directory - delete it
            return deletePreviousSignatureIfExists(currentCommand.package).then(function () {
                return Promise.resolve(currentCommand);
            });
        }
        else {
            return Promise.resolve(currentCommand);
        }
    }
    var privateKey;
    var signatureFilePath;
    return Promise.resolve(null)
        .then(function () {
        signatureFilePath = path_1.default.join(currentCommand.package, METADATA_FILE_NAME);
        try {
            privateKey = fs_1.default.readFileSync(currentCommand.privateKeyPath);
        }
        catch (err) {
            return Promise.reject(new Error("The path specified for the signing key (\"".concat(currentCommand.privateKeyPath, "\") was not valid")));
        }
        if (!fs_1.default.lstatSync(currentCommand.package).isDirectory()) {
            // If releasing a single file, copy the file to a temporary 'CodePush' directory in which to publish the release
            var outputFolderPath = path_1.default.join(os_1.default.tmpdir(), 'CodePush');
            rimraf_1.default.sync(outputFolderPath);
            fs_1.default.mkdirSync(outputFolderPath);
            var outputFilePath = path_1.default.join(outputFolderPath, path_1.default.basename(currentCommand.package));
            fs_1.default.writeFileSync(outputFilePath, fs_1.default.readFileSync(currentCommand.package));
            currentCommand.package = outputFolderPath;
        }
        return deletePreviousSignatureIfExists(currentCommand.package);
    })
        .then(function () {
        return (0, hash_utils_1.generatePackageHashFromDirectory)(currentCommand.package, path_1.default.join(currentCommand.package, '..'));
    })
        .then(function (hash) {
        return new Promise(function (resolve, reject) {
            var claims = {
                claimVersion: CURRENT_CLAIM_VERSION,
                contentHash: hash,
            };
            jsonwebtoken_1.default.sign(claims, privateKey, {
                algorithm: 'RS256',
            }, function (err, token) {
                if (err) {
                    return reject(new Error('The specified signing key file was not valid'));
                }
                resolve(token);
            });
        });
    })
        .then(function (signedJwt) {
        return new Promise(function (resolve, reject) {
            fs_1.default.writeFile(signatureFilePath, signedJwt, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    console.log("Generated a release signature and wrote it to ".concat(signatureFilePath));
                    resolve(null);
                }
            });
        });
    })
        .then(function () {
        return currentCommand;
    })
        .catch(function (err) {
        err.message = "Could not sign package: ".concat(err.message);
        return Promise.reject(err);
    });
};
module.exports = sign;
