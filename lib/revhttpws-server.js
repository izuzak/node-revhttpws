var http = require('http');
var url = require('url');
var sys = require('sys');
var ws = require('websocket-server');
var events = require('events');
var path = require('path');
var fs = require('fs');
var util = require('util');
var Dirty = require('dirty');

function generateUUID(existingUUIDs) {
  while (true) {
    var uuid = [], nineteen = '89AB', hex = '0123456789ABCDEF', i, uuidstr;
    for (i = 0; i < 36; i += 1) {
      uuid[i] = hex[Math.floor(Math.random() * 16)];
    }
    uuid[14] = '4';
    uuid[19] = nineteen[Math.floor(Math.random() * 4)];
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    
    uuidstr = uuid.join('');
    
    if (typeof existingUUIDs !== 'undefined' && uuidstr in existingUUIDs) {
      continue;
    } else {
      return "server-" + uuidstr;
    }
  }
}

function generateToken() {
  var chars = 'abcdefgijklmnoprstuvzqwy1234567890-#$%=', len = 60, token = [], i;
  
  for (i = 0; i < len; i += 1) {
    token[i] = chars[Math.floor(Math.random() * chars.length)];
  }
  
  return token.join('');
}

function mixin(target, source, exclude, include) {
  var i, keys, l;
  
  exclude = typeof exclude === "undefined" ? [] : exclude;
  include = typeof include === "undefined" ? Object.keys(source) : include;
  
  for (i = 0, keys = Object.keys(source), l = keys.length; i < l; i += 1) {
    if (source.hasOwnProperty(keys[i]) && exclude.indexOf(keys[i]) === -1 &&
        include.indexOf(keys[i]) !== -1) {
      target[keys[i]] = source[keys[i]];
    }
  }
  
  return target;
}

function areOverlappingDomains(domain1, domain2) {
  var reverseDomain1, reverseDomain2;
  
  reverseDomain1 = domain1.split("").reverse().join("");
  reverseDomain2 = domain2.split("").reverse().join("");
  
  return reverseDomain1 === reverseDomain2 || 
    reverseDomain1.indexOf(reverseDomain2) === 0 ||
    reverseDomain2.indexOf(reverseDomain1) === 0;
}
  
//
// create RevHttpWs server
//

function createServer(opts, callback) {
  
  var options, debug = null, registeredDomains, db, 
      allConnections, domainHandlers, supportedSchemes, activeRequests,
      messageHandlers, serv;
  
  options = mixin({
    "debug" : false,                // output debugging information?
    "database" : './revhttpws.db',  // file to use for storing data
    "domainSufix" : null,           // domain of the server, will be the sufix of future registered domains
    "clientPrefix" : "cp",          // domain prefix for requests from clients registering domains and serving requests
    "requestPrefix" : "rp"          // domain prefix for requests from normal clients 
  }, opts || {});
  
  //
  // debugging
  //
  
  if (options.debug) {
    debug = function (msg) {
      sys.log('\033[90mREVHTTPWS-S: ' + Array.prototype.join.call(arguments, ", ") + "\033[39m");
    };
  } else {
    debug = function (msg) { };
  }
  
  if (options.domainSufix === null || typeof options.domainSufix !== "string") {
    sys.error('Options must specify a domain string.');
    return;
  }
  
  //
  // registration management - ***domain***.prefix.domainSufix
  //
  
  registeredDomains = {};
  db = null;
  
  function loadRegisteredDomainsDirty(cb) {
    debug('Loading registered domains from dirty database...');
    var normPath = path.normalize(options.database);
    db = new Dirty(normPath);
    
    db.on('load', function () {
      db.forEach(function (key, val) {
        debug('Found key in database: ' + key + " " + val);
        registeredDomains[key] = val;
      });
      
      cb();
    });
  }
  
  function saveRegisteredDomainsDirty(cb) {
    debug('Saving registered domains to database...');
    
    if (db.flushing) {
      db.once('drain', function () {
        cb();
      });
    } else {
      process.nextTick(cb);
    }
  }
  
  function addDomain(domain, params) {
    registeredDomains[domain] = params;
    db.set(domain, params);
    debug('Added domain ' + domain + ' to database.');
  }
  
  function removeDomain(domain) {
    delete registeredDomains[domain];
    db.rm(domain);
    debug('Removed domain ' + domain + ' from database.');
  }
  
  function isValidTokenForDomain(domain, token) {
    debug('Checking token for domain ' + domain + '...');
    return (domain in registeredDomains) && (registeredDomains[domain].token === token);
  }
  
  function canRegisterDomain(domain) {  
    var existingDomain;
    
    for (existingDomain in registeredDomains) {
      if (areOverlappingDomains(domain, existingDomain)) {
        debug('Domain ' + domain + ' may not be registered - existing domain.');
        return false;
      }
    }
    
    debug('Domain ' + domain + ' may be registered.');
    return true;
  }
  
  function removeDomainSufix(domain) {
    var invDomain, invSufix;
    invDomain = domain.split('').reverse().join('');
    invSufix = ('.' + options.requestPrefix + '.' + options.domainSufix + ":" + options.port).split('').reverse().join('');
    
    return invDomain.replace(invSufix, '').split('').reverse().join('');
  }
  
  function addDomainSufix(domain) {
    return domain + '.' + options.requestPrefix + '.' + options.domainSufix + ":" + options.port;
  }
  
  function getRegisteredDomainForHost(host) {
    debug("Fetching domain for host: " + host);
    var hostDomain, existingDomain;
    
    hostDomain = removeDomainSufix(host);

    debug("Searching for domain " + hostDomain);
    
    for (existingDomain in registeredDomains) {
      if (areOverlappingDomains(hostDomain, existingDomain)) {
        return existingDomain;
      }
    }
    
    return null;
  }
  
  //
  // connection management
  //
  
  allConnections = {};
  
  function addConnection(connection) {
    var connectionId;
    
    debug('Adding connection...');
    if ('connectionId' in connection) {
      allConnections[connectionId] = connection;
    } else {
      connectionId = generateUUID(allConnections);
      allConnections[connectionId] = connection;
      connection.connectionId = connectionId;
      debug('Added new connection with id: ' + connectionId);
    }
  }
  
  function removeConnection(connectionId) {
    debug('Removing connection with id: ' + connectionId);
    if (connectionId in allConnections) {
      delete allConnections[connectionId];
    }
  }
  
  function getIdOfConnection(connection) {
    debug('Fetching connection ID...');
    return connection.connectionId;
  }
  
  function getConnection(connectionId) {
    debug('Fetching connection for id: ' + connectionId);
    return allConnections[connectionId];
  }
  
  //
  // handler management
  //
  
  domainHandlers = {};
  supportedSchemes = ['http', 'ws'];
  
  function setDomainHandlerConnection(domain, scheme, connectionId) {
    debug('Setting handler for domain ' + domain + ' and scheme ' + scheme + '...');
    if (!(domain in domainHandlers)) {
      domainHandlers[domain] = {};
    }
    
    domainHandlers[domain][scheme] = connectionId;
  }
  
  function removeDomainHandlerConnection(domain, scheme) {
    var i, anyHandlersRegistered;
    
    debug('Removing handler for domain ' + domain + ' and scheme ' + scheme + '...');
    if (domain in domainHandlers && scheme in domainHandlers[domain]) {
      delete domainHandlers[domain][scheme];
    }
    
    if (domain in domainHandlers) {
      anyHandlersRegistered = false;
      
      for (i = 0; i < supportedSchemes.length; i += 1) {
        if (supportedSchemes[i] in domainHandlers[domain]) {
          anyHandlersRegistered = true;
        }
      }
      
      if (!anyHandlersRegistered) {
        delete domainHandlers[domain];
      }
    }
  }
  
  function removeAllDomainHandlerConnections(domain) {
    var i;
    
    debug('Removing all handlers for domain ' + domain + '...');
    for (i = 0; i < supportedSchemes.length; i += 1) {
      removeDomainHandlerConnection(domain, supportedSchemes[i]);
    }
  }
  
  function getDomainHandlerConnection(domain, scheme) {
    debug('Fetching handler for domain ' + domain + ' and scheme ' + scheme + '...');
    
    if (domain in domainHandlers && scheme in domainHandlers[domain]) {
      return domainHandlers[domain][scheme];
    } else {
      return null;
    }
  }
  
  function getConnectionHandlerDomainsAndSchemes(connectionId) {
    var domain, scheme, retVal = {};
    
    debug('Fetching handlers for connectionId ' + connectionId + '...');
    
    for (domain in domainHandlers) {
      for (scheme in domainHandlers[domain]) {
        if (domainHandlers[domain][scheme] === connectionId) {
          retVal[domain] = {};
          retVal[domain][scheme] = true;
        }
      }
    }
    
    return retVal;
  }
  
  //
  //  HTTP request and WS connection management
  //
  
  activeRequests = {};
  
  function addRequest(requestId, clientConnectionId, serverConnectionId, domain, scheme) {
    domain = domain ? domain.toLowerCase() : domain;
    debug('Adding new request with id ' + requestId + ' for domain ' + domain + ' and scheme ' + scheme + '...');
        
    activeRequests[requestId] = {
      'requestId' : requestId,
      'clientConnectionId' : clientConnectionId,
      'serverConnectionId' : serverConnectionId,
      'domain' : domain,
      'scheme' : scheme
    };
  }
  
  function getRequest(requestId) {
    debug('Fetching request with id ' + requestId + '...');
    return activeRequests[requestId];
  }
  
  function removeRequest(requestId) {
    debug('Removing request with id ' + requestId + '...');
    delete activeRequests[requestId];
  }
  
  function getRequestsForClientConnection(clientConnectionId) {
    var requests = [], requestId;
    
    debug('Fetching request for client connection with id ' + clientConnectionId + '...');
    
    for (requestId in activeRequests) {
      if (activeRequests[requestId].clientConnectionId === clientConnectionId) {
        requests.push(activeRequests[requestId]);
      }
    }
    
    return requests;
  }
  
  function getRequestsForServerConnection(serverConnectionId) {
    debug('Fetching request for server connection with id ' + serverConnectionId + '...');
    var requests = [], requestId;
    
    for (requestId in activeRequests) {
      if (activeRequests[requestId].serverConnectionId === serverConnectionId) {
        requests.push(activeRequests[requestId]);
      }
    }
    
    return requests;
  }
  
  //
  // message handlers
  //
  
  messageHandlers = {
    "httpRequest" : handleHttpRequest,
    "httpResponse" : handleHttpResponse,
    "attachHandlerRequest" : handleAttachHandlerRequest,
    "attachHandlerResponse" : handleAttachHandlerResponse,
    "detachHandlerRequest" : handleDetachHandlerRequest,
    "detachHandlerResponse" : handleDetachHandlerResponse,
    "registerDomainRequest" : handleRegisterDomainRequest,
    "registerDomainResponse" : handleRegisterDomainResponse,
    "unregisterDomainRequest" : handleUnregisterDomainRequest,
    "unregisterDomainResponse" : handleUnregisterDomainResponse,
    "wsConnect" : handleWsConnect,
    "wsMessage" : handleWsMessage,
    "wsConnectionEnd" : handleWsConnectionEnd
  };
  
  function handleMessage(parsedMsg, params) {
    debug("Handling message: " + JSON.stringify(parsedMsg));
    
    if (!("revhttpwsId" in parsedMsg)) { 
      debug("Message doesn't contain a revhttpws id.");
    } else { 
      if ("revhttpwsMethod" in parsedMsg && parsedMsg.revhttpwsMethod in messageHandlers) {
        messageHandlers[parsedMsg.revhttpwsMethod](parsedMsg, params);
      } else {
        debug('Message does not contain a valid method type.');
      }
    }
  }
  
  //
  // Domain registration request and response message
  //
  
  function createRevhttpRegisterDomainResponse(msgId, success, errorMsg, requestParams, realSufix) {
    return {
      "revhttpwsId" : msgId,
      "revhttpwsMethod" : "registerDomainResponse",
      "success" : success,
      "errorMsg" : errorMsg,
      "domain" : requestParams.domain,
      "realSufix" : realSufix,
      "token" : requestParams.token
    };
  }
   
  function handleRegisterDomainRequest(msg, params) {
    var response, regParams, realSufix, requestedDomain;
        
    debug("Handling an domain registration request message...");
    
    msg.domain = msg.domain.toLowerCase();
    
    addRequest(msg.revhttpwsId, null, params.connection.connectionId);
    
    requestedDomain = msg.domain;
    
    if (!(canRegisterDomain(requestedDomain))) {
      response = createRevhttpRegisterDomainResponse(msg.revhttpwsId, false, "Domain alerady registered.", msg, "");
      handleMessage(response, {});
    } else {  
      regParams = mixin({}, msg);
      
      regParams.token = 'token' in regParams ? regParams.token : generateToken();
      
      addDomain(requestedDomain, regParams);
      
      realSufix = requestedDomain + "." + options.requestPrefix + "." + options.domainSufix + ":" + options.port;
      response = createRevhttpRegisterDomainResponse(msg.revhttpwsId, true, "", regParams, realSufix);
      handleMessage(response, {});
    }
  }
  
  function handleRegisterDomainResponse(msg, params) {
    var request, connection;
    
    debug("Handling an domain registration response message...");
    
    request = getRequest(msg.revhttpwsId);
    connection = getConnection(request.serverConnectionId);
    
    if (typeof connection !== 'undefined' && connection !== null) {
      connection.sendMessage(msg);
    } 
    
    removeRequest(msg.revhttpwsId);
  }
  
  //
  // Domain unregistration request and response message
  //
  
  function createRevhttpUnregisterDomainResponse(msgId, success, errorMsg, requestParams) {
    return {
      "revhttpwsId" : msgId,
      "revhttpwsMethod" : "unregisterDomainResponse",
      "success" : success,
      "errorMsg" : errorMsg,
      "domain" : requestParams.domain
    };
  }
  
  function handleUnregisterDomainRequest(msg, params) {
    var response;
    
    debug("Handling an domain deregistration request message...");
    
    msg.domain = msg.domain.toLowerCase();
    
    addRequest(msg.revhttpwsId, null, params.connection.connectionId);
    
    if (isValidTokenForDomain(msg.domain, msg.token)) {
      removeDomain(msg.domain);
      removeAllDomainHandlerConnections(msg.domain);
      
      response = createRevhttpUnregisterDomainResponse(msg.revhttpwsId, true, "", msg);
      handleMessage(response, {});
    } else {
      response = createRevhttpUnregisterDomainResponse(msg.revhttpwsId, false, "Unable to unregister domain - domain not registered or invalid token.", msg);
      handleMessage(response, {});
    }
  }
  
  function handleUnregisterDomainResponse(msg, params) {
    var request, connection;
    
    debug("Handling an unregister domain response message...");
    
    request = getRequest(msg.revhttpwsId);
    connection = getConnection(request.serverConnectionId);
    
    if (typeof connection !== 'undefined' && connection !== null) {
      connection.sendMessage(msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  //
  // Handler attach request and response message
  //
  
  function createRevhttpAttachHandlerResponse(msgId, success, errorMsg, requestParams) {
    return {
      "revhttpwsId" : msgId,
      "revhttpwsMethod" : "attachHandlerResponse",
      "success" : success,
      "errorMsg" : errorMsg,
      "domain" : requestParams.domain,
      "scheme" : requestParams.scheme,
    };
  }

  function handleAttachHandlerRequest(msg, params) {
    var response;
    
    debug("Handling an attach request message...");
    
    msg.domain = msg.domain.toLowerCase();
    msg.scheme = msg.scheme.toLowerCase();
    
    addRequest(msg.revhttpwsId, null, params.connection.connectionId);
    
    if (isValidTokenForDomain(msg.domain, msg.token)) {
      setDomainHandlerConnection(msg.domain, msg.scheme, params.connection.connectionId);
      response = createRevhttpAttachHandlerResponse(msg.revhttpwsId, true, "", msg);
      handleMessage(response, {});
    } else {
      response = createRevhttpAttachHandlerResponse(msg.revhttpwsId, false, "Invalid token for domain.", msg);
      handleMessage(response, {});
    }
  }
  
  function handleAttachHandlerResponse(msg, conn) {
    var request, connection;
    
    debug("Handling an attach response message...");
    
    request = getRequest(msg.revhttpwsId);
    connection = getConnection(request.serverConnectionId);
    
    if (typeof connection !== 'undefined' && connection !== null) {
      connection.sendMessage(msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  //
  // Handler detachment request and response message
  //
  
  function createRevhttpDetachHandlerResponse(msgId, success, errorMsg, requestParams) {
    return {
      "revhttpwsId" : msgId,
      "revhttpwsMethod" : "detachHandlerResponse",
      "success" : success,
      "errorMsg" : errorMsg,
      "domain" : requestParams.domain,
      "scheme" : requestParams.scheme,
    };
  }
  
  function handleDetachHandlerRequest(msg, params) {
    var response;
    
    debug("Handling a detach request message...");
    
    msg.domain = msg.domain.toLowerCase();
    msg.scheme = msg.scheme.toLowerCase();
    
    addRequest(msg.revhttpwsId, null, params.connection.connectionId);
    
    if (isValidTokenForDomain(msg.domain, msg.token)) {
      removeDomainHandlerConnection(msg.domain, msg.scheme);
      response = createRevhttpDetachHandlerResponse(msg.revhttpwsId, true, "", msg);
      handleMessage(response, {});
    } else {
      response = createRevhttpDetachHandlerResponse(msg.revhttpwsId, false, "Invalid token for domain.", msg);
      handleMessage(response, {});
    }
  }
  
  function handleDetachHandlerResponse(msg, params) {
    var request, connection;
    
    debug("Handling a detach response message...");
    
    request = getRequest(msg.revhttpwsId);
    connection = getConnection(request.serverConnectionId);
    
    if (typeof connection !== 'undefined' && connection !== null) {
      connection.sendMessage(msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  //
  // Http request and response messages
  //
  
  function createRevttpHttpResponse(msgId, status, headers, bodyText) {
    return {
      'revhttpwsMethod' : 'httpResponse',
      'revhttpwsId' : msgId,
      'status' : status,
      'headers' : headers,
      'bodyText' : bodyText
    };
  }
  
  function handleHttpRequest(msg, params) {
    var response, registeredDomain, handlerId, handlerConnection, httpreq;
    
    debug("Handling a HTTP request message...");
    
    addRequest(msg.revhttpwsId, params.connection.connectionId, null);
    
    if (!isValidClientRequestHost(msg.headers.host)) {
      response = createRevttpHttpResponse(msg.revhttpwsId, 404, {'Content-Type': 'text/plain', "Access-Control-Allow-Origin" : "*"}, 'Requests must have the following host sufix: ' + options.requestPrefix + "." + options.domainSufix);
      handleMessage(response, {});
    } else {
      registeredDomain = getRegisteredDomainForHost(msg.headers.host);
      
      if (registeredDomain === null) {
        response = createRevttpHttpResponse(msg.revhttpwsId, 404, {'Content-Type': 'text/plain', "Access-Control-Allow-Origin" : "*"}, 'The requested domain is not registered');
        handleMessage(response, {});
      } else {
        handlerId = getDomainHandlerConnection(registeredDomain, 'http');
        
        if (typeof handlerId === 'undefined' || handlerId === null) {
          response = createRevttpHttpResponse(msg.revhttpwsId, 503, {'Content-Type': 'text/plain', "Access-Control-Allow-Origin" : "*"}, 'The requested domain is registered but does not have a handler attached.');
          handleMessage(response, {});
        } else {
          handlerConnection = getConnection(handlerId);
          httpreq = getRequest(msg.revhttpwsId);
          httpreq.serverConnectionId = handlerId;
          httpreq.domain = registeredDomain;
          httpreq.scheme = 'http';
          msg.domain = registeredDomain;
          handlerConnection.sendMessage(msg);
        }
      }
    }
  }

  function handleHttpResponse(msg, params) {
    var request, connection;
    
    debug("Handling a HTTP response message...");
    
    request = getRequest(msg.revhttpwsId);
    connection = getConnection(request.clientConnectionId);
    
    if (typeof connection !== 'undefined' && connection !== null) {
      connection.sendMessage(msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  //
  // WS message handling
  //
  
  function handleWsConnect(msg, params) {
    var registeredDomain, handlerId, handlerConnection;
    
    debug("Handling a WS connect message...");
    
    registeredDomain = getRegisteredDomainForHost(msg.host);
    
    if (registeredDomain === null) {
      params.connection.closeConnection();
    } else {
      handlerId = getDomainHandlerConnection(registeredDomain, 'ws');
      msg.domain = registeredDomain;
      
      if (typeof handlerId === 'undefined' || handlerId === null) {
        params.connection.endConnection();
      } else {
        handlerConnection = getConnection(handlerId);
        addRequest(msg.revhttpwsId, params.connection.connectionId, handlerId, registeredDomain, 'ws');
        handlerConnection.sendMessage(msg);
      }
    }
  }
  
  function handleWsMessage(msg, params) {
    var req, destConnId, destConn;
    
    debug("Handling a WS message...");
    
    req = getRequest(msg.revhttpwsId);
    
    if (typeof req !== "undefined" && req !== null) {
      destConnId = params.connection.side === "client" ? req.serverConnectionId : req.clientConnectionId;
      destConn = getConnection(destConnId);
      
      if (typeof destConn !== "undefined" && destConn !== null) {
        destConn.sendMessage(msg);
      }
    }
  }
  
  function createRevhttpwsWsConnectionEnd(msgId) {
    return {
      'revhttpwsMethod' : 'wsConnectionEnd',
      'revhttpwsId' : msgId
    };
  }
  
  function handleWsConnectionEnd(msg, params) {
    var req, destConnId, destConn;
    
    debug("Handling a WS connection end message...");
    
    req = getRequest(msg.revhttpwsId);
    
    if (typeof req !== "undefined" && req !== null) {
    
      removeRequest(msg.revhttpwsId);
    
      if (typeof params === "undefined") {
        params = { side : "server" };
      }
      
      if (params.side === "server") {
        destConnId = req.clientConnectionId;
        destConn = getConnection(destConnId);
        if (typeof destConn !== "undefined" && destConn !== null) {
          destConn.endConnection();
        }
      } else {
        destConnId = req.serverConnectionId;
        destConn = getConnection(destConnId);
        if (typeof destConn !== "undefined" && destConn !== null) {
          destConn.sendMessage(msg);
        }
      }
    }
  }
  
  function setupConnection(connection) {
    debug('Setting up connection...');
    addConnection(connection);
    
    if (connection.side === "client" && connection.type === "http") {
      connection.sendMessage = function (msg) {
        debug('Sending message to Http client.');
        connection.response.writeHead(msg.status, msg.headers);
        if (typeof msg.bodyText !== "undefined" && msg.bodyText !== null) {
          connection.response.end(msg.bodyText);
        } else {
          connection.response.end();
        }
      };
      
      connection.socket.addListener('end', function () {
        debug('Http client closed.');
        onConnectionClose(connection.connectionId);
      });
      
      connection.endConnection = function () { 
        connection.request.connection.end(); 
      }; 
    } else if (connection.side === "client" && connection.type === "ws") {      
      connection.sendMessage = function (revhttpwsmsg) {
        connection.websocket.send(revhttpwsmsg.msg);
      };
      connection.endConnection = function () {
        connection.websocket.close();
      }; 
      connection.websocket.on('close', function () {
        onConnectionClose(connection.connectionId);
      });
    } else if (connection.side === "server" && connection.type === "ws") {
      connection.socket.setTimeout(0);
      connection.socket.setKeepAlive(true);
      connection.sendMessage = function (revhttpwsmsg) {
        connection.websocket.send(JSON.stringify(revhttpwsmsg));
      };
      connection.endConnection = function () {
        connection.websocket.close();
      }; 
      connection.websocket.on('close', function () {
        onConnectionClose(connection.connectionId);
      });
    }
  }
  
  function onConnectionClose(connectionId) {
    var connection, msg, handlers, requests, domain, scheme, i, request, conn, response;
    
    debug("Closing connection with id: " + connectionId + "...");
    
    connection = getConnection(connectionId);
    removeConnection(connectionId);
    
    if  (connection.side === "client" && connection.type === "http") {
      ;
    } else if (connection.side === "client" && connection.type === "ws") {      
      msg = createRevhttpwsWsConnectionEnd(connectionId);
      handleMessage(msg, { side : "client" });
    } else if (connection.side === "server" && connection.type === "ws") {
      handlers = getConnectionHandlerDomainsAndSchemes(connectionId);
      
      for (domain in handlers) {
        for (scheme in handlers) {
          removeDomainHandlerConnection(domain, scheme);
        }
      }
      
      requests = getRequestsForServerConnection(connectionId);
      
      for (i = 0; i < requests.length; i += 1) {
        request = requests[i];
        
        if (request.clientConnectionId === null) {
          removeRequest(request.requestId);
        } else {
          conn = getConnection(request.clientConnectionId);
          
          if (conn.type === "http") {
            response = createRevttpHttpResponse(request.requestId, 503, {'Content-Type': 'text/plain'}, 'The requested domain is registered but does not have a handler attached.');
            handleMessage(response, {});
          } else if (conn.type === "ws") {
            conn.endConnection();
          }
        }
      }
    }
  }
  
  function createRevhttpHttpRequest(method, version, headers, url, bodyText) {
    return { 
      'revhttpwsMethod' : 'httpRequest', 
	    'bodyText' : bodyText, 
	    'headers' : headers,
	    'url' : url, 
	    'version' : version, 
	    'method' : method
	  };
  }
  
  function httpRequestHandler(req, res) { 
    var httpRequestMessage, connection;
    
    connection = { side : "client", type : "http", socket : req.connection, request : req, response : res };
    setupConnection(connection);
    
    req.bodyText = '';
    
    req.on('data', function (data) { 
      req.bodyText += data; 
    });
    
    req.on('end', function () {
      httpRequestMessage = createRevhttpHttpRequest(req.method, req.httpVersion, req.headers, req.url, req.bodyText);
      httpRequestMessage.revhttpwsId = generateUUID(activeRequests);
      handleMessage(httpRequestMessage, { 'connection' : connection });
    }); 
  }
  
  function isValidClientRequestHost(requestHost) {
    var reverseSufix, reverseHost;
    
    debug("Checking client request host for: " + requestHost);
    reverseSufix = (options.requestPrefix + "." + options.domainSufix + ":" + options.port).split("").reverse().join("");
    reverseHost = requestHost.split("").reverse().join("");
    
    return reverseHost.indexOf(reverseSufix) === 0;
  }

  function isValidServerRequestHost(requestHost) {
    var reverseSufix, reverseHost;
    
    debug("Checking server request host for: " + requestHost);
    reverseSufix = (options.clientPrefix + "." + options.domainSufix + ":" + options.port).split("").reverse().join("");
    reverseHost = requestHost.split("").reverse().join("");

    return reverseHost.indexOf(reverseSufix) === 0;
  }
  
  function createRevhttpWsMessage(msg) {
    return {
      'revhttpwsMethod' : 'wsMessage', 
	    'msg' : msg
	  };
  }
  
  function createRevhttpWsConnectMessage(request) {
    return {
      'revhttpwsMethod' : 'wsConnect', 
	    'host' : request.headers.host,
	    'url' : request.url,
	    'headers' : request.headers
	  };
  }
  
  function handleWsConnection(conn) {
    var connection, connectMsg, wsmsg;
    
    debug("WS request:" + JSON.stringify(conn._req.headers));
    
    if (isValidServerRequestHost(conn._req.headers.host)) {
      debug("Received a server connection request.");
      connection = { side : "server", type : "ws", websocket : conn, socket : conn._req.connection };
      setupConnection(connection);
      
      conn.addListener("message", function (msg) {
        handleMessage(JSON.parse(msg), {'connection' : connection});
      });
    } else if (isValidClientRequestHost(conn._req.headers.host)) {
      debug("Received a client connection request.");
      connection = { side : "client", type : "ws", websocket : conn, socket : conn._req.connection };
      setupConnection(connection);
      
      connectMsg = createRevhttpWsConnectMessage(conn._req);
      connectMsg.revhttpwsId = connection.connectionId;
      handleMessage(connectMsg, {'connection' : connection});
      
      conn.addListener("message", function (msg) {
        wsmsg = createRevhttpWsMessage(msg);
        wsmsg.revhttpwsId = connection.connectionId;
        handleMessage(wsmsg, {'connection' : connection});
      });
    } else {
      debug("Connection request does not have a valid prefix:" + conn._req.headers.host + ". Requests should be sent to: " + options.requestPrefix + "." + options.domainSufix + " and " + options.clientPrefix + "." + options.domainSufix + ".");
      conn.close();
    }
  }
  
  function listen(port, host) {   
    debug("Starting RevHttpWs server on host " + host + " and port " + port + " with pid " + process.pid + "...");
    serv = ws.createServer({
      debug: options.debug,
      version: "auto",
      origin: "*",
      subprotocol: null
    });
    
    options.port = port;
    options.hostIP = host;
    
    serv.addListener("listening", function () {
      debug("Listening for connections...");
    });
    
    serv.addListener("request", httpRequestHandler);
    serv.addListener("connection", handleWsConnection);

    serv.listen(port, host);
  }
  
  loadRegisteredDomainsDirty(callback);
  
  function close(cb) {
    var connectionId, conn;
    
    debug('Shutting down RevHttpWs server...');

    debug("Closing all connections...");    
    
    serv.close();
    
    for (connectionId in allConnections) {
      conn = getConnection(connectionId);
      conn.endConnection();
    }
    
    saveRegisteredDomainsDirty(function () {
      debug("Saved registered domains to database.");
      if (cb) {
        cb();
      }
    });
  }

  return {
    listen : listen,
    close : close,
  };
}

exports.createServer = createServer;
