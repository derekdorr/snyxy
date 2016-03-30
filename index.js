(function() {
    "use strict";

    const Hapi = require('hapi');
    const H2O2 = require('h2o2');
    const Wreck = require('wreck');
    const Snyk = require('snyk');

    const cache = require('./cache');

    const server = new Hapi.Server();

    const packageCache = cache.cache;

    function throwErrors(err) {
        if (err) {
            throw err;
        }
    }

    function handleServerStart(err) {
        throwErrors(err);

        console.log('server running on: ',server.info.uri);
    }

    function handleRegistryRequest(request, callback) {
        callback(null, 'https://registry.npmjs.org/' + request.params.path);
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
                        let cachedState = packageCache[toTest];

                        if (cachedState !== undefined) {
                            if (cachedState === true) {
                                console.log('good:', toTest, '(from cache)');
                            } else {
                                delete versions[value];
                                console.log('bad:', toTest, '(from cache)');
                            }
                            resolve();
                        } else {
                            Snyk.test(toTest).then(function (data) {
                                if (data.ok !== true) {
                                    console.log('bad:', toTest);
                                    packageCache[toTest] = false;
                                    delete versions[value];
                                } else {
                                    packageCache[toTest] = true;
                                    console.log('good:', toTest);
                                }
                                resolve();
                                cacheChanged = true;
                            }, function (data) {
                                let sanitized = data || {};

                                if (sanitized.ok !== true) {
                                    console.log('bad:', toTest);
                                    packageCache[toTest] = false;
                                    delete versions[value];
                                } else {
                                    packageCache[toTest] = true;
                                    console.log('good:', toTest);
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
                    cache.save();
                }
            });

        });
    }


    server.connection({port: 3000});

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
    });

    // Load the stored cache. Using merge and noFail
    cache.load(true, true).then(function(){

        // Once the package cache is available, start the server
        server.start(handleServerStart);
    });

})();
