# Snyxy

## Status

Under development.  This is more of a proof of concept at the moment than something for extended use.  PLEASE BE CAREFUL and realize that it may not work like you expect.

## About

Running on Hapi and utilizing Snyk, provides a proxy to the npm registry.  This proxy utilizes snyk to check packages for vulnerabilities in real-time and to ensure that you do not install any packages to your project with known vulnerabilities.

## To Use

To start, clone to your local machine and run:

            node index.js

To use, edit your npm config:

            npm config edit

Add the following line (localhost should be considered a placeholder. Obtain the actual address from the console output when you started the app):

            registry=http://localhost:3000
