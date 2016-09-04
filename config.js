// Implements a simple interface for the configuration & package cache
// Configuration should allow this to eventually be replaced
//   by a DB or service call to provide a central packageCache for multiple instances

const fs = require('fs');
const dataPath = './data/';
const configFile = 'config.json';

const defaultConfig = {
    cacheTime: 864e5, // milliseconds in a day
    cacheFile: 'packageCache.json',
    log: true,
    logErrors: false,
    npmServerURL: 'https://registry.npmjs.org/',
    serverPort: 3000
};

const settings = defaultConfig;

const packageCache = {};

// Blatantly adapted from github.com/tarruda/has
// Because sparse objects are real and great and ruin everything.
const has = Function.bind.call(Function.call, Object.prototype.hasOwnProperty);


/**
 * Console.log wrapper with config flag
 * @param args
 */
function log(...args) {
    if (settings.log === false) {
        return;
    }
    console.log(...args);
}

function errlog(...args) {
    if (settings.logErrors === false) {
        return;
    }
    console.log(...args);
}


/**
 * Deletes all keys from the object
 * This is inefficient, but ensures the object reference is unchanged.
 * @param {object} obj
 */
function emptyObject (obj) {
    Object.keys(obj).forEach(function (key){
        delete obj[key];
    });
}

/**
 * Update the settings values
 * @param {Object} newSettings
 * @returns {Promise}
 */
function changeSettings (newSettings) {
    // Only allow the injection of settings we already have/accept
    Object.keys(settings).forEach(function(key){
        if (has(newSettings, key)) {
            settings[key] = newSettings[key];
        }
    });
    // Save it to disk
    return saveConfigFile();
}


function checkOrMakeDir(path){

    return new Promise(function (resolve, reject) {

        // Returns are because I hate nesting try/catch
        try {
            fs.statSync(path);
            resolve('existed');
            return;
        } catch (e) {
            if (e.code !== 'ENOENT') {
                reject(err);
                return;
            }
        }
        // Now make the directory
        try {
            fs.mkdirSync(path);
            resolve('created');
        } catch(e) {
            logerr(err);
            reject(err);
        }
    });
}

/**
 * Load the config file
 * @returns {Promise}
 */
function loadConfigFile() {
    return new Promise(function (resolve, reject) {
        const path = dataPath + configFile;
        fs.readFile(path, function (err, data) {

            if (!err) {
                try {
                    // Merge config into settings
                    Object.assign(settings, JSON.parse(data));
                    log('Loaded ' + configFile);

                } catch (e) {
                    log('Config file is not valid JSON. Using defaults.');
                }
            } else {
                if (err.code === 'ENOENT') {
                    // Save a default if none exists. Otherwise, leave it alone and log the error.
                    log('Config not found. Creating default config.json.');
                    saveConfigFile();
                } else {
                    errlog(err);
                }
            }

            // Always returns settings
            resolve(settings);
        });
    });
}

/**
 * Serializes and saves the packageCache to a file
 * This could be more robust... it is possible to create a self-reference
 *   that would cause JSON.stringify to error
 * @returns {Promise}
 */
function saveConfigFile() {

    return checkOrMakeDir(dataPath).then(function(){
        const output = JSON.stringify(settings, undefined, 1);
        return new Promise(function (resolve, reject){

            const path = dataPath + configFile;
            fs.writeFile(path, output, function (err){
                if (err) {
                    log('Unable to save', configFile);
                    errlog(err);
                    reject(err);
                } else {
                    log('Saved', configFile);
                    resolve();
                }
            });
        });
    }, function(err){
        log('Unable to access data directory. No config will be saved.');
        throw err;
    });

}

/**
 *
 * @param {Boolean?} merge - will merge unless explicity set to false
 * @param {Boolean?} noFail - if true, always resolve. Useful if data file may not exist.
 * @returns {Promise}
 */
function loadPackageCacheFile(merge, noFail) {
    const shouldMerge = merge !== false;

    return new Promise(function (resolve, reject) {
        const path = dataPath + settings.cacheFile;
        fs.readFile(path, function (err, data) {

            if (err) {
                if (noFail === true) {
                    resolve(packageCache);
                } else {
                    reject(err);
                }
                return;
            }

            try {
                const pkg = JSON.parse(data);

                // Empty the object if not merging. We can't change the reference or exports doesn't work properly.
                if (shouldMerge === false) {
                    emptyObject(packageCache);
                }

                Object.assign(packageCache, pkg);

                resolve(packageCache);

            } catch(e) {
                if (noFail === true) {
                    resolve(packageCache);
                } else {
                    reject(e);
                }
            }
        });
    }).then(function (cache){
        log('Loaded ' + settings.cacheFile);

        return cache;
    });
}

/**
 * Serializes and saves the packageCache to a file
 * This could be more robust... it is possible to create a self-reference
 *   that would cause JSON.stringify to error
 * @returns {Promise}
 */
function savePackageCacheFile() {

    return checkOrMakeDir(dataPath).then(function(){
        const output = JSON.stringify(packageCache, undefined, 1);
        return new Promise(function (resolve, reject){

            const path = dataPath + settings.cacheFile;
            fs.writeFile(path, output, function (err){
                if (err) {
                    errlog(err);
                    reject(err);
                } else {
                    log('Saved packageCache.');
                    resolve('saved');
                }
            });
        });
    }, function(err){
        log('Unable to access data directory. No packageCache will be saved.');
        throw err;
    });

}

function setPackageCacheEntry(key, valid) {
    packageCache[key] = {
        valid: valid,
        timestamp: Date.now()
    }
}

function checkPackageCacheEntry(key) {
    let cachedState = packageCache[key];

    if (typeof cachedState === 'undefined') {
        return undefined;
    }

    if (typeof cachedState !== 'object' ||  !has(cachedState, 'valid') || !has(cachedState, 'timestamp')) {
        log('Bad or outdated record for',key);
        // Bad entries should be removed
        cachedState[key] = undefined;
        return false;
    }

    if (cachedState.timestamp + settings.cacheTime < Date.now()) {
        cachedState[key] = undefined;
        return undefined;
    }

    return cachedState.valid;
}

/* TODO - consider removing exposure of packageCache and replacing it with a getter & setter
 * That would allow the removal of the emptyObject functionality,
 * And sanitization on the setter would guarantee the no self-reference loops in the stringify command
 */

// Load settings immediately. Use the promise chain for the export.
module.exports = loadConfigFile().then(function(){
    return loadPackageCacheFile(true, true);
}).then(function(){
    return {
        cache: {
            get: checkPackageCacheEntry,
            set: setPackageCacheEntry,
            save: savePackageCacheFile,
            object: packageCache
        },
        config: {
            update: changeSettings,
            settings: settings
        }
    };
});
