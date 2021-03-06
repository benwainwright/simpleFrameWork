/*
 * The web server module. Handles HTTP requests,
 * builds headers, delegates to the request parser
 * and router modules
 */
module.exports = (function server() {
   "use strict";
   
   var router, config, returnObject,
       parser, servHttp, servHttps,
       output, sessionHandler;

   /* Node packages */
   var http     = require("http");
   var https    = require("https");
   var fs       = require("fs");
   var md5      = require("md5");
   var zlib     = require("zlib");
   var stream   = require("stream");

   /* Constants */
   var devMode  = false;
   var gzipMode = false;
   var BACKLOG  = 511;
   var codes    = {
      OK        : 200,
      NOT_FOUND : 404,
      UNMODIFIED: 304
   };

   function requestHandler(request, response) {
      var resource;
      initLogObject(request, response);
      resource = parser.parse(request, response, resHandler);
   }

   function resHandler(resource, request, response) {
      var reply;
      sessionHandler.start(request, response, resource);
      if(etagUnchanged(request, resource) === true) {
         resource.statusCode = codes.UNMODIFIED;
         respond(response, resource);
      } else {
         reply = respond.bind(null, response, resource);
         try {
            router.load(resource, reply);
            response.servedWith = router.last();
         } catch(e) {
            output.print(e.stack);
         }
      }
   }

   function respond(response, resource, err, raw) {
      var code;
      var head = makeHeader(resource);
      if(!err && resource.statusCode === undefined) {
         code = codes.OK;
      } else if(resource.statusCode === undefined) {
         code = codes.NOT_FOUND;
      } else {
         code = resource.statusCode;
      }
      response.writeHead(code, head);
      response.log.statusCode = code;
      writeResponse(raw, response, resource);
      output.log(response, resource);
   }

   function writeResponse(raw, response, resource) {
      var str;
      if(raw) {
         try {
            str = new stream.Readable();
            str._read = function() {};
            str.push(raw);
            str.push(null);
            switch(resource.encoding) {
               case "gzip":
                  str.pipe(zlib.createGzip()).pipe(response);
                  break;
               case "deflate":
                  str.pipe(zlib.createDeflate()).pipe(response);
                  break;
               default:
                  str.pipe(response);
                  break;
            }
         } catch(e) {
            console.log(e);
         }
      } else {
         response.end();
      }
   }

   function etagUnchanged(request, resource) {
      var reqTag = request.headers["if-none-match"];
      if(reqTag !== undefined && reqTag === getEtag(resource)) {
         return true;
      }
      return false;
   }

   function lastModified(resource) {
      var filename = resource.fileNameAbs;
      try {
         return fs.statSync(filename).mtime;
      } catch(e) {
         throw e;
      }
   }

   function getEtag(resource) {
      var modTime;
      try {
         modTime = lastModified(resource);
         return md5(modTime + resource.filename);
      } catch(e) {
         // TODO handle this exception
         return null;
      }
   }

   function makeLastModHead(resource) {
      var modTime;
      try {
         modTime = lastModified(resource);
         return modTime.toUTCString();
      } catch(e) {
         // TODO handle this exception
         return null;
      }
   }

   function makeCacheControl(resource) {
      var cacheControl = "",
          expires      = resource.expires;
      if(resource.static === true) {
         cacheControl += "public";
      } else {
         cacheControl += "private";
      }
      if(expires !== undefined) {
         cacheControl += ", max-age=" + expires;
      }
      return cacheControl;
   }

   function makeHeader(resource) {
      var ext   = resource.ext;
      var name  = resource.fileName;
      var head  = { };
      var map   = "/scripts-maps/" + name + ".map";
      if(resource.encoding) {
         head["Content-Encoding"] = resource.encoding;
      }
      head["Content-Type"]  = resource.type;
      head["Cache-Control"] = makeCacheControl(resource);
      if(resource.static === true) {
         head["Last-Modified"] = makeLastModHead(resource);
         head.Etag = getEtag(resource);
      } else {
         head["Content-Type"] += "; charset=utf-8";
      }

      if(ext === "js" && devMode) {
         head["x-sourcemap"] = map;
      }
      return head;
   }

   function onListen(protocol, host, port) {
      output.print("Listening on "  +
                   protocol + "://" +
                   host     + ":"   +
                   port     + "/");
   }

   function initLogObject(request, response) {
      var d        = new Date();
      var timeDate = d.toTimeString() + " " + d.toDateString();
      response.log = {
         timeDate: timeDate,
         method  : request.method,
         url     : request.url,
         address : request.connection.remoteAddress
      };
   }

   function setupServer(module, host, port, sslOpts) {
      var serv, listenHandler, protocol;
      if(sslOpts !== undefined) {
         protocol = "https";
         serv     = module.createServer(sslOpts, requestHandler);
      } else {
         protocol = "http";
         serv     = module.createServer(requestHandler);
      }
      listenHandler = onListen.bind(null, protocol, host, port);
      serv.on("error", onError);
      serv.listen(port, host, BACKLOG, listenHandler);
      return serv;
   }

   function onError(e) {
      switch(e.code) {
         case "EADDRINUSE":
            console.log("Cannot start server "     +
                        "(address already in use)");
            break;
      }
   }

   function startServer(serverConfig, dev, gzip) {
      var certs;
      var host    = serverConfig.host;
      var hpPort  = serverConfig.ports.http;
      var hpsPort = serverConfig.ports.https;
      gzipMode = gzip;
      config   = serverConfig;
      if(dev) {
         output.print("Development mode on");
         devMode = dev;
      }
      output.print("Initializing server...");
      servHttp = setupServer(http, host, hpPort);
      if(config.ssl !== undefined) {
         certs = {
            key: fs.readFileSync(config.ssl.key),
            cert: fs.readFileSync(config.ssl.cert)
         };
         servHttps = setupServer(https, host, hpsPort, certs);
      }
   }

   returnObject = {
      setRouter: function(theRouter) {
         router = theRouter;
      },
      start    : startServer,
      stop     : function(callback) {
         servHttp.close(callback);
         if(servHttps !== undefined) {
            servHttps.close(callback);
         }
      },
      setParser: function(theParser) {
         parser = theParser;
      },
      setOutput: function(theOutput) {
         output = theOutput;
      },
      setSessionHandler: function(session) {
         sessionHandler = session;
      }
   };

   Object.freeze(returnObject);
   return returnObject;
}());
