var sys = require('sys');
var http = require('http');
var assert = require('assert');
var WebSocket = require('websocket-client').WebSocket;
var RevhttpServer = require('./../lib/revhttpws-server.js');
var RevHttpWsClient = require('./../lib/revhttpws-client.js').RevHttpWsClient;

var serverSufix = "localhost";
var serverIP = "127.0.0.1";
var serverPORT = 9896;
var clientPrefix = "cp";
var requestPrefix = "rp"
var testDomain = "test1";
var testDomainToken = "testToken1";

var revhttpwsServer = "ws://" + clientPrefix + "." + serverSufix + ":" + serverPORT.toString() + "/";

var server = RevhttpServer.createServer({
  "debug" : false,
  "database" : "revhttpws-uris.db",
  "domainSufix" : serverSufix,
  "clientPrefix" : clientPrefix,
  "requestPrefix" : requestPrefix
}, function () {
  server.listen(serverPORT, serverIP);
  console.log("Started test revhttpws server...");

  function closeServer() {
    server.close();
    console.log("Stopped test revhttpws server...");
  }
  
  setTimeout(function() {

    var client = new RevHttpWsClient({debug : false});

    console.log("Connecting to: " + revhttpwsServer);
    client.connect(revhttpwsServer, function(err, res) { 

      if (err) {
        console.log("Error while connecting to revhttpws server!");
      } else {
        
        console.log("Connected to revhttpws server!");
        
        client.onerror = function() {
          console.log("Disconnected from revhttpws server!");
        };

        res.registerDomain({ domain : testDomain, token : testDomainToken }, function(err1, res1) {
        
          if (err1) {
            console.log("Error while registering domain!");
          } else {
            console.log("Successfully registered domain!");
            
            var reqHandler1 = function(request, response) {
              console.log("Received HTTP request!");
              
              response.bodyText = "HELLO WORLD!";
              response.send();
              
              process.nextTick( function() {
                res.detachHandler({ domain : testDomain, scheme : "http", token : res1.token }, function(err5, res5) {
                  if (err5) {
                    console.log("Error while detaching http handler!");
                  } else {
                    console.log("Successfully detached http handler!");
                  }
                } );
              });
            };
            
            var reqHandler2 = function(newWS) {
              console.log("Received WS connection!");
              
              newWS.onmessage = function(msg) {
              
                console.log("Recevied WS message!");
                newWS.send("ECHO " + msg.data);
              
                setTimeout( function() {
                  res.detachHandler({ domain : testDomain, scheme : "ws", token : res1.token }, function(err6, res6) {
                    if (err6) {
                      console.log("Error while detaching ws handler!");
                    } else {
                      console.log("Successfully detached ws handler!");
                    }
                  });
                }, 2000 );
                
                setTimeout( function() { newWS.close(); }, 4000 );
              };
              newWS.onerror = function() { console.log("WS ERROR"); };
              newWS.onclose = function() { console.log("WS CLOSE"); };      
            };
            
            res.attachHandler( { domain : testDomain, scheme : "http", token : res1.token, handler : reqHandler1 }, function(err3, res3) {
              if (err3) {
                console.log("Error while attaching http handler!");
              } else {
                console.log("Successfully attached http handler!");
              }
            } );
            
            res.attachHandler( { domain : testDomain, scheme : "ws", token : res1.token, handler : reqHandler2 }, function(err4, res4) {
              if (err4) {
                console.log("Error while attaching ws handler!");
              } else {
                console.log("Successfully attached ws handler!");
              } 
            } );
          }
          
         /* setTimeout(function() {
            res.unregisterDomain({ domain : "test1", token : res1.token }, function(err2, res2) {
              if (err2) {
                console.log("Error while unregistering domain!");
              } else {
                console.log("Successfully unregistered domain!");
              } 
        
            });
          }, 6000); */
          
          // send HTTP request 1, test if response is OK
          
          setTimeout(function() {
            var client1 = http.createClient(serverPORT, testDomain + "." + requestPrefix + "." + serverSufix);
            var request1 = client1.request('GET', '/', { 'host' : testDomain + "." + requestPrefix + "." + serverSufix + ":" + serverPORT.toString()} );
            request1.end();
            request1.on('response', function (response1) {
              assert.equal(response1.statusCode, 200, "OK?");
              response1.on('data', function (chunk) {
                 assert.equal(chunk, "HELLO WORLD!", "OK?");
              });
            });
            
            // send HTTP request 2, test if response is 404
            setTimeout(function() {
              var client2 = http.createClient(serverPORT, testDomain + "." + requestPrefix + "." + serverSufix);
              var request2 = client2.request('GET', '/', { 'host' : testDomain + "." + requestPrefix + "." + serverSufix + ":" + serverPORT.toString() });
              request2.end();
              request2.on('response', function (response2) {
                assert.equal(response2.statusCode, 503, "OK?");
                response2.on('data', function (chunk) {

                  server.close();
                });
              });
            }, 1000);
              
          }, 1000);
        });
      }
    }); 
  }, 1000); 
});
