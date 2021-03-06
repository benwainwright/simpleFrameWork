"use strict";

var server = require("../libs/server");
var http   = require("http");
var assert = require("assert");
var port   = 4352;
var url    = "http://localhost:" + port;
var config = {
   ports: {
      http: port
   },
   host : "localhost"
};

var mockParser = {
   parse: function(req, resp, callback) {
      var returnObj = {
         allowed: true
      };
      callback(returnObj, req, resp);
   }
};

var mockRouter = {
   load: function(resource, callback) {
      callback(false, "dummy response");
   },
   last: function() {
      return "last page";
   }
};

var mockOutput = {
   log  : function() {},
   print: function() {}
};

var mockSessions = {
   set  : function() {},
   get  : function() {},
   start: function() {}
};

describe("server", function() {
   before(function () {
      server.setRouter(mockRouter);
      server.setParser(mockParser);
      server.setOutput(mockOutput);
      server.setSessionHandler(mockSessions);
      server.start(config);
   });

   it("Should return 200 when we ask for the index page", function(done) {
      http.get(url, function(res) {
         assert.equal(200, res.statusCode);
         done();
      });
   });

   it("Should respond with the data given by the router", function(done) {
      var expected = "dummy response";
      http.get(url, function(res) {
         var data = "";

         res.on("data", function(chunk) {
            data += chunk;
         });

         res.on("end", function() {
            assert.equal(expected, data);
            done();
         });
      });
   });

   after(function () {
      server.stop();
   });
});
