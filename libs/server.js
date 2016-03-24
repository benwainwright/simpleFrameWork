module.exports = (function server() {
   "use strict";

   /* Built in modules */
   var http    = require("http");
   var fs      = require("fs");
   var md5     = require("md5");
   var devMode = false;

   var router, config,
       returnObject, parser;

   /* Constants */
   var BACKLOG      = 511;
   var httpCode     = {
      OK          : 200,
      NOT_FOUND   : 404,
      NOT_MODIFIED: 304
   };

   var serv         = http.createServer(requestHandler);

   /* TODO there is a bug in the way that file
      paths are created in the request parsing
      functions. This would be a good candidate
      for separation into a new module so that it
      is testable */
   function requestHandler(request, response) {
      var resource, reply, code;
      initLogObject(request, response);
      resource = parser.parse(request);
      if(etagUnchanged(request, resource) === true) {
         writeResponse(response, resource,
                       httpCode.NOT_MODIFIED,
                       null, null);
      } else {
         if(resource.allowed === false) {
            code = httpCode.NOT_FOUND;
         } else {
            code = httpCode.OK;
         }
         reply = writeResponse.bind(null, response,
                                    resource, code);
         try {
            router.load(resource, reply);
            response.servedWith = router.last();
         } catch(e) {
            console.log(e.stack);
         }
      }
   }

   function writeResponse(response, resource, code, err, raw) {
      var head  = makeHeader(resource);

      if(!err && code === undefined) {
         code = httpCode.OK;
      } else if(code === undefined) {
         code = httpCode.NOT_FOUND;
      }
      response.writeHead(code, head);
      response.log.statusCode = code;
      if(raw) {
         response.write(raw);
      }
      response.end();
      logRequest(response, resource);
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
      }
   }

   function makeLastModHead(resource) {
      var modTime;
      try {
         modTime = lastModified(resource);
         return modTime.toUTCString();
      } catch(e) {
         // TODO handle this exception
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

   function onListen() {
      console.log("Server at "          +
                  config.host           +
                  " listening on port " +
                  config.ports.http);
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

   /* TODO create a LOGGING module and take the actual printing
    * out of this one */
   function logRequest(response, resource) {
      var log      = response.log;
      var reqText  = log.method + " " + log.url;
      var type     = resource? resource.type : "text/html";
      var logText = "[when=> "    + log.timeDate   + "] " +
                    "[host=> "    + log.address    + "] " +
                    "[request=> " + reqText        + "] " +
                    "[type=> "    + type           + "] " +
                    "[status=> "  + log.statusCode + "] ";
      if(response.servedWith !== undefined) {
         log += " [with=> " + response.servedWith + "]";
      }
      console.log(logText);
   }

   returnObject = {
      start    : function(serverConfig, dev) {
         if(dev) {
            console.log("Development mode on...");
            devMode = dev;
         }
         config = serverConfig;
         serv.listen(config.ports.http,
                     config.host,
                     BACKLOG,
                     onListen);
      },
      stop     : function(callback) {
         serv.close(callback);
      },
      setRouter: function(theRouter) {
         router = theRouter;
      },
      setParser: function(theParser) {
         parser = theParser;
      }
   };

   Object.freeze(returnObject);
   return returnObject;
}());
