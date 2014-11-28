
//Atom-shell Specific
var app = require('app');  // Module to control application life.
var ipc = require('ipc');
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var Menu = require('menu');
var MenuItem = require('menu-item');

//Nodejs builtins
var path = require('path');
var child_process = require('child_process');
var fs = require('fs');

//third party modules
var moment = require('moment');
var _ = require('lodash');
var shell = require('shelljs');
var shortId = require('shortid');
var winston = require('winston');

//Homemade modules
var prefs = require('./ipyd-preferences.js');

// Report crashes to our server.
require('crash-reporter').start();

//FIXME: hitting "server stop" seems to generate an empty Atom proc?!
//TODO: disable the "server stop" button if no server is running
//FIXME: prevent error msg when server stop is pressed when no servers are running

//-- Module global vars --

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;
//global ref to main menu so we can update it wherever
var mainMenu = null;
//holder for all notebook windows (subject to change if we want tabbed UI)
var notebookWindows = {};


//Template to build the app menu
var menuTemplate = [
  {
    label: 'IPython Desktop',
    submenu: [
      {
        label: 'About IPython Desktop',
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
        label: 'Hide IPython Desktop',
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
      }
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
      //{
      //  label: "Status",
      //  click: function() {
      //
      //  }
      //},
      // {label: "Connect",
      //   click: "connectLocal"
      // },
      {
        label: "Configure",
        click: function(){
          //gui.Window.open('config')
          window.location.hash = '/config';
        }
      },
      {
        type: 'separator'
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
      }
    ]
  },
  {
    label: 'Help',
    submenu: []
  }
];

var runningServers = {};

function runningServer(id){
  return runningServers[id];
}

function logMy(msg) {
  winston.log('info', msg);
  //console.log(msg);
}

function addServerToMenu(server) {
  var srvMenu = _.findWhere(mainMenu.items, {'label':'Server'});
  var srvItem = new MenuItem({label: server.url, click: function(){

  }})
  srvMenu.append(srvItem);
}


// Quit when all windows are closed (including for Mac - though this could change)
app.on('window-all-closed', function() {
  //if (process.platform != 'darwin')
    appShutdown();
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 900, 'node-integration': 'all'});
  
  //set up menus for window
  mainMenu = Menu.buildFromTemplate(menuTemplate);

  Menu.setApplicationMenu(mainMenu);

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


ipc.on('server.start', function(event, serverId) {
  if (!isRunning(serverId)) {
    startServer(serverId, event.sender);
  }
  else if (isRunning(serverId)) {
    var srv = _.pick(runningServer(serverId), 'id', 'name', 'conf', 'url', 'type');
    event.sender.send('server.started', srv); //don't bother with process
  }
  //todo: else send did not start
});


ipc.on('server.stop', function(event, serverId) {
  stopServer(serverId, event.sender);
});

ipc.on('server.status', function(event, serverId) {
  var result;
  if (serverId !== undefined) {
    result = runningServer(serverId);
    result = _.pick(result, 'id', 'name', 'conf', 'url', 'type');
  }
  else {
    result = _.map(runningServers, 
      function(srv, srvId) {        
        return _.pick(srv, 'id', 'name', 'conf', 'url', 'type');
      });
  }
  event.sender.send('server.status', result);
});

ipc.on('notebook.new.window', function(event, url) {
    var win = new BrowserWindow({ width: 800, height: 600, 'node-integration':false });
    win.loadUrl(url);
    win.webContents.addEventListener('new-window', function(e) {
      console.log('here');
      require('shell').openExternal(e.url);
    });
    notebookWindows[e.url] = win;
})

/**
 * [startServer description]
 *
 * emits 'server.started' when ready
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
      logMy(data);

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

  //Hack to retry Synchronously with wait (because to hell with callbacks!)
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

