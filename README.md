RevHTTPWS
=========

revhttpws is a programmable HTTP and WS tunnel - it exposes a remote HTTP or WS application by giving it an URI and tunneling all requests for that URI to the application using WebSockets. In essence, it gives you a HTTP and WebSockets server inside a Web browser using a revhttpws proxy. Inspired by the [ReverseHTTP specification](http://reversehttp.net/reverse-http-spec.html).

There are two parts of RevHTTPWS: the proxy-server and the helper JS library to be used by applications to connect to the proxy-server, obtain URIs and serve requests.

RevHTTPWS is implemented in [NodeJS](http://www.nodejs.org).

Motivation
----------

A peer-to-peer WorldWideWeb (insted of a client-server model) - any entity may obtain an URI and be communicated with using Web protocols (browsers, TV widgets, anything). Browser-to-browser communication. See the [BrowserAccess GitHub project](https://github.com/tomek22/BrowserAccess) - another similar project that aims to unify two approaches for accessing Web applications executing in the browser: browser extensions and a reverseHTTP proxy.

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

### RevHttpWs proxy-server

The revhttpws-server library exposes a single method for creating a revhttpws server object:

    var server = revhttpws.createServer(options, callback);

where `options` is a map of the following parameters:

* (optional) `debug` - switch for turning console debug messages on (`true`) or off (`false`) (default: `false`)
* (optional) `database` - name of file which will be used as a database for peristing domain registrations (default: `'revhttpws.db'`)
* (optional) `domainSufix` - higher-level domain on which the proxy will run and on which subdomains will be handed out (default: `'localhost'`)
* (optional) `clientPrefix` - the domain prefix for the domainSufix on which applications requesting access to the revhttpws proxy server may connect to. (default: `'cp'`). For example, if the domainSufix is `localhost` and clientPrefix is `clients` and the server is running on port `8080`, then opening a WebSocket connection to `ws://clients.localhost:8080` will establish a connection with the server for the purpose of registering domains and attaching handlers for various schemes on that domain. This is also the URI which should be passed to the revhttpws-client library explained below when calling the `connect` method.
* (optional) `requestPrefix` - the domain prefix for the domainSufix domain on which HTTP and WS requests for registered domains will be handled. (default: `'rp'`) For example, if the domainSufix is `localhost` and requestPrefix is `requests` and the server is running on port `8080`, then sending a HTTP request to `http://someregistereddomain.requests.localhost:8080/` will result in the request being forwarded to the handler registered for the `someregistereddomain` subdomain and `http` prtocol/scheme.

and `callback` is a parameter-less function that will be called when the server object finishes with loading entries from the database.

The revhttpws server object exposes the following methods:

####    server.listen(port, ipAddress);
which starts the server by listening for requests on `port` port and IP address `ipAddress`.

####    server.close();
which gracefully shuts down the server.

Example:

    var revhttpws = require('lib/revhttpws-server.js');
    
    var server = revhttpws.createServer({
      'debug' : true,
      'database' : 'revhttpws-uris.db',
      'domainSufix' : 'revhttpws.ivanzuzak.info',
      'clientPrefix' : 'cp',
      'requestPrefix' : 'rp'
    }, function () {
      server.listen(8080, '161.53.65.205');
    });
    
    function closeServer() {
      server.close();
    }

### RevHttpWs JavaScript library for accessing the revhttpws proxy server

The revhttpws-client library exposes an API for connecting to the revhttpws proxy server (using WebSockets) and performing various operations on the server. The revhttpws-client library (revhttpws-client.js) may be used in a browser environment (using the `<script>` tag) or in nodejs applications (using `require`):

    <script type="text/javascript" src="revhttpws-client.js"></script>   
for use in a browser application and
    
    var RevHttpWsClient = require('./../lib/revhttpws-client.js').RevHttpWsClient;
for use in a nodejs application.

The library functionallity is accessed through the RevHttpWsClient object which must be instantiated:

    var client = new RevHttpWsClient(options);
    
where `options` is a map of the following parameters: 

* (optional) `debug` - switch for turning console debug messages on (`true`) or off (`false`) (default: `false`)
    
The RevHttpWsClient object exposes the following methods:

####    client.connect(revhttpwsServerUri, function(err, res) { ... });

which connects to the revhttpws proxy server. `revhttpwsServerUri` is an URI string for connecting to the revhttpws proxy server (see `clientPrefix` option in revhttpws-server `createServer` method). `err` is set if an error occured while connecting to the server, `res` is the client object on which the `connect` method was called.

Example:

    client.connect('ws://cp.revhttpws.ivanzuzak.info', function(connectErr, connectRes) { 
      if (connectErr) {
        alert("BOINK!");
      } else {
        // useful stuff here
      }
    });
 
 
####    client.disconnect();
which disconnects from the revhttpws proxy server.

####    client.registerDomain(params, function(err, res) { ... });
which registers a subdomain on the revhttpws proxy server in order to serve requests on that subdomain for various schemes/protocols. `params` is a map of the following parameters for registering a subdomain:

* (mandatory) `domain` - string defining the subdomain you want to register (e.g. `'helloworld123'`)
* (optional) `token` - a string defining the security token for the registering domain. This token is used in subsequent operations of the domain, such as attaching a handler. If not specified, a random token is generated.

`err` is set if an error occured while registering a domain. `res` is the response object received from the proxy server, a map containing the following elements:

* `success` - `true` if the register operation succeeded, `false` otherwise.
* `errorMsg` - a string contaning the error message if success was `false`.
* `domain` - echo of the subdomain string defined in the registerDomain method `domain` parameter.
* `realSufix` - the full domain which was registered, consisting of the `domain` parameter prefix and server-specific sufix. For example, if the `helloworld123` subdomain was requested for registration, the full domain reserved by the proxy server could be `helloWorld123.rp.revhttpws.ivanzuzak.info`.
* `token` - echo of the security token string defined in the registerDomain method `token` parameter.

Example:

    client.registerDomain({ domain : "helloWorldDomain123", token : "helloToken" },
      function(registerErr, registerRes) { 
        if (registerErr) {
          alert("BOINK!");
        } else {
          // useful stuff here
        }
      }
    });


####    client.unregisterDomain(params, function(err, res) { ... }); 
which unregisters a subdomain on the revhttpws proxy server. `params` is a map of the following parameters for unregistering a subdomain:

* (mandatory) `domain` - string defining the subdomain to be unregisterer (e.g. `'helloworld123'`).
* (mandatory) `token` - a string defining the security token for the domain to be unregistered (defined at registration).

`err` is set if an error occured while unregistering a domain.  `res` is the response object received from the proxy server, a map containing the following elements:

* `success` - `true` if the unregister operation succeeded, `false` otherwise.
* `errorMsg` - a string contaning the error message if success was `false`.
* `domain` - echo of the subdomain string defined in the unregisterDomain method `domain` parameter.

Example:

    client.unregisterDomain({ domain : "helloWorldDomain123", token : "helloToken" },
      function(unregisterErr, unregisterRes) { 
        if (unregisterErr) {
          alert("BOINK!");
        } else {
          // useful stuff here
        }
      }
    });

####    client.attachHandler(params, function(err, res) { ... }); 
which attaches a handler for a specific protocol on a previously registered subdomain. The currently supported protocols are HTTP and WebSockets. In essence, the attach handler operation yields an URI with either the HTTP and WS schemes and enables applications to server requests sent to that URI. A domain may have a single handler attached per protocol/scheme (ie. 1 for HTTP, 1 for WS). `params` is a map of the following parameters for attaching a handler:

* (mandatory) `domain` - a string defining a previously registered subdomain to which a handler should be attached (e.g. 'helloworld123')
* (mandatory) `scheme` - a string defining the protocol scheme which the handler will handle (currently only 'http' or 'ws')
* (mandatory) `token` - a string defining the security token for the domain (defined at registration).
* (mandatory) `handler` - a function that is the handler for this scheme and domain combination. Depending on the scheme, the handler must have a specific signature and functionallity. See examples below for more info.

`err` is set if an error occured while attaching a handler,  `res` is the response object received from the proxy server, a map containing the following elements:

* `success` - `true` if the attach operation succeeded, `false` otherwise.
* `errorMsg` - a string contaning the error message if success was `false`.
* `domain` - echo of the subdomain string defined in the attachHandler method `domain` parameter.
* `scheme` - echo of the scheme string defined in the attachHandler method `scheme` parameter.

HTTP Example:

    var helloHandler = function(request, response) {
      if (request.method === "GET" && request.headers['someHeader'] !== "x" && request.bodyText === "") {
        response.bodyText = "<b> HELLO WORLD! </b><br></br>";
        response.headers = {"Content-Type" : "text/html", "Access-Control-Allow-Origin" : "*"};
        response.status = 200;
        response.send();
      }
    };
    
    var handlerParams = { 
      domain : "helloWorldDomain", 
      scheme : "http", 
      token : "helloToken", 
      handler : helloHandler
    };

    client.attachHandler( handlerParams, function(attachErr, attachRes) { 
      if (attachErr) {
        alert("BOINK!");
      } else {
        // useful stuff here
      }
    } );
          
WebSockets Example:

    var wsHandler = function(newWebSocket) {
      newWebSocket.onmessage = function(msg) {
        newWebSocket.send("ECHO " + msg.data);   
        setTimeout( function() { newWebSocket.close(); }, 4000 );
      };
      
      newWebSocket.onerror = function() { console.log("WS ERROR"); };
      newWebSocket.onclose = function() { console.log("WS CLOSE"); };      
    };
    
    var handlerParams = { 
      domain : "wsDomain", 
      scheme : "ws", 
      token : "wsToken", 
      handler : wsHandler
    };
    
    client.attachHandler( handlerParams, function(attachErr, attachRes) { 
      if (attachErr) {
        alert("BOINK!");
      } else {
        // useful stuff here
      }
    } );


####    client.detachHandler(params, function(err, res) { ... }); 
- detaches a previously attached handler. `params` is a map of the following parameters for detaching a handler:

* (mandatory) `domain` - a string defining a previously registered subdomain from which a handler should be detached (e.g. 'helloworld123')
* (mandatory) `scheme` - a string defining the protocol scheme from which the handler should be detached (currently only 'http' or 'ws')
* (mandatory) `token` - a string defining the security token for the domain (defined at registration).

- `err` is set if an error occured while detaching a handler, `res` is the client object on which the `detachHandler` method was called.

* `success` - `true` if the detach operation succeeded, `false` otherwise.
* `errorMsg` - a string contaning the error message if success was `false`.
* `domain` - echo of the subdomain string defined in the detachHandler method `domain` parameter.
* `scheme` - echo of the scheme string defined in the detachHandler method `scheme` parameter.

Example:

    var detachParams = { 
      domain : "wsDomain", 
      scheme : "ws", 
      token : "wsToken", 
    };

    res.detachHandler(detachParams, function(detachErr, detachRes) {
      if (detachErr) {
        alert("BOINK!");
      } else {
        // useful stuff here
      }
    } );

Obviously, the order in which the methods should be called is connect -> registerDomain -> attachHandler -> detachHandler -> unregisterDomain -> disconnect.

See the [helloWorld example](https://github.com/izuzak/node-revhttpws/tree/master/examples/hello-world) for a full example.

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
