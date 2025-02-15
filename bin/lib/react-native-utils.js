"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReactNativeVersion = exports.getiOSHermesEnabled = exports.getHermesEnabled = exports.runHermesEmitBinaryCommand = exports.runReactNativeBundleCommand = exports.getReactNativeProjectAppVersion = exports.spawn = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var xml2js_1 = __importDefault(require("xml2js"));
var interaction_1 = require("../util/interaction");
var validation_utils_1 = require("./validation-utils");
var file_utils_1 = require("./file-utils");
var chalk_1 = __importDefault(require("chalk"));
var plist = require('plist');
var g2js = require('gradle-to-js/lib/parser');
var properties = require('properties');
var childProcess = require('child_process');
exports.spawn = childProcess.spawn;
function getReactNativeProjectAppVersion(command, projectName) {
    var fileExists = function (file) {
        try {
            return fs_1.default.statSync(file).isFile();
        }
        catch (e) {
            return false;
        }
    };
    interaction_1.out.text(chalk_1.default.cyan("Detecting ".concat(command.platform, " app version:\n")));
    if (command.platform === 'ios') {
        var resolvedPlistFile = command.plistFile;
        if (resolvedPlistFile) {
            // If a plist file path is explicitly provided, then we don't
            // need to attempt to "resolve" it within the well-known locations.
            if (!fileExists(resolvedPlistFile)) {
                throw new Error("The specified plist file doesn't exist. Please check that the provided path is correct.");
            }
        }
        else {
            // Allow the plist prefix to be specified with or without a trailing
            // separator character, but prescribe the use of a hyphen when omitted,
            // since this is the most commonly used convetion for plist files.
            if (command.plistFilePrefix && /.+[^-.]$/.test(command.plistFilePrefix)) {
                command.plistFilePrefix += '-';
            }
            var iOSDirectory = 'ios';
            var plistFileName = "".concat(command.plistFilePrefix || '', "Info.plist");
            var knownLocations = [
                path_1.default.join(iOSDirectory, projectName, plistFileName),
                path_1.default.join(iOSDirectory, plistFileName),
            ];
            resolvedPlistFile = knownLocations.find(fileExists);
            if (!resolvedPlistFile) {
                throw new Error("Unable to find either of the following plist files in order to infer your app's binary version: \"".concat(knownLocations.join('", "'), "\". If your plist has a different name, or is located in a different directory, consider using either the \"--plistFile\" or \"--plistFilePrefix\" parameters to help inform the CLI how to find it."));
            }
        }
        var plistContents = fs_1.default.readFileSync(resolvedPlistFile).toString();
        try {
            var parsedPlist = plist.parse(plistContents);
        }
        catch (e) {
            throw new Error("Unable to parse \"".concat(resolvedPlistFile, "\". Please ensure it is a well-formed plist file."));
        }
        if (parsedPlist && parsedPlist.CFBundleShortVersionString) {
            if ((0, validation_utils_1.isValidVersion)(parsedPlist.CFBundleShortVersionString)) {
                interaction_1.out.text("Using the target binary version value \"".concat(parsedPlist.CFBundleShortVersionString, "\" from \"").concat(resolvedPlistFile, "\".\n"));
                return Promise.resolve(parsedPlist.CFBundleShortVersionString);
            }
            else {
                throw new Error("The \"CFBundleShortVersionString\" key in the \"".concat(resolvedPlistFile, "\" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1)."));
            }
        }
        else {
            throw new Error("The \"CFBundleShortVersionString\" key doesn't exist within the \"".concat(resolvedPlistFile, "\" file."));
        }
    }
    else if (command.platform === 'android') {
        var buildGradlePath_1 = path_1.default.join('android', 'app');
        if (command.gradleFile) {
            buildGradlePath_1 = command.gradleFile;
        }
        if (fs_1.default.lstatSync(buildGradlePath_1).isDirectory()) {
            buildGradlePath_1 = path_1.default.join(buildGradlePath_1, 'build.gradle');
        }
        if ((0, file_utils_1.fileDoesNotExistOrIsDirectory)(buildGradlePath_1)) {
            throw new Error("Unable to find gradle file \"".concat(buildGradlePath_1, "\"."));
        }
        return g2js
            .parseFile(buildGradlePath_1)
            .catch(function () {
            throw new Error("Unable to parse the \"".concat(buildGradlePath_1, "\" file. Please ensure it is a well-formed Gradle file."));
        })
            .then(function (buildGradle) {
            var versionName = null;
            if (buildGradle.android &&
                buildGradle.android.defaultConfig &&
                buildGradle.android.defaultConfig.versionName) {
                versionName = buildGradle.android.defaultConfig.versionName;
            }
            else {
                throw new Error("The \"".concat(buildGradlePath_1, "\" file doesn't specify a value for the \"android.defaultConfig.versionName\" property."));
            }
            if (typeof versionName !== 'string') {
                throw new Error("The \"android.defaultConfig.versionName\" property value in \"".concat(buildGradlePath_1, "\" is not a valid string. If this is expected, consider using the --targetBinaryVersion option to specify the value manually."));
            }
            var appVersion = versionName.replace(/"/g, '').trim();
            if ((0, validation_utils_1.isValidVersion)(appVersion)) {
                // The versionName property is a valid semver string,
                // so we can safely use that and move on.
                interaction_1.out.text("Using the target binary version value \"".concat(appVersion, "\" from \"").concat(buildGradlePath_1, "\".\n"));
                return appVersion;
            }
            else if (/^\d.*/.test(appVersion)) {
                // The versionName property isn't a valid semver string,
                // but it starts with a number, and therefore, it can't
                // be a valid Gradle property reference.
                throw new Error("The \"android.defaultConfig.versionName\" property in the \"".concat(buildGradlePath_1, "\" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1)."));
            }
            // The version property isn't a valid semver string
            // so we assume it is a reference to a property variable.
            var propertyName = appVersion.replace('project.', '');
            var propertiesFileName = 'gradle.properties';
            var knownLocations = [
                path_1.default.join('android', 'app', propertiesFileName),
                path_1.default.join('android', propertiesFileName),
            ];
            // Search for gradle properties across all `gradle.properties` files
            var propertiesFile = null;
            for (var i = 0; i < knownLocations.length; i++) {
                propertiesFile = knownLocations[i];
                if (fileExists(propertiesFile)) {
                    var propertiesContent = fs_1.default
                        .readFileSync(propertiesFile)
                        .toString();
                    try {
                        var parsedProperties = properties.parse(propertiesContent);
                        appVersion = parsedProperties[propertyName];
                        if (appVersion) {
                            break;
                        }
                    }
                    catch (e) {
                        throw new Error("Unable to parse \"".concat(propertiesFile, "\". Please ensure it is a well-formed properties file."));
                    }
                }
            }
            if (!appVersion) {
                throw new Error("No property named \"".concat(propertyName, "\" exists in the \"").concat(propertiesFile, "\" file."));
            }
            if (!(0, validation_utils_1.isValidVersion)(appVersion)) {
                throw new Error("The \"".concat(propertyName, "\" property in the \"").concat(propertiesFile, "\" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1)."));
            }
            interaction_1.out.text("Using the target binary version value \"".concat(appVersion, "\" from the \"").concat(propertyName, "\" key in the \"").concat(propertiesFile, "\" file.\n"));
            return appVersion.toString();
        });
    }
    else {
        var appxManifestFileName = 'Package.appxmanifest';
        try {
            var appxManifestContainingFolder = path_1.default.join('windows', projectName);
            var appxManifestContents = fs_1.default
                .readFileSync(path_1.default.join(appxManifestContainingFolder, 'Package.appxmanifest'))
                .toString();
        }
        catch (err) {
            throw new Error("Unable to find or read \"".concat(appxManifestFileName, "\" in the \"").concat(path_1.default.join('windows', projectName), "\" folder."));
        }
        return new Promise(function (resolve, reject) {
            xml2js_1.default.parseString(appxManifestContents, function (err, parsedAppxManifest) {
                if (err) {
                    reject(new Error("Unable to parse the \"".concat(path_1.default.join(appxManifestContainingFolder, appxManifestFileName), "\" file, it could be malformed.")));
                    return;
                }
                try {
                    var appVersion = parsedAppxManifest.Package.Identity[0]['$'].Version.match(/^\d+\.\d+\.\d+/)[0];
                    interaction_1.out.text("Using the target binary version value \"".concat(appVersion, "\" from the \"Identity\" key in the \"").concat(appxManifestFileName, "\" file.\n"));
                    return resolve(appVersion);
                }
                catch (e) {
                    reject(new Error("Unable to parse the package version from the \"".concat(path_1.default.join(appxManifestContainingFolder, appxManifestFileName), "\" file.")));
                    return;
                }
            });
        });
    }
}
exports.getReactNativeProjectAppVersion = getReactNativeProjectAppVersion;
// https://github.com/microsoft/appcenter-cli/blob/master/src/commands/codepush/release-react.ts#L201
// https://github.com/microsoft/appcenter-cli/blob/13495af812558bd952d8aeb9dc01b5be089cd1fc/src/commands/codepush/lib/react-native-utils.ts#L277
function getCliPath() {
    if (process.platform === 'win32') {
        return path_1.default.join('node_modules', 'react-native', 'local-cli', 'cli.js');
    }
    return path_1.default.join('node_modules', '.bin', 'react-native');
}
function runReactNativeBundleCommand(bundleName, development, entryFile, outputFolder, platform, sourcemapOutput, config, extraBundlerOptions) {
    var reactNativeBundleArgs = [];
    var envNodeArgs = process.env.CODE_PUSH_NODE_ARGS;
    if (typeof envNodeArgs !== 'undefined') {
        Array.prototype.push.apply(reactNativeBundleArgs, envNodeArgs.trim().split(/\s+/));
    }
    Array.prototype.push.apply(reactNativeBundleArgs, __spreadArray([
        getCliPath(),
        'bundle',
        '--assets-dest',
        outputFolder,
        '--bundle-output',
        path_1.default.join(outputFolder, bundleName),
        '--dev',
        development,
        '--entry-file',
        entryFile,
        '--platform',
        platform
    ], extraBundlerOptions, true));
    if (sourcemapOutput) {
        reactNativeBundleArgs.push('--sourcemap-output', sourcemapOutput);
    }
    if (config) {
        reactNativeBundleArgs.push('--config', config);
    }
    interaction_1.out.text(chalk_1.default.cyan('Running "react-native bundle" command:\n'));
    var reactNativeBundleProcess = (0, exports.spawn)('node', reactNativeBundleArgs);
    interaction_1.out.text("node ".concat(reactNativeBundleArgs.join(' ')));
    return new Promise(function (resolve, reject) {
        reactNativeBundleProcess.stdout.on('data', function (data) {
            interaction_1.out.text(data.toString().trim());
        });
        reactNativeBundleProcess.stderr.on('data', function (data) {
            console.error(data.toString().trim());
        });
        reactNativeBundleProcess.on('close', function (exitCode) {
            if (exitCode) {
                reject(new Error("\"react-native bundle\" command exited with code ".concat(exitCode, ".")));
            }
            resolve(null);
        });
    });
}
exports.runReactNativeBundleCommand = runReactNativeBundleCommand;
function runHermesEmitBinaryCommand(bundleName, outputFolder, sourcemapOutput, extraHermesFlags) {
    var hermesArgs = [];
    var envNodeArgs = process.env.CODE_PUSH_NODE_ARGS;
    if (typeof envNodeArgs !== 'undefined') {
        Array.prototype.push.apply(hermesArgs, envNodeArgs.trim().split(/\s+/));
    }
    Array.prototype.push.apply(hermesArgs, __spreadArray([
        '-emit-binary',
        '-out',
        path_1.default.join(outputFolder, bundleName + '.hbc'),
        path_1.default.join(outputFolder, bundleName)
    ], extraHermesFlags, true));
    if (sourcemapOutput) {
        hermesArgs.push('-output-source-map');
    }
    /*
    if (!isDebug()) {
      hermesArgs.push("-w");
    }
    */
    interaction_1.out.text(chalk_1.default.cyan('Converting JS bundle to byte code via Hermes, running command:\n'));
    var hermesCommand = getHermesCommand();
    var hermesProcess = (0, exports.spawn)(hermesCommand, hermesArgs);
    interaction_1.out.text("".concat(hermesCommand, " ").concat(hermesArgs.join(' ')));
    return new Promise(function (resolve, reject) {
        hermesProcess.stdout.on('data', function (data) {
            interaction_1.out.text(data.toString().trim());
        });
        hermesProcess.stderr.on('data', function (data) {
            console.error(data.toString().trim());
        });
        hermesProcess.on('close', function (exitCode) {
            if (exitCode) {
                reject(new Error("\"hermes\" command exited with code ".concat(exitCode, ".")));
            }
            // Copy HBC bundle to overwrite JS bundle
            var source = path_1.default.join(outputFolder, bundleName + '.hbc');
            var destination = path_1.default.join(outputFolder, bundleName);
            fs_1.default.copyFile(source, destination, function (err) {
                if (err) {
                    console.error(err);
                    reject(new Error("Copying file ".concat(source, " to ").concat(destination, " failed. \"hermes\" previously exited with code ").concat(exitCode, ".")));
                }
                fs_1.default.unlink(source, function (err) {
                    if (err) {
                        console.error(err);
                        reject(err);
                    }
                    resolve(null);
                });
            });
        });
    }).then(function () {
        if (!sourcemapOutput) {
            // skip source map compose if source map is not enabled
            return;
        }
        var composeSourceMapsPath = getComposeSourceMapsPath();
        if (!composeSourceMapsPath) {
            throw new Error('react-native compose-source-maps.js scripts is not found');
        }
        var jsCompilerSourceMapFile = path_1.default.join(outputFolder, bundleName + '.hbc' + '.map');
        if (!fs_1.default.existsSync(jsCompilerSourceMapFile)) {
            throw new Error("sourcemap file ".concat(jsCompilerSourceMapFile, " is not found"));
        }
        return new Promise(function (resolve, reject) {
            var composeSourceMapsArgs = [
                sourcemapOutput,
                jsCompilerSourceMapFile,
                '-o',
                sourcemapOutput,
            ];
            // https://github.com/facebook/react-native/blob/master/react.gradle#L211
            // index.android.bundle.packager.map + index.android.bundle.compiler.map = index.android.bundle.map
            var composeSourceMapsProcess = (0, exports.spawn)(composeSourceMapsPath, composeSourceMapsArgs);
            interaction_1.out.text("".concat(composeSourceMapsPath, " ").concat(composeSourceMapsArgs.join(' ')));
            composeSourceMapsProcess.stdout.on('data', function (data) {
                interaction_1.out.text(data.toString().trim());
            });
            composeSourceMapsProcess.stderr.on('data', function (data) {
                console.error(data.toString().trim());
            });
            composeSourceMapsProcess.on('close', function (exitCode) {
                if (exitCode) {
                    reject(new Error("\"compose-source-maps\" command exited with code ".concat(exitCode, ".")));
                }
                // Delete the HBC sourceMap, otherwise it will be included in 'code-push' bundle as well
                fs_1.default.unlink(jsCompilerSourceMapFile, function (err) {
                    if (err) {
                        console.error(err);
                        reject(err);
                    }
                    resolve(null);
                });
            });
        });
    });
}
exports.runHermesEmitBinaryCommand = runHermesEmitBinaryCommand;
function getHermesEnabled(gradleFile) {
    var buildGradlePath = path_1.default.join('android', 'app');
    if (gradleFile) {
        buildGradlePath = gradleFile;
    }
    if (fs_1.default.lstatSync(buildGradlePath).isDirectory()) {
        buildGradlePath = path_1.default.join(buildGradlePath, 'build.gradle');
    }
    if ((0, file_utils_1.fileDoesNotExistOrIsDirectory)(buildGradlePath)) {
        throw new Error("Unable to find gradle file \"".concat(buildGradlePath, "\"."));
    }
    return g2js
        .parseFile(buildGradlePath)
        .catch(function () {
        throw new Error("Unable to parse the \"".concat(buildGradlePath, "\" file. Please ensure it is a well-formed Gradle file."));
    })
        .then(function (buildGradle) {
        return Array.from(buildGradle['project.ext.react'] || []).some(function (line) { return /^enableHermes\s{0,}:\s{0,}true/.test(line); });
    });
}
exports.getHermesEnabled = getHermesEnabled;
function getiOSHermesEnabled(podFile) {
    var podPath = path_1.default.join('ios', 'Podfile');
    if (podFile) {
        podPath = podFile;
    }
    if ((0, file_utils_1.fileDoesNotExistOrIsDirectory)(podPath)) {
        throw new Error("Unable to find Podfile file \"".concat(podPath, "\"."));
    }
    return new Promise(function (resolve, reject) {
        fs_1.default.readFile(podPath, { encoding: 'utf8' }, function (error, res) {
            if (error) {
                reject(error);
                return;
            }
            resolve(/:hermes_enabled(\s+|\n+)?=>(\s+|\n+)?true/.test(res));
        });
    });
}
exports.getiOSHermesEnabled = getiOSHermesEnabled;
function getHermesOSBin() {
    switch (process.platform) {
        case 'win32':
            return 'win64-bin';
        case 'darwin':
            return 'osx-bin';
        case 'freebsd':
        case 'linux':
        case 'sunos':
        default:
            return 'linux64-bin';
    }
}
function getHermesOSExe() {
    var hermesExecutableName = (0, validation_utils_1.isLowVersion)(getReactNativeVersion(), '0.63.0')
        ? 'hermes'
        : 'hermesc';
    switch (process.platform) {
        case 'win32':
            return hermesExecutableName + '.exe';
        default:
            return hermesExecutableName;
    }
}
function getHermesCommand() {
    var fileExists = function (file) {
        try {
            return fs_1.default.statSync(file).isFile();
        }
        catch (e) {
            return false;
        }
    };
    // Hermes is bundled with react-native since 0.69
    var bundledHermesEngine = path_1.default.join("node_modules", "react-native", "sdks", "hermesc", getHermesOSBin(), getHermesOSExe());
    if (fileExists(bundledHermesEngine)) {
        return bundledHermesEngine;
    }
    // assume if hermes-engine exists it should be used instead of hermesvm
    var hermesEngine = path_1.default.join('node_modules', 'hermes-engine', getHermesOSBin(), getHermesOSExe());
    if (fileExists(hermesEngine)) {
        return hermesEngine;
    }
    return path_1.default.join('node_modules', 'hermesvm', getHermesOSBin(), 'hermes');
}
function getComposeSourceMapsPath() {
    // detect if compose-source-maps.js script exists
    var composeSourceMaps = path_1.default.join('node_modules', 'react-native', 'scripts', 'compose-source-maps.js');
    if (fs_1.default.existsSync(composeSourceMaps)) {
        return composeSourceMaps;
    }
    return null;
}
function getReactNativeVersion() {
    try {
        // eslint-disable-next-line security/detect-non-literal-require
        var projectPackageJson = require(path_1.default.join(process.cwd(), 'package.json'));
        var projectName = projectPackageJson.name;
        if (!projectName) {
            throw new Error("The \"package.json\" file in the CWD does not have the \"name\" field set.");
        }
        return (projectPackageJson.dependencies['react-native'] ||
            (projectPackageJson.devDependencies &&
                projectPackageJson.devDependencies['react-native']));
    }
    catch (error) {
        throw new Error("Unable to find or read \"package.json\" in the CWD. The \"release-react\" command must be executed in a React Native project folder.");
    }
}
exports.getReactNativeVersion = getReactNativeVersion;
