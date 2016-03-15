(function() {
    "use strict";

    const Hapi = require('hapi');
    const H2O2 = require('h2o2');
    const Wreck = require('wreck');
    const Snyk = require('snyk');

    const server = new Hapi.Server();

    var packageCache = {};

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
                tests = [];

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
                            });
                        }
                    })
                );
            });

            Promise.all(tests).then(function(){
                reply(payload);
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

    server.start(handleServerStart);

})();