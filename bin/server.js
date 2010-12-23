var revhttpws = require("./../lib/revhttpws-server.js");

var server = revhttpws.createServer({
  "debug" : true,
  "database" : "revhttpws-uris.db",
  "domainSufix" : 'localhost',
  "clientPrefix" : "cp",
  "requestPrefix" : "rp"
}, function () {
  server.listen(8080, '127.0.0.1');
});

function closeServer() {
  server.close();
}

process.on('SIGINT', closeServer);
process.on('SIGTSTP', closeServer);
