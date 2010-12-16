function generateUUID(existingUUIDs) {
  var uuid, nineteen = '89AB', hex = '0123456789ABCDEF', i, uuidstr;
  while (true) {
    uuid = [];
    
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
      return 'client-' + uuidstr;
    }
  }
}

var RevHttpWsClient = function (options) {
  var clientType, debug, connectionWebSocket, state, WebSocket, activeRequests,
      messageHandlers, domainHandlers, supportedSchemes;

  clientType = typeof process !== "undefined" && typeof process.versions !== "undefined" && typeof process.versions.node !== "undefined" ? "node" : "browser";
  
  debug = null;
  
  if (options.debug) {
    if (clientType === "node") {
      sys = require("sys");
      debug = function (msg) { 
        sys.log('\033[90mREVHTTPWS-C: ' + Array.prototype.join.call(arguments, ", ") + "\033[39m");
      };
    } else {
      debug = function (msg) {
        console.log(msg);  
      };
    }
  } else {
    debug = function (msg) {
    };
  }

  if (clientType === "node") {
    WebSocket = require("websocket-client").WebSocket;
  } else {
    WebSocket = window.WebSocket
  }

  if (typeof WebSocket === "undefined") {
    debug("The revhttpws client library requires WebSockets.");
  }
  
  connectionWebSocket = null;
  state = "closed";
  
  function connect(proxyUri, cb) {  
    var self = this, conn;
      
    debug("Connecting to revhttpws server on " + proxyUri + "...");
    
    if (state === "closed") {
      state = "connecting";
      
      conn = new WebSocket(proxyUri);
      
      conn.onopen = function () {
        debug("Connected to revhttpws server on " + proxyUri + ".");
        state = "connected";
        connectionWebSocket = conn;
        cb(null, self);

        connectionWebSocket.onclose = function () {
          debug("Closed connection to revhttpws server on " + proxyUri + ".");
          onConnectionClose();
        };
      };
      
      conn.onerror = function () {
        debug("Error on connection to revhttpws server on " + proxyUri + ".");
        
        if (state === "connected") {
          self.onerror();
        } else {
          cb(true, null);
        }
        
        onConnectionClose();
      };
      
      conn.onmessage = function (msg) {
        debug("Received message from revhttpws server: " + msg.data);
        handleMessage(JSON.parse(msg.data));
      };
    };
  }
  
  function onConnectionClose() {
    debug("Closing connection.");
    
    if (state !== "closed") {
      state = "closed";
    }
  }
   
  function disconnect() {
    debug("Disconnecting from revhttpws server...");
    
    if (state === "connected") {
      connectionWebSocket.close();
    }
  }
  
  activeRequests = {};
  
  function addRequest(requestId, cb) {
    debug('Adding new request with id ' + requestId + '...');
        
    activeRequests[requestId] = {
      'requestId' : requestId,
      'cb' : cb
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
  
  messageHandlers = {
    "registerDomainRequest" : handleRegisterDomainRequest,
    "registerDomainResponse" : handleRegisterDomainResponse,
    "unregisterDomainRequest" : handleUnregisterDomainRequest,
    "unregisterDomainResponse" : handleUnregisterDomainResponse,
    "attachHandlerRequest" : handleAttachHandlerRequest,
    "attachHandlerResponse" : handleAttachHandlerResponse,
    "detachHandlerRequest" : handleDetachHandlerRequest,
    "detachHandlerResponse" : handleDetachHandlerResponse,
    "httpRequest" : handleHttpRequest,
    "httpResponse" : handleHttpResponse,
    "wsConnect" : handleWsConnect,
    "wsMessage" : handleWsMessage,
    "wsConnectionEnd" : handleWsConnectionEnd
  };
  
  function handleMessage(msg, params) {
    debug("Handling message: " + JSON.stringify(msg));
    if ("revhttpwsMethod" in msg && msg.revhttpwsMethod in messageHandlers) {
      messageHandlers[msg.revhttpwsMethod](msg, params);
    } else {
      debug('Message does not contain a valid method type.');
    }
  }
  
  function handleRegisterDomainRequest(msg, params) {
    debug("Handling an domain registration request message...");
    
    if (!("revhttpwsId" in msg)) {
      msg.revhttpwsId = generateUUID(activeRequests);
    }
    
    addRequest(msg.revhttpwsId, params);
    sendMessage(msg);
  }
  
  function handleRegisterDomainResponse(msg) {
    var request;
    
    debug("Handling an domain registration response message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    request = getRequest(msg.revhttpwsId);
    
    if (msg.success) {
      request.cb(null, msg);
    } else {
      request.cb(msg.error, msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  function createRevhttpwsRegisterDomainRequest(params) {
    var retVal = {
	    'revhttpwsMethod' : 'registerDomainRequest', 
	    'domain' : params.domain
	  };
	  
	  if ('token' in params) {
	    retVal.token = params.token;
	  }
	  
	  return retVal;
  }
  
  function registerDomain(params, cb) {
    var msg;
    
    debug("Registering domain " + params.domain + "...");
    msg = createRevhttpwsRegisterDomainRequest(params);
    handleMessage(msg, cb);
  }
  
  function sendMessage(msg) {
    debug("Sending message: " + JSON.stringify(msg));
    if (state === "connected") {
      connectionWebSocket.send(JSON.stringify(msg));
    }
  }
  
  function handleUnregisterDomainRequest(msg, params) {
    debug("Handling an domain unregistration request message...");
    
    if (!("revhttpwsId" in msg)) {
      msg.revhttpwsId = generateUUID(activeRequests);
    }
    
    addRequest(msg.revhttpwsId, params);
    sendMessage(msg);
  }
  
  function handleUnregisterDomainResponse(msg) {
    var request;
    
    debug("Handling an domain unregistration response message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    request = getRequest(msg.revhttpwsId);
    
    if (msg.success) {
      request.cb(null, msg);
    } else {
      request.cb(msg.error, msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  function createRevhttpwsUnregisterDomainRequest(params) {
    return {
	    'revhttpwsMethod' : 'unregisterDomainRequest', 
	    'domain' : params.domain,
	    'token' : params.token
	  };
  }
  
  function unregisterDomain(params, cb) {
    var msg;
    
    debug("Unregistering domain " + params.domain + "...");
    
    msg = createRevhttpwsUnregisterDomainRequest(params);
    handleMessage(msg, cb);
  }
  
  function handleAttachHandlerRequest(msg, params) {
    debug("Handling an handler attach request message...");
    
    if (!("revhttpwsId" in msg)) {
      msg.revhttpwsId = generateUUID(activeRequests);
    }
    
    addRequest(msg.revhttpwsId, params.cb);
    getRequest(msg.revhttpwsId).handler = params.handler;
    sendMessage(msg);
  }
  
  domainHandlers = {};
  supportedSchemes = ['http', 'ws'];
  
  function setDomainHandler(domain, scheme, handler) {
    debug('Setting handler for domain ' + domain + ' and scheme ' + scheme + '...');
    if (!(domain in domainHandlers)) {
      domainHandlers[domain] = {};
    }
    
    domainHandlers[domain][scheme] = handler;
  }
  
  function removeDomainHandler(domain, scheme) {
    var anyHandlersRegistered, i;
    
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
      removeDomainHandler(domain, supportedSchemes[i]);
    }
  }
  
  function getDomainHandler(domain, scheme) {
    debug('Fetching handler for domain ' + domain + ' and scheme ' + scheme + '...');
    
    if (domain in domainHandlers && scheme in domainHandlers[domain]) {
      return domainHandlers[domain][scheme];
    } else {
      return null;
    }
  }
  
  function handleAttachHandlerResponse(msg) {
    debug("Handling an handler attach response message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    var request = getRequest(msg.revhttpwsId);
    
    if (msg.success) {
      setDomainHandler(msg.domain, msg.scheme, request.handler);
      request.cb(null, msg);
    } else {
      request.cb(msg.error, msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  function createRevhttpwsAttachHandlerRequest(params) {
    return {
	    'revhttpwsMethod' : 'attachHandlerRequest', 
	    'domain' : params.domain,
	    'scheme' : params.scheme,
	    'token' : params.token,
	  };
  }
  
  function attachHandler(params, cb) {
    var msg;
    debug("Attaching handler for domain " + params.domain + " and scheme " + params.scheme);
    
    msg = createRevhttpwsAttachHandlerRequest(params);
    handleMessage(msg, { cb : cb, handler : params.handler });
  }
  
  function createRevhttpwsDetachHandlerRequest(params) {
    return {
	    'revhttpwsMethod' : 'detachHandlerRequest', 
	    'domain' : params.domain,
	    'scheme' : params.scheme,
	    'token' : params.token
	  };
  }
  
  function handleDetachHandlerRequest(msg, params) {
    debug("Handling an handler detach request message...");
    
    if (!("revhttpwsId" in msg)) {
      msg.revhttpwsId = generateUUID(activeRequests);
    }
    
    addRequest(msg.revhttpwsId, params);
    removeDomainHandler(msg.domain, msg.scheme);
    sendMessage(msg);
  }
  
  function handleDetachHandlerResponse(msg) {
    var request;
    
    debug("Handling a handler detach response message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    request = getRequest(msg.revhttpwsId);
    
    if (msg.success) {
      request.cb(null, msg);
    } else {
      request.cb(msg.error, msg);
    }
    
    removeRequest(msg.revhttpwsId);
  }
  
  function detachHandler(params, cb) {
    var msg;
    
    debug("Detaching handler for domain " + params.domain + " and scheme " + params.scheme);
    
    msg = createRevhttpwsDetachHandlerRequest(params);
    handleMessage(msg, cb);
  }
  
  function createRevhttpwsHttpResponse(msgId, status, headers, bodyText) {
    return {
      'revhttpwsMethod' : 'httpResponse',
      'revhttpwsId' : msgId,
      'status' : status,
      'headers' : headers,
      'bodyText' : bodyText
    };
  }
  
  function handleHttpRequest(msg, params) {
    var httpRequest, httpResponse, handler;
    
    debug("Handling HTTP request message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    addRequest(msg.revhttpwsId);
    
    httpRequest = {
      'bodyText' : msg.bodyText, 
	    'headers' : msg.headers,
	    'url' : msg.url, 
	    'version' : msg.version, 
	    'method' : msg.method
    };
    
    httpResponse = {
      status : 200,
      headers : { },
      bodyText : "",
      send : function () {
        var response = createRevhttpwsHttpResponse(msg.revhttpwsId, httpResponse.status, httpResponse.headers, httpResponse.bodyText);
        handleMessage(response);
      }
    };
    
    handler = getDomainHandler(msg.domain, 'http');
    debug("handlers: " + JSON.stringify(domainHandlers));
    handler(httpRequest, httpResponse);
  }
  
  function handleHttpResponse(msg, params) {
    debug("Handling HTTP response message...");
    
    if (!("revhttpwsId" in msg)) {
      return;
    }
    
    var req = getRequest(msg.revhttpwsId);
    
    if (typeof req !== "undefined" && req !== null) {
      removeRequest(msg.revhttpwsId);
      sendMessage(msg);
    }
  }
  
  function createRevhttpwsWsMessage(msgId, msg) {
    return {
      'revhttpwsMethod' : 'wsMessage',
      'revhttpwsId' : msgId,
      'msg' : msg
    };
  }
  
  function createRevhttpwsWsConnectionEnd(msgId) {
    return {
      'revhttpwsMethod' : 'wsConnectionEnd',
      'revhttpwsId' : msgId
    };
  }
  
  function handleWsConnect(msg, params) {
    var handler, wsConnection;
    
    debug("Handling WS connect message...");
    
    addRequest(msg.revhttpwsId);
    
    handler = getDomainHandler(msg.domain, 'ws'); 
    
    wsConnection = {
      onmessage : function (msg) { },
      'onerror' : function (error) { },
      onclose : function () { },
      send : function (text) {
        var m = createRevhttpwsWsMessage(msg.revhttpwsId, text);
        handleMessage(m, "outgoing");
      },
      close : function () {
        var m = createRevhttpwsWsConnectionEnd(msg.revhttpwsId, "outgoing");
        handleMessage(m, "outgoing");
      },
      headers : msg.headers,
      url : msg.url
    };
    
    getRequest(msg.revhttpwsId).connection = wsConnection;
    handler(wsConnection);
  }
  
  function handleWsMessage(msg, params) {
    var req;
    
    debug("Handling WS message...");
    
    if (typeof params === "undefined" || params === null) {
      params = "incoming";
    }

    req = getRequest(msg.revhttpwsId);

    if (typeof req !== "undefined" && req !== null && typeof req.connection !== "undefined" && typeof req.connection !== null) {
      if (params === "incoming") {
        req.connection.onmessage({data : msg.msg});
      } else {
        sendMessage(msg);
      }
    }
  }
  
  function handleWsConnectionEnd(msg, params) {
    var req;
    
    debug("Handling WS close connection message...");
    
    if (typeof params === "undefined" || params === null) {
      params = "incoming";
    }
    
    req = getRequest(msg.revhttpwsId);
    
    if (typeof req !== "undefined" && req !== null && typeof req.connection !== "undefined" && typeof req.connection !== null) {
      req.connection.onclose();
      removeRequest(msg.revhttpwsId);
      if (params === "outgoing") {
        sendMessage(msg);
      }
    }
  }
  
  return {
    connect : connect,
    disconnect : disconnect,
    registerDomain : registerDomain,
    unregisterDomain : unregisterDomain,
    attachHandler : attachHandler,
    detachHandler : detachHandler
  }; 
};

if (typeof process !== "undefined" && typeof process.versions !== "undefined" && typeof process.versions.node !== "undefined") {
  exports.RevHttpWsClient = RevHttpWsClient;
}
