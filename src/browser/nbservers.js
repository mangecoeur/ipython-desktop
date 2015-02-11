//Nodejs builtins
var path = require('path');
var child_process = require('child_process');
var fs = require('fs');

//third party modules
var moment = require('moment');
var shell = require('shelljs');
var _ = require('underscore-plus');

//Homemade modules
var prefs = require('../ipyd_preferences.js');

var runningServers = {};


var exports = module.exports = {
    'startServer': startServer,
    'stopServer': stopServer,
    'getRunningServerInfo': getRunningServerInfo,
    'isRunning': isRunning,
    'stopAllServers': stopAllServers,
    'runningServer': runningServer,
    'runningServers': runningServers
};


function runningServer(id){
  return runningServers[id];
}

function logMy(msg) {
  //winston.log('info', msg);
  console.log(msg);
}

/**
 * [startServer description]
 *
 * emits 'server.started' when ready
 * @param  {[type]} id [description]
 * @return {[type]}    [description]
 * @param client
 */
function startServer(id, client) {
  if (id === undefined) {
    id = prefs.defaultId();
  }
  var cnf = prefs.getServer(id);

  if (cnf.type == 'local') {
    //handle ipython command args
    var argList = ['notebook', '--no-browser'];
    
    if (cnf.ipyProfile && cnf.ipyProfile !== ""){
      argList.push("--profile=" + cnf.ipyProfile);
    }

    if (cnf.ipythonOpts) {
      argList = argList.concat(cnf.ipythonOpts);
    }
    var ipythonProc = child_process.spawn(cnf.ipython, argList);
    
    //---------------------------
    //FIXME!!!! SOME BUG IN CHILD PROCESS PID REPORTS A PID 1 TOO SMALL
    //logMy("INCREMENT PID BY 1 - FIX THIS SHIT!!");
    //ipythonProc.pid += 1;

    //----------------------------  
    
    runningServers[cnf.id]=  {
      'id': cnf.id,
      'name': cnf.name,
      'process': ipythonProc,
      'conf': cnf,
      'url': null,
      'type': 'local'
    };


    var srv = runningServers[cnf.id];

    ipythonProc.stdout.on('data', function (data) {
      logMy('IPython: ' + data.toString());
    });

    //connect to the stderr stream. Use it to know when ipythonProc has actually started.
    ipythonProc.stderr.on('data', function (data) {
      logMy('IPython: ' + data.toString());

      //The first time we get something from stderror we know the server has started
      //Then try to get the running server info from its file
      //TODO: could parse some of the messages for start/stop status

      if (!srv.url) {
        var srv_info = getRunningServerInfo(srv);
        srv.url = srv_info.url;
        logMy('server running at ' + srv.url);
        
        //TODO: send the info to the window associated with this server
        //currently just sends to mainwindow
        if (client !== undefined){
          client.send('server.started', _.pick(srv, 'id', 'name', 'conf', 'url', 'type')); //don't bother with process
        }
      }
    });

    //Broadcast server closed on process terminate
    ipythonProc.on('close', function (code) {
      logMy('child process exited with code ' + code);
      if (mainWindow !== undefined){
        mainWindow.webContents.send('server.stopped', code);
      }
    });

  }
  else if (cnf.type == 'remote') {
    runningServers[cnf.id] = {
      'id': cnf.id,
      'process': null,
      'config': cnf,
      'url': cnf.ipython,
      'type': 'remote'
    };

    mainWindow.webContents.send('server.started', runningServers[cnf.id]);

    //return runningServers[cnf.id];
  }
}

//IMPORTANT do not use callback from web process
function getRunningServerInfo(ipyServer) {
  var srv_json_path = path.join(ipyServer.conf.ipythonConfDir, 
                                "security", "nbserver-" + (ipyServer.process.pid)  + ".json");
  var srv_info = null;
  var retryCount = 0;
  var maxRetry = 400;
  
  var errResult = null;


  var doRead = function(){
    try {
      srv_info = JSON.parse(fs.readFileSync(srv_json_path));
    }
    catch (err){
      //do nothing
      errResult = err;
      //Wait
    }
  };

  //Hack to retry Synchronously with wait (because fuck callbacks!)
  var now = moment().millisecond();
  while (srv_info === null && retryCount < maxRetry) {
    var newnow = moment().millisecond();
    if (newnow - now > 200){
      doRead();
      retryCount+=1;      
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

  if(srv) {
    //TODO choose a kill method
    if (srv.process) {
      shell.exec('kill ' + (srv.process.pid), {async: false});
    }

    //if (srv.process && srv.process.kill !== undefined) {
    //  srv.process.kill();
    //}

    //TODO: get window associated with server - not just mainwindow
    mainWindow.webContents.send('server.stopped', id);

    delete runningServers[id];

    //TODO: correctly handle remote case
    //TODO handle this with callback
    logMy(id + ' has been shut down');
  }
}

function isRunning(id) {
  return !!runningServers[id];
}

function stopAllServers(){
  //TODO: run this like a garbage collect, nuke leftovers, possibly run regularly.
  for (var id in runningServers) {
    stopServer(id);
  }
  runningServers = {};
}

