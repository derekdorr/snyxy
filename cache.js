// Implements a simple interface for the package cache that can be loaded and saved.
// Configuration should allow this to eventually be replaced
//   by a DB or service call to provide a central packageCache for multiple instances

const fs = require('fs');

const settings = {
    fileName: 'packageCache.json',
    filePath: './data/'
};

var packageCache = {};

// Blatantly adapted from github.com/tarruda/has
// Because sparse objects are real and great and ruin everything.
const has = Function.bind.call(Function.call, Object.prototype.hasOwnProperty);

/**
 * Update the settings values
 * @param {Object} newSettings
 */
function changeSettings (newSettings) {
    // Only allow the injection of settings we already have/accept
    Object.keys(settings).forEach(function(key){
        if (has(newSettings, key)) {
            settings[key] = newSettings[key];
        }
    });
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
 *
 * @param {Boolean?} merge - will merge unless explicity set to false
 * @param {Boolean?} noFail - if true, always resolve. Useful if data file may not exist.
 * @returns {Promise}
 */
function loadFile(merge, noFail) {
    const shouldMerge = (merge === false) ? false : true;

    return new Promise(function (resolve, reject) {
        const path = settings.filePath + settings.fileName;
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
                const package = JSON.parse(data);

                // Empty the object if not merging. We can't change the reference or exports doesn't work properly.
                if (shouldMerge === false) {
                    emptyObject(packageCache);
                }

                Object.assign(packageCache, package);

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
        console.log('Loaded packageCache');

        return cache;
    });
}

/**
 * Serializes and saves the packageCache to a file
 * This could be more robust... it is possible to create a self-reference
 *   that would cause JSON.stringify to error
 * @returns {Promise}
 */
function saveFile() {
    const output = JSON.stringify(packageCache, undefined, 1);
    return new Promise(function (resolve, reject){

        const path = settings.filePath + settings.fileName;
        fs.writeFile(path, output, function (err){
            if (err) {
                reject(err);
            } else {
                console.log('Saved packageCache');
                resolve();
            }
        });
    });
}

/* TODO - consider removing exposure of packageCache and replacing it with a getter & setter
 * That would allow the removal of the emptyObject functionality,
 * And sanitization on the setter would guarantee the no self-reference loops in the stringify command
 */

module.exports = {
    settings: changeSettings,
    load: loadFile,
    save: saveFile,
    cache: packageCache
};
