# Snyxy

## Status

Under development.  This is more of a proof of concept at the moment than something for extended use.  PLEASE BE CAREFUL and realize that it may not work like you expect.

## About

Running on Hapi and utilizing Snyk, provides a proxy to the npm registry.  This proxy utilizes snyk to check packages for vulnerabilities in real-time and to ensure that you do not install any packages to your project with known vulnerabilities.

## To Use

To start, clone to your local machine and run:
```bash
node index.js
```
To use, edit your npm config:
```bash
npm config edit
```
Add the following line (localhost should be considered a placeholder. Obtain the actual address from the console output when you started the app):
```vim
registry=http://localhost:3000
```
## To Configure

After first run, Synxy will generate a `data/config.json` which can be manipulated. The options are:

* __\[cacheFile = "packageCache.json"\]__: The name of the packageCache file to load and save. Default
* __\[cacheSaveFrequency = 30000\]__: Throttling in milliseconds for saving the packageCache to prevent filesystem overload on a busy server. Default is 30 seconds.
* __\[cacheTime = 864e5\]__: Amount of time in milliseconds to trust locally cached Synk.io data. Default is one day.
* __\[log = true\]__: Whether to log to console. You should set this to false in production.
* __\[logErrors = false\]__: Whether to log errors to console. These are primarily filesystem errors.
* __\[npmServerUrl = "https://registry.npmjs.org/"\]__: The npm request URL. Defaults to the public npm url.
* __\[serverPort = 3000\]__: The port on which snyxy will accept requests.
