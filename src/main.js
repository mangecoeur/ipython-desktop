var app = require('app');  // Module to control application life.
var ipc = require('ipc');
var path = require('path');

var _ = require('lodash');
var fs = require('fs');
var shell = require('shelljs');
var shortId = require('shortid');
var child_process = require('child_process');
var prefs = require('./ipyd-preferences.js');
var winston = require('winston');

var BrowserWindow = require('browser-window');  // Module to create native browser window.
var Menu = require('menu');


// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  //if (process.platform != 'darwin')
    appShutdown();
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 900});

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
  if (!isRunning(serverId)) {
    startServer(serverId, event.sender)
  }
  //todo: else send did not start
});


ipc.on('stop-server', function(event, serverId) {
  stopServer(serverId, event.sender);
});

setUpMenus();


function setUpMenus(){

  var template = [
  {
    label: 'IPython Desktop',
    submenu: [
      {
        label: 'About Atom Shell',
        selector: 'orderFrontStandardAboutPanel:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: 'Hide Atom Shell',
        accelerator: 'Command+H',
        selector: 'hide:'
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
      },
      {
        label: 'Show All',
        selector: 'unhideAllApplications:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: function() { appShutdown(); }
      },
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'Command+Z',
        selector: 'undo:'
      },
      {
        label: 'Redo',
        accelerator: 'Shift+Command+Z',
        selector: 'redo:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Cut',
        accelerator: 'Command+X',
        selector: 'cut:'
      },
      {
        label: 'Copy',
        accelerator: 'Command+C',
        selector: 'copy:'
      },
      {
        label: 'Paste',
        accelerator: 'Command+V',
        selector: 'paste:'
      },
      {
        label: 'Select All',
        accelerator: 'Command+A',
        selector: 'selectAll:'
      },
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'Command+R',
        click: function() { BrowserWindow.getFocusedWindow().reloadIgnoringCache(); }
      },
      {
        label: 'Toggle DevTools',
        accelerator: 'Alt+Command+I',
        click: function() { BrowserWindow.getFocusedWindow().toggleDevTools(); }
      },
      {
        label: "Refresh Server page",
        click: function(){
          //gui.Window.open('config')
          //window.location.hash = '/config';
          if (runningServer(prefs.defaultId())){
            BrowserWindow.getFocusedWindow().webContents.send('refresh-server');
          }
        }
      }
    ]
  },
  {
   label: "Server",
   submenu:[
    {
      label: "Start",
      click: function(){
        startServer(prefs.defaultId(), mainWindow.webContents);
      }
    },
    {
      label: "Stop",
      click: function() {
        stopServer(prefs.defaultId());
      }
    },
    // {label: "Connect",
    //   click: "connectLocal"
    // },
    {
      label: "Configure",
      click: function(){
        //gui.Window.open('config')
        window.location.hash = '/config';
      }
    }
    ]
  },
  {
    label: 'Window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'Command+M',
        selector: 'performMiniaturize:'
      },
      {
        label: 'Close',
        accelerator: 'Command+W',
        selector: 'performClose:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        selector: 'arrangeInFront:'
      },
    ]
  },
  {
    label: 'Help',
    submenu: []
  },
  ];

  menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}



function logMy(msg) {
  winston.log('info', msg);
  //console.log(msg);
}

processes = {};

var runningServers = {};

function runningServer(id){
  return runningServers[id];
}


/**
 * [startServer description]
 *
 * emits 'server-started' when ready
 * @param  {[type]} id [description]
 * @return {[type]}    [description]
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
    logMy("INCREMENT PID BY 1 - FIX THIS SHIT!!");
    ipythonProc.pid += 1;

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
      logMy(data.toString());
    });

    //connect to the stderr stream. Use it to know when ipythonProc has actually started.
    ipythonProc.stderr.on('data', function (data) {
      //TODO: could parse some of the messages for start/stop status
      //logMy('stderr: ' + data);

      //The first time we get something from stderror we know the server has started
      //Then try to get the running server info from its file        
      if (!srv.url) {
        getRunningServerInfo(srv, function(srv_info){
          srv.url = srv_info.url;

          logMy('server running at ' + srv.url);

          //TODO: send the info to the window associated with this server
          //currently just sends to mainwindow
          if (client !== undefined){
            client.send('server-started', _.pick(srv, 'id', 'name', 'conf', 'url', 'type')); //don't bother with process
          }
        });
      }
    });

    //Broadcast server closed on process terminate
    ipythonProc.on('close', function (code) {
      logMy('child process exited with code ' + code);
      if (mainWindow !== undefined){
        mainWindow.webContents.send('server-stopped', code);
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

    mainWindow.webContents.send('server-started', runningServers[cnf.id])

    //return runningServers[cnf.id];
  }
}

//IMPORTANT do not use callback from web process
function getRunningServerInfo(ipyServer, doneCb) {
  var srv_json_path = path.join(ipyServer.conf.ipythonConfDir, 
                                "security", "nbserver-" + (ipyServer.process.pid)  + ".json");
  var srv_info;
  var retryCount = 0;
  var maxRetry = 40;
  
  //TODO: somehow ensure that callback is only called once...
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
          return;
        }
      }
    });
  }
  readSrv();
}

//Stop the ipython server with the given internal id.
function stopServer(id) {
  if (id === undefined) {
    id = prefs.defaultId();
    console.log(id);
  }
  var srv = runningServers[id];
  if (srv.process) {
    shell.exec('kill ' + (srv.process.pid), {async: false});
  }

  if(srv) {
    if (srv.process && srv.process.kill !== undefined) {
      srv.process.kill();
    }
            
    delete runningServers[id];

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

function appShutdown(){
  //TODO: run this like a garbage collect, nuke leftovers, possibly run regularly.
  for (var id in runningServers) {
    stopServer(id);
  }
  runningServers = {};
  app.quit();
}

