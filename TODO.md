# RevHttpWs Todo List

## Split proxy-server into multiple servers in a single process

Split the HTTP/WS server which accepts all connections (application and client) on a single port into multiple HTTP/WS servers: one secure WS server for accepting connections from applications using the proxy and N servers for each supported protocol scheme (http, ws, https, wss, etc.). This will enable the proxy-server to suport registering only http and ws URIs and will enable a secure connection between applications and the proxy (needed so that security tokens don't get passed around in cleartext).

## Redesign proxy-server so that it has a core component and plugins for supported protocols/schemes

The core component of the proxy would be in charge of maintaining data structures for registering domains and handlers and methods for manipulating those data structures. Plugins would be in charge of starting a server and handling messages for a specific protocol/scheme. This is a much clearer design and will enable easier support of other protocols.

## Better and broader testing

Currently there is only a single sanity-check test. Furthermore, there should be tests that can be run in Node and tests that can be run in browsers.

## More examples

Currently there is only a single Hello World example for showing of RevHTTPWS. I have several other in the works:
* Path-based dispatcher + CORS handler example
* Cross-browser RPC example 
* HTML5 Peer-to-peer connections example

## Better logging

Currently logging is supported through a single debug ON/OFF switch and is based on dumping as much information as possible to stdout. A better idea would be to reduce introduce some information which is outputted in every case and organize the rest to be more concise. Furthermore, I'd like to enable outputting the log to a file, which shouldn't be hard to do.

## Implement a simple Web application GUI for administering revhttpws

Currently, the only way to register/unregister domains is through the API and there is no way of knowing which domains are registered, what's the current status of the server, manage users/api-keys etc. I think the proxy-server could use a simple Web app interface for those kinds of things, which could run in the same process as the proxy (e.g. as a separate server).

## Come up with some form of user/application/key management

Currently, anyone may use the API to register any number of domains. It may be useful to define concept of an application developer which may have X api-keys where each api-key may be used to register Y domains. 

## Implement various timeouts for registered domains and handlers

Currently, a registered domain is registered until it is unregistered. This model may be advanced by timeouts so that a domain may be unregistered after a certain time has passed, after a certain number of messages have been exchanged, after a certain number of megabytes have been exchanged or if more than X timeunits have passed from last activity.

## Better exception handling

Currently, any exception thrown will bring the server down so better exception handling is needed and a mechanism for automatically restarting the server when it crashes.

## Socket.IO support

Currently, pure WebSocket connections are used for connecting to the proxy-server from an application wanting to register an URI (e.g. a Web application executing in a browser). This limits the number of browsers which can use RevHTTPWS. Therefore, switching to a Socket.IO connection for that part of the proxy-server seems like a good idea.

## Some messages should be split up into multiple messages

Messages that have options (eg. client/server) should be separated into two messages for clarity.

## Fix a bug which causes the server to expect that the host header should always contain a port number.

isValid... methods expect that a port number is present in the host header, when actually it may not be.

## Calling user callbacks should be the last thing to do in a function or should be done asynchronously.

## In the client library, methods for creating messages should include a msgId.
