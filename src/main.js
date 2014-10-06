var app = require('app');  // Module to control application life.
var ipc = require('ipc');
var path = require('path');

var _ = require('underscore');
var fs = require('fs');
var shell = require('shelljs');
var shortId = require('shortid');
var child_process = require('child_process');

var prefs = require('./ipyd-preferences.js');

var winston = require('winston');
var BrowserWindow = require('browser-window');  // Module to create native browser window.

// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600});

  // and load the index.html of the app.
  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});




ipc.on('start-server', function(event, serverId) {
  event.sender.send('data-server-id', startServer(serverId));
});


ipc.on('stop-server', function(event, serverId) {
  event.sender.send('data-server-id', stopServer(serverId));
});


exports.isRunning= isRunning;
exports.cleanUp= cleanUp;
exports.runningServer = runningServer;


//todo: don't access autostart from web page, should be handled in 'server' process
exports.autoStart = autoStart;//autoStart;







function logMy(msg) {
  winston.log('info', msg);
  //console.log(msg);
}


processes = {};



//TODO: can probably define functions as property of parent function and return "this"
exports.servers = servers;
exports.getServer = getServer;
exports.newServer = newServer;
exports.saveServer = saveServer;
exports.deleteServer = deleteServer;
exports.reset = resetDefaultConf;
exports.defaultId = defaultServerId;
exports.autoStart = autoStart;//autoStart;

exports.startServer = startServer;
exports.stop = stopServer;
exports.isRunning= isRunning;
exports.cleanUp= cleanUp;
exports.runningServer = runningServer;



// --- Init
var HOME_DIR = process.env[(process.platform == 'win32') ? ' ' : 'HOME'];
var BASE_CONF_DIR = path.join(HOME_DIR, ".ipython-desktop");
var SERVER_CONF_DIR = path.join(BASE_CONF_DIR, "servers");
var DEFAULT_SERVER = null;//'defaultSrv';  
var AUTO_START = false;
var runningServers = {};


//create the config path
shell.mkdir('-p', SERVER_CONF_DIR);

if (servers() === undefined) {
  resetDefaultConf();
}

//TODO - put this also in user conf dir
if (!DEFAULT_SERVER) {
  resetDefaultConf();
}

function runningServer(id){
  return runningServers[id];
}

function defaultServerId(value){ 
  if (value !== undefined) {
    DEFAULT_SERVER = value;
  }
  return DEFAULT_SERVER;
}

function autoStart(value) {
    if (value !== undefined) {
      AUTO_START = value;
    } else {
      return AUTO_START;
    }
}

//TODO - use user folder to save config file instead of localstorage
//TODO: maybe have one file per configuration
function saveServer(config){
  if (config.ipyProfile) {
    config.ipyProfile = config.ipyProfile.trim();        
  }
  if (config.ipythonOpts) {
    config.ipythonOpts = config.ipythonOpts.trim().split(" ");        
  }

  //set the location of the ipython profile configuration for when we want to get the server running info file.
  //avoids having to run the search when we are waiting for the server to start.
  config.ipythonConfDir = profileConfDir(config);
  //Ignore any extra fields, such as isDefault
  config = _.pick(config, "id", "ipython", "type", "ipyProfile", "ipythonConfDir");
  var confFileName = path.join(SERVER_CONF_DIR, config.id + ".json");

  //Save conf as json file
  fs.writeFile(confFileName, JSON.stringify(config, null, 4)); 
  fs.writeFile(confFileName, JSON.stringify(config, null, 4), function(err) {
      if(err) {
        logMy(err);
      } else {
        logMy("JSON saved to " + confFileName);
      }
  }); 
}

function newServer() {
  ipython_bin_loc = detectDefaultIpython();
  defaultConf = {
                  'id': shortId(),
                  'ipython': ipython_bin_loc,
                  'type': 'local',
                  };
  return defaultConf;
}

function getServer(id) {
  return _.find(getServerConfList(), function(cnf){return cnf.id === id;});
}

function deleteServer(id){
  var config = getServer(id);
  var confFileName = path.join(SERVER_CONF_DIR, config.id + ".json");
  shell.rm('-f', confFileName); //delete with f, means ignore if not there
}


function profileConfDir(config){
  var cmd_profile = config.ipython + " profile locate";
  var profile_dir
  if(config.ipyProfile){
    cmd_profile = cmd_profile + " " + config.ipyProfile;
  }
  
  try {
    result = shell.exec(cmd_profile, {async: false});
    profile_dir = result.output.trim().replace(/[\r\n]/g, "");
  } catch(err) {
    profile_dir = path.join(HOME_DIR, '.ipython');
    if(config.ipyProfile){
      profile_dir = path.join(profile_dir, "profile_" + config.ipyProfile);
    }
  }
  logMy(profile_dir);

  return profile_dir;

  // child_process.exec(cmd_profile, function(err, stout, sterr) {
  //   if (err !== null) {
  //     logMy('problem locating profile: ' + error);
  //     return; // skip the rest
  //   }

  //   var profile_dir = stout.trim().replace(/[\r\n]/g, "");
  //   callback(profile_dir);
  // }
}

//read all server configs from the config directory
//append them to list.
function getServerConfList() {
  try {
    var files = fs.readdirSync(SERVER_CONF_DIR);
    var confList = [];
    
    for (var i = files.length - 1; i >= 0; i--) {
      var filename = files[i];

      if (path.extname(filename) === ".json"){
        var data = fs.readFileSync(path.join(SERVER_CONF_DIR,filename));
        var conf = JSON.parse(data);
        if (conf.id == defaultServerId()) {
          conf.isDefault = true;
        }
        confList.push(conf);
      }
    }
    return confList;

  } catch(e) {
    return undefined;
  }
}

//Try to figure out the default IPython using "which" - FIXME - NO WINDOWS SUPPORT
//calls fn handleExecName(path of ipython bin) when found
function detectDefaultIpython(callback){
  var ipython_bin
  try {
   ipython_bin = shell.which('ipython');
   logMy(ipython_bin);
  } 
  catch(err) {
    ipython_bin = "/usr/bin/ipython";
  }

  //FIXME get which working
  if (!ipython_bin || ipython_bin === '') {

    ipython_bin ='/Users/jonathanchambers/anaconda/bin/ipython';
    //ipython_bin = "/usr/bin/ipython";
    logMy("could not find default ipython");

  }
  logMy(ipython_bin);

  return ipython_bin;
}

function resetDefaultConf(){
  var ipython_bin_loc = detectDefaultIpython();
  var defaultConf = {
                      'id': 'defaultSrv',
                      'name': 'IPython Default',
                      'ipython': ipython_bin_loc,
                      'type': 'local',
                      };
    saveServer(defaultConf);

    //TODO: decide where best to save these. probably together with server settings
    DEFAULT_SERVER = 'defaultSrv';
    autoStart(false);
}

function servers(configList) {
    if (configList !== undefined) {
      _.each(configList, saveServer);
    }
    return getServerConfList();
}


function saveServerConfList(configList) {
  if (configList !== undefined) {
    _.each(configList, saveServer);
  }
  return getServerConfList();
}



//start an ipython server with the given id
function startServer(id) {
  if (id === undefined) {
    id = defaultServerId();

  }
  var cnf = getServer(id);

  if (cnf.type == 'local') {
    //handle ipython command args
    var argList = ['notebook', '--no-browser'];
    
    if (cnf.ipyProfile && cnf.ipyProfile !== ""){
      argList.push("--profile=" + cnf.ipyProfile);
    }

    if (cnf.ipythonOpts) {
      argList = argList.concat(cnf.ipythonOpts);
    }
    var ipython = child_process.spawn(cnf.ipython, argList);
    
    //---------------------------
    //FIXME!!!! SOME BUG IN CHILD PROCESS PID REPORTS A PID 1 TOO SMALL
    //logMy("INCREMENT PID BY 1 - FIX THIS SHIT!!");
    //logMy(ipython.pid);
    ipython.pid += 1;

    //----------------------------  
    
    var newRemoteServer = {
      'id': cnf.id,
      'name': cnf.name,
      'process': ipython,
      'conf': cnf,
      'url': null,
      'type': 'local'
    };

    runningServers[cnf.id] = newRemoteServer;

    ipython.stdout.on('data', function (data) {
      logMy(data.toString());
    });

    //connect to the stderr stream. Use it to know when ipython has actually started.
    ipython.stderr.on('data', function (data) {
      //TODO: could parse some of the messages for start/stop status
      //logMy('stderr: ' + data);

      //The first time we get something from stderror we know the server has started
      //Then try to get the running server info from its file        
      if (!newRemoteServer.url) {
        getRunningServerInfo(newRemoteServer, function(srv_info){
          newRemoteServer.url = srv_info.url;


          //TODO: send the info to the window associated with this server
          window.webContents.send('server-started', newRemoteServer)
        });
      }
    });

    //Broadcast server closed on process terminate
    ipython.on('close', function (code) {
      logMy('child process exited with code ' + code);
      // if (_.isFunction(onStopCb)){
      //   onStopCb(newRemoteServer)
      // }
      // 
      
      window.webContents.send('server-stopped', code)

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
    if (_.isFunction(onStartCb)){
      onStartCb(runningServers[cnf.id]);

    }
    //return runningServers[cnf.id];
  }
}

function getRunningServerInfo(ipyServer, doneCb) {
  var srv_json_path = path.join(ipyServer.conf.ipythonConfDir, 
                                "security", "nbserver-" + (ipyServer.process.pid)  + ".json");
  var srv_info;
  var retryCount = 0;
  var maxRetry = 40;
  //Reads the server info from the ipython conf dir
  function readSrv(){
    fs.readFile(srv_json_path, function(err, data) {
      if (err && retryCount < maxRetry) {
        retryCount += 1;

        //retry readSrv until it succeeds or give up after about 8s
        setTimeout(readSrv, 200);
      }
      else if(err && retryCount >= maxRetry) {
        throw err; //TODO nice UI to say error in loading profile
      }
      else {
        srv_info = JSON.parse(data);
        //Set the server's url based on info parsed from iPy's info file
        //ipyServer.url = srv_info.url;
        //logMy(ipyServer.id + ' has been started at:' + ipyServer.url);
        if (srv_info && _.isFunction(doneCb)) {
          doneCb(srv_info)
        }
      }
    });
  }
  readSrv();
}

//Stop the ipython server with the given internal id.
function stopServer(id) {
  if (id === undefined) {
    id = defaultServerId();
  }
  var srv = runningServers[id];
  if (srv.process) {
    shell.exec('kill ' + (srv.process.pid), {async: false});
  }

  //srv.process.kill('SIGINT');


  if(srv) {
    if (srv.process && srv.process.kill !== undefined) {
      srv.process.kill();
    }
            
    //delete runningServers[id];

    //TODO: correctly handle remote case
    //TODO handle this with callback
    logMy(id + ' has been shut down');
  }
}

function isRunning(id) {
  if(runningServers[id]) {
    return true;
  }
  else {
    return false;
  }
}

function cleanUp(){
  //TODO: run this like a garbage collect, nuke leftovers, possibly run regularly.
  //logMy("Cleaning up"); 
  for (var id in runningServers) {
    stopServer(id);
  }
  runningServers = {};

}