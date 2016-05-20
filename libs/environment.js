module.exports = (function() {
   "use strict";

   var sessions, environment,
      theResource, theResponse;
   
   var REDIRECT_CODE = 302;

   function buildEnvironment(resource, request, response) {
      theResource = resource;
      theResponse = response;
      if(resource !== undefined) {
         environment = {
            method : request.method,
            headers: request.headers,
            type   : resource.type
         };
         environment.connection = makeConnObject(resource, request);
         environment.url = makeURLObject(resource);
      }
      setMethods(response);
      addSessionHandler();
      resource.env  = environment;
   }
  
   function setMethods(response) {
      environment.setHeader     = setHeader;
      environment.redirect      = redirect;
      environment.setStatusCode = setStatusCode;
   }  
   
   function setHeader(key, value) {
      theResponse.setHeader(key, value);
   }

   function redirect(location, code) {
      environment.setHeader("Location", location);
      code = code === undefined? REDIRECT_CODE : code; 
      environment.setStatusCode(code);
   }
   
   function setStatusCode(code) {
      theResource.statusCode = code;
   }

   function makeConnObject(resource, request) {
      var con, connObject;
      if(request !== undefined &&
         request.socket !== undefined) {
         con = request.socket;
         connObject = {
            address: con.remoteAddress,
            type   : con.remoteFamily,
            local  : con.localAddress
         };
      }
      return connObject;
   }

   function addSessionHandler() {
      environment.session = {};
      environment.session.get = sessions.get;
      environment.session.set = sessions.set;
   }

   function makeURLObject(resource) {
      var urlObject;
      if(resource !== undefined &&
         resource.url !== undefined) {
         urlObject = {
            raw        : resource.url.path,
            dirs       : resource.path,
            querystring: resource.url.search,
            query      : resource.url.query
         };
      }
      return urlObject;
   }

   return {
      build            : buildEnvironment,
      setSessionHandler: function(sessionHandler) {
         sessions = sessionHandler;
      }
   };
}());
