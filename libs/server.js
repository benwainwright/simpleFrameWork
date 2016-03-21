module.exports = (function server() {
   "use strict";

   /* Built in modules */
   var http   = require("http");
   var url    = require("url");
   var fs     = require("fs");

   /* Dependencies */
   var router;

   /* Constants */
   var BACKLOG      = 511;
   var httpCode     = {
      OK       : 200,
      NOT_FOUND: 404
   };
   var RESOURCESDIR = "resources";

   var serv = http.createServer(handler);
   var config;


   function handler(request, response) {
      var reqUrl, path;
      reqUrl = url.parse(request.url, true);
      path   = reqUrl.pathname;

      if(path.split(".").length > 1) {
         serveFile(path, response);
      } else {
         routePages(path, response);
      }
      logRequest(request, response);
   }

   function onListen() {
      console.log("Server at "          +
                  config.host           +
                  " listening on port " +
                  config.ports.http);
   }

   /* TODO Revise this validation scheme */
   function firstValidPathName(parts) {
      var match = new RegExp("[a-zA-Z0-9]+");
      for(var i = 0; i < parts.length; i++) {
         if(match.test(parts[i]) === true) {
            return parts[i];
         }
      }
   }

   function routePages(path, response) {
      var handler, handlerPath, file;
      var parts = path.split("/");
      var page = path === "/"? "" : firstValidPathName(parts);
      try {
         router.load(page, function(text) {
            response.write(text);
            response.end();
         });
         response.servedWith = router.last(); // TODO FIX THIS
      } catch(e) {
         console.log(e.stack);
      }
   }

   function getContentType(extension) {
      if(config.types.hasOwnProperty(extension)) {
         return config.types[extension].type;
      } else {
         throw "Not allowed";
      }
   }

   function serveFile(file, response) {
      var head;
      var parts = file.split(".");
      var extension = parts[parts.length - 1];
      try {
         head = { "Content-type": getContentType(extension) };
         serveContents(file, extension, response, head);
      } catch(e) {
         notFound(response);
      }
   }

   function serveContents(file, extension, response, head) {
      var parts = file.split("/");
      var name = parts[parts.length - 1];
      var dir = parts[parts.length - 2];
      var fileName = RESOURCESDIR + "/" +
                     dir          + "/" +
                     name;

      function serveHandler(err, contents) {
         if(err) {
            notFound(response);
         } else {
            response.writeHead(httpCode.OK, head);
            response.write(contents);
            response.end();
         }
      }

      if(config.types.hasOwnProperty(extension) &&
         config.types[extension].dirs.indexOf(dir) !== -1) {
         fs.readFile(fileName,  "utf8", serveHandler);
         response.servedWith = fileName;
      } else {
         throw "Not allowed";
      }
   }

   function logRequest(request, response) {
      var d = new Date();
      var log = "when [" + d.toTimeString()                  +
                " " + d.toDateString() + "] - "              +
                "from [" + request.connection.remoteAddress  +
                "] - " + "request [" + request.method + " "  +
                request.url + "]";
      if(response.servedWith !== undefined) {
         log += " - served [" + response.servedWith + "]";
      }
      console.log(log);
   }

   function notFound(response) {
      var cType = { "Content-type": "text/plain" };
      response.writeHead(httpCode.NOT_FOUND, cType);
      response.write("Not found :-(");
      response.servedWith = "notFound()";
      response.end();
   }

   var returnObject = {
      start    : function(serverConfig) {
         config = serverConfig;
         serv.listen(config.ports.http,
                     config.host,
                     BACKLOG,
                     onListen);
      },
      setRouter: function(theRouter) {
         router = theRouter;
      }
   }

   Object.freeze(returnObject);
   return returnObject;
}());