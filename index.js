(function() {
    "use strict";

    const Hapi = require('hapi');
    const H2O2 = require('h2o2');
    const Wreck = require('wreck');
    const Snyk = require('snyk');

    const configPromise = require('./config');

    const server = new Hapi.Server();

    let packageCache;
    let config;

    function log(...args) {
        if (config.log === false) {
            return;
        }
        console.log(...args);
    }

    function throwErrors(err) {
        if (err) {
            throw err;
        }
    }

    function handleServerStart(err) {
        throwErrors(err);

        log('server running on: ',server.info.uri);
    }

    function handleRegistryRequest(request, callback) {
        callback(null, config.npmServerURL + request.params.path);
    }

    function handleRegistryResponse(err, res, request, reply, settings, ttl) {
        Wreck.read(res, {json: true}, function(err, payload) {
            throwErrors(err);

            var versions = payload.versions,
                keys = Object.keys(versions),
                path = request.params.path,
                tests = [],
                cacheChanged = false;

            keys.forEach(function(value){
                tests.push(
                    new Promise(function(resolve) {
                        let toTest = `${path}@${value}`;
                        let validState = packageCache.get(toTest);

                        if (validState !== undefined) {

                            if (validState === true) {
                                log('good:', toTest, '(from cache)');
                            } else {
                                delete versions[value];
                                log('bad:', toTest, '(from cache)');
                            }
                            resolve(validState);
                        } else {
                            Snyk.test(toTest).then(function (data) {
                                if (data.ok !== true) {
                                    log('bad:', toTest);
                                    packageCache.set(toTest, false);
                                    delete versions[value];
                                } else {
                                    packageCache.set(toTest, true);
                                    log('good:', toTest);
                                }
                                resolve();
                                cacheChanged = true;
                            }, function (data) {
                                let sanitized = data || {};

                                if (sanitized.ok !== true) {
                                    log('bad:', toTest);
                                    packageCache.set(toTest, false);
                                    delete versions[value];
                                } else {
                                    packageCache.set(toTest, true);
                                    log('good:', toTest);
                                }
                                resolve();
                                cacheChanged = true;
                            });
                        }
                    })
                );
            });

            Promise.all(tests).then(function(){
                reply(payload);

                // Save changes to the packageCache
                if (cacheChanged) {
                    packageCache.save();
                }
            });

        });
    }

    // Once the package cache is available, start the server
    configPromise.then(function(mod) {
        packageCache = mod.cache;
        config = mod.config.settings;

        server.connection({port: config.serverPort});

        server.register([H2O2],function(err){

            throwErrors(err);

            server.route({
                method: "GET",
                path: "/{path*}",
                handler: {
                    proxy: {
                        mapUri: handleRegistryRequest,
                        onResponse: handleRegistryResponse
                    }
                }
            });


            server.start(handleServerStart);
        });
    });

})();
