'use strict';

//Nodejs builtins
var path = require('path');
var child_process = require('child_process');
var fs = require('fs');

//third party modules
var moment = require('moment');
var shell = require('shelljs');
var _ = require('underscore-plus');
var EventEmitter = require('events').EventEmitter;

//Homemade modules
var prefs = require('../ipyd_preferences.js');

var runningServers = {};

var psTree = require('ps-tree');

function NBServer(config) {
    EventEmitter.call(this);

    var self = this;

    self.conf = config;
    self.id = config.id;
    self.name = config.name;
    self.type = config.type;
    self.url = null;
    self.process = null;


    if (self.type == 'local') {
        //handle ipython command args
        var argList = ['notebook', '--no-browser'];

        if (self.conf.ipyProfile && self.conf.ipyProfile !== "") {
            argList.push("--profile=" + self.conf.ipyProfile);
        }

        if (this.conf.ipythonOpts) {
            argList = argList.concat(self.conf.ipythonOpts);
        }
        console.log(self.conf.ipython);
        self.process = child_process.spawn(self.conf.ipython, argList);
        console.log(process.pid);

        psTree(process.pid, function (err, children) {
            [process.pid].concat(
                children.map(function (p) {
                    return p.PID;
                })
            ).forEach(function (tpid) {
                    console.log('pid:');
                    console.log(tpid);
                });
        });
        //---------------------------
        //FIXME!!!! SOME BUG IN CHILD PROCESS PID REPORTS A PID 1 TOO SMALL
        //logMy("INCREMENT PID BY 1 - FIX THIS SHIT!!");
        //ipythonProc.pid += 1;

        //----------------------------


        self.process.stdout.on('data', function (data) {
            console.log('IPython: ' + data.toString());
        });

        //connect to the stderr stream. Use it to know when ipythonProc has actually started.
        self.process.stderr.on('data', function (data) {
            console.log('IPython: ' + data.toString());

            //The first time we get something from stderror we know the server has started
            //Then try to get the running server info from its file
            //TODO: could parse some of the messages for start/stop status

            if (!self.url) {
                var srv_info = getRunningServerInfo(self.conf.ipythonConfDir, self.process.pid);
                self.url = srv_info.url;
                self.emit('server:started');
            }
        });

        //Broadcast server closed on process terminate
        self.process.on('close', function (code) {
            console.log('child process exited with code ' + code);
            self.exitcode = code;
            self.emit('server:stopped');
        });

    }
    else if (this.type == 'remote') {
        self.url = self.conf.ipython;
        self.emit('server:started');
    }

    //self.kill = function kill(){
    //    //if (self.process) {
    //    //    shell.exec('kill ' + (self.process.pid), {async: false});
    //    //}
    //
    //    if (self.process && self.process.kill !== undefined) {
    //      self.process.kill();
    //    }
    //
    //    self.emit('server:stopped');
    //}


    self.kill = function (pid, signal, callback) {
        signal   = signal || 'SIGKILL';
        callback = callback || function () {};
        var killTree = true;
        if(killTree) {
            psTree(pid, function (err, children) {
                [pid].concat(
                    children.map(function (p) {
                        return p.PID;
                    })
                ).forEach(function (tpid) {
                        try { process.kill(tpid, signal) }
                        catch (ex) { }});
                self.emit('server:stopped');

                callback();
            });
        } else {
            try { process.kill(pid, signal) }
            catch (ex) { }
            self.emit('server:stopped');

            callback();
        }
    };
}

NBServer.prototype.__proto__ = EventEmitter.prototype;


function runningServer(id) {
    return runningServers[id];
}

function logMy(msg) {
    //winston.log('info', msg);
    console.log(msg);
}


function startServer(id) {
    if (id === undefined) {
        id = prefs.defaultId();
    }
    var cnf = prefs.getServer(id);
    var srv = new NBServer(cnf);
    runningServers[cnf.id] = srv;
    return srv;
}


function getRunningServerInfo(ipythonConfDir, pid) {
    var srv_json_path = path.join(ipythonConfDir,
        "security", "nbserver-" + (pid) + ".json");
    console.log(srv_json_path)
    var srv_info = null;
    var retryCount = 0;

    var errResult = null;


    var doRead = function () {
        try {
            srv_info = JSON.parse(fs.readFileSync(srv_json_path));
        }
        catch (err) {
            //do nothing
            errResult = err;
            //Wait
        }
    };
    var maxRetry = 4;


    //Hack to retry Synchronously with wait (because fuck callbacks!)
    var now = moment().millisecond();
    while (srv_info === null && retryCount < maxRetry) {
        var newnow = moment().millisecond();
        if (newnow - now > 200) {
            doRead();
            retryCount += 1;
            now = newnow;
        }
    }

    if (srv_info !== null) {
        return srv_info;
    }
    else {
        console.log("Could not get info for server with PID " + (ipyServer.process.pid));
        return null;
    }
}

//Stop the ipython server with the given internal id.
function stopServer(id) {
    if (id === undefined) {
        id = prefs.defaultId();
    }
    var srv = runningServers[id];

    if (srv) {
        srv.kill();
        delete runningServers[id];

        //TODO: correctly handle remote case
        //TODO handle this with callback
        logMy(id + ' has been shut down');
    }
}

function isRunning(id) {
    return !!runningServers[id];
}

function stopAllServers() {
    //TODO: run this like a garbage collect, nuke leftovers, possibly run regularly.
    for (var id in runningServers) {
        stopServer(id);
    }
    runningServers = {};
}



var exports = module.exports = {
    'NBServer': NBServer,
    'startServer': startServer,
    'stopServer': stopServer,
    'getRunningServerInfo': getRunningServerInfo,
    'isRunning': isRunning,
    'stopAllServers': stopAllServers,
    'runningServer': runningServer,
    'runningServers': runningServers
};
