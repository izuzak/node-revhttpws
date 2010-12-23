RevHTTPWS
=========

revhttpws is a programmable HTTP and WS tunnel - it exposes a remote HTTP or WS application by giving it an URI and tunneling all requests for that URI to the application using WebSockets. In essence, it gives you a HTTP and WebSockets server inside a Web browser using a revhttpws proxy. Inspired by the [ReverseHTTP specification](http://reversehttp.net/reverse-http-spec.html).

There are two parts of RevHTTPWS: the proxy-server and the helper JS library to be used by applications to connect to the proxy-server, obtain URIs and serve requests.

RevHTTPWS is implemented in [NodeJS](http://www.nodejs.org).

Motivation
----------

TODO.

Status
------

Pre-alpha! It's working for basic use-cases but it's not tested and many things/bugs are left to be done (see Todo). Nevertheless, this is more of research-prototype/proof-of-concept type of project than production-level software.

I'm using Node and Chromium for testing, for now. The project hasn't been tested in other browsers and environments.

Installation
------------

You will need [NodeJS](http://www.nodejs.org).

Currently, the only way to install RevHTTPWS is to clone the repository:

    git clone git://github.com/izuzak/node-revhttpws.git

I'll be adding a npm install when the project is stable enough for it.

Dependencies
------------

[node-websocket-server](https://github.com/miksago/node-websocket-server) (by Micheil Smith). [LICENSE](https://github.com/miksago/node-websocket-server/blob/master/LICENSE.md)

    npm install websocket-server

[node-dirty](https://github.com/felixge/node-dirty) (by Felix Geisendörfer). [LICENSE](https://github.com/felixge/node-dirty/blob/master/LICENSE.txt)

    npm install dirty

[websocket-client](https://github.com/pgriess/node-websocket-client) (by Peter Griess). [LICENSE](https://github.com/pgriess/node-websocket-client/blob/master/LICENSE)

    npm install websocket-client

API
---

TODO.

Running the HelloWorld example
------------------------------

There are three steps in running an example:

1. running or using an existing revhttpws proxy-server
2. running the application exposing services using the proxy (e.g. starting a Web page in a browser that connects to the proxy-server, registers an URI and starts serving requests forwarded to it by the proxy-server)
3. running a client requesting exposed services (e.g. curl-ing the URI registered by the Web page in step 2.)

Or skip setting up everything yourself and see a working example at: [http://jsbin.com/opadu4/2](http://jsbin.com/opadu4/2)

### Running or using an existing revhttpws proxy-server

You can either start your own server or use my testing server at ws://revhttpws.ivanzuzak.info:8080. WARNING: this server is for testing purposes ONLY. It may be shut down, erased or redirected at any time, without notice. If you want to use the testing server, you can skip the rest of this step and continue from "Running the application exposing services using the proxy".

To start your own server, you will need to have a registered domain name with a wildcard A record pointing to the IP address on which the server will run. E.g. let's say you own the domain "smartdomainname.com" and that the server will run on 166.166.166.166 port 9090 - you will need to add "*.revhttpws.smartdomainname.com A 166.166.166.166"

Next, edit the /bin/server.js file and edit the options passed to the server and modify the IP and port on which the server will run:

    var server = revhttpws.createServer({
      "debug" : true,
      "database" : "revhttpws-uris.db",
      "domainSufix" : 'revhttpws.smartdomainname.com',
      "clientPrefix" : "cp",
      "requestPrefix" : "rp"
    }, function () {
      server.listen(9090, '166.166.166.166');
    });

If you don't have a registered domain, you can use localhost by editing the /etc/hosts file, as described in the "Running the tests" sectio

Run the server:

    node bin/server.js

### Running the application exposing services using the proxy

Edit the examples/hello-world/helloWorld.html file in two places and replace localhost with your domain and port:

    var serverDomain = "revhttpws.smartdomainname.com";
    var serverPort = "9090";     

If you want to use the testing server - set edit the file to read: 

    var serverDomain = "revhttpws.ivanzuzak.info";
    var serverPort = "9090";

Save, close, and open the page in a browser. The Web page will connect to the proxy-server, register an URI and start a simple HTTP service responding to requests with "HELLO WORLD". Furthermore, the service will log all received requests in a DIV.

The Web page itself will make an AJAX call to the service and output the result in a DIV. However, if you want to call the service from another browser window - read on.

### Running a client requesting exposed services 

Open a new window in a browser and copy/paste the URL from the Web page (it will look something like this):

    http://helloworld217772960895672.rp.revhttpws.smartdomainname.com:9090

For more examples, see the examples and test folders.

Running the tests
-----------------

To run the tests:

First, edit /etc/hosts and append:

    127.0.0.1 cp.localhost
    127.0.0.1 test1.rp.localhost

Next, run the test script:

    node test/test-client-node.js

Don't worry if the test outputs 3 errors at the bottom, it's a result of closing websocket connections.

Todo
----

[Many, many things.](https://github.com/izuzak/node-revhttpws/blob/master/TODO.md)

License
-------

[Apache 2.0](https://github.com/izuzak/node-revhttpws/blob/master/LICENSE)
