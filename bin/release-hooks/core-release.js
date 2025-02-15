"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var recursive_fs_1 = __importDefault(require("recursive-fs"));
var slash_1 = __importDefault(require("slash"));
var yazl_1 = __importDefault(require("yazl"));
var interaction_1 = require("../util/interaction");
var file_utils_1 = require("../lib/file-utils");
var progress = require('progress');
var coreReleaseHook = function (currentCommand, originalCommand, sdk) {
    return Promise.resolve(null)
        .then(function () {
        var releaseFiles = [];
        if (!fs_1.default.lstatSync(currentCommand.package).isDirectory()) {
            releaseFiles.push({
                sourceLocation: currentCommand.package,
                targetLocation: path_1.default.basename(currentCommand.package), // Put the file in the root
            });
            return Promise.resolve(releaseFiles);
        }
        return new Promise(function (resolve, reject) { return __awaiter(void 0, void 0, void 0, function () {
            var directoryPath, baseDirectoryPath, files, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        directoryPath = currentCommand.package;
                        baseDirectoryPath = path_1.default.join(directoryPath, '..');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, recursive_fs_1.default.read(currentCommand.package)];
                    case 2:
                        files = (_a.sent()).files;
                        files.forEach(function (filePath) {
                            var relativePath = path_1.default.relative(baseDirectoryPath, filePath);
                            // yazl does not like backslash (\) in the metadata path.
                            relativePath = (0, slash_1.default)(relativePath);
                            releaseFiles.push({
                                sourceLocation: filePath,
                                targetLocation: relativePath,
                            });
                        });
                        resolve(releaseFiles);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        reject(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    })
        .then(function (releaseFiles) {
        return new Promise(function (resolve, reject) {
            var packagePath = path_1.default.join(process.cwd(), (0, file_utils_1.generateRandomFilename)(15) + '.zip');
            var zipFile = new yazl_1.default.ZipFile();
            var writeStream = fs_1.default.createWriteStream(packagePath);
            zipFile.outputStream
                .pipe(writeStream)
                .on('error', function (error) {
                reject(error);
            })
                .on('close', function () {
                resolve(packagePath);
            });
            releaseFiles.forEach(function (releaseFile) {
                zipFile.addFile(releaseFile.sourceLocation, releaseFile.targetLocation);
            });
            zipFile.end();
        });
    })
        .then(function (packagePath) {
        var lastTotalProgress = 0;
        var progressBar = new progress('Upload progress:[:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 50,
            total: 100,
        });
        var uploadProgress = function (currentProgress) {
            progressBar.tick(currentProgress - lastTotalProgress);
            lastTotalProgress = currentProgress;
        };
        var updateMetadata = {
            description: currentCommand.description,
            isDisabled: currentCommand.disabled,
            isMandatory: currentCommand.mandatory,
            rollout: currentCommand.rollout,
        };
        return sdk
            .isAuthenticated(true)
            .then(function (isAuth) {
            return sdk.release(currentCommand.appName, currentCommand.deploymentName, packagePath, currentCommand.appStoreVersion, updateMetadata, uploadProgress);
        })
            .then(function () {
            interaction_1.out.text("Successfully released an update containing the \"".concat(originalCommand.package, "\" ") +
                "".concat(fs_1.default.lstatSync(originalCommand.package).isDirectory()
                    ? 'directory'
                    : 'file') +
                " to the \"".concat(currentCommand.deploymentName, "\" deployment of the \"").concat(currentCommand.appName, "\" app."));
        })
            .then(function () { return currentCommand; })
            .finally(function () {
            fs_1.default.unlinkSync(packagePath);
        });
    });
};
module.exports = coreReleaseHook;
