/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
//GOAL: easy set up, simple config
//GOAL: run without terminal faffing
//GOAL: clean UI without excess junk
//GOAL: customise keyboard since we don't conflict with browser shortcuts

//TODO: make location of profile dir associated with config more easily available
//TODO: decide if using ipython profile locate is really necessary rather than just hardcoding paths for now...
//TODO: linux support
//TODO: startup wizard
//TODO: create custom.js for ipython profile to interact with node-webkit, customize keyboard
//TODO: provide fault feedback, if any part of server launch fails, cancel whatever's been done and display message
//TODO: keyboard customization interface that writes pref into own custom.js which is dynamically copied into profile
//dir on start (backing up potential local copies first) and reverting it to original on stop
//TODO: Autostart option in window menu (with tickmark?)
//TODO: autodetect common installed pythons
//TODO - not priority - pull out the menu toolbar into the native menu (requires multi-window handling and directing
//correct events to correct window)
var _ = require('underscore');
var gui = require('nw.gui');
var shell = require('nw.gui').Shell;
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var shortId = require('shortid');
var nwWin = gui.Window.get();

$ = angular.element; //so we don't need jquery
global.runningServer = null;
// bit awkward, want to track if the server is starting up or
// shutting down and act differently while waiting for that to finish
global.serverStatus = null;
global.gui = gui;

console.log(process.mainModule.blob);
process.mainModule.exports.requireNode = require;

//process.mainModule.exports.requireNode = require;


/* App Module */
var app = angular.module('ipython', ['ngRoute', 'mgcrea.ngStrap'])
    .config(
      function($routeProvider, $locationProvider, $sceDelegateProvider) {
        $routeProvider
            .when('/',    {templateUrl: 'start.tpl.html', controller: StartPage})
            .when('/config',    {templateUrl: 'edit-servers.tpl.html', controller: EditIpythonConfig})

            .otherwise({redirectTo: '/'});
        
        $sceDelegateProvider.resourceUrlWhitelist([
             // Allow same origin resource loads.
             'self',
             // Allow loading from our assets domain.  Notice the difference between * and **.
             'http://127.0.0.1**'
        ]);
      }
    );
      

// helper functions
function log(message) {
  var logTemplate = _.template('<tr><td><%=time %></td><td><%=msg %></td></tr>');

  var date = new Date();
  var time = date.toLocaleTimeString();
  $("#log").append(logTemplate({'time': time, msg: JSON.stringify(message)}));
  console.log(message);
}

function StartPage($scope, $timeout, $location, serverConfig, ipythonProc, nwService, Page) {
  $scope.isRunning = ipythonProc.isRunning();
  $scope.isWaiting = false;

  $scope.startIpython = nwService.startIpython;
  
  $scope.stopIpython = function() {
    $scope.isWaiting = false;
    $scope.isRunning = false;
    $('#ipython-frame').attr('src', 'about:blank') ;
    $scope.$apply();
    nwService.stopIpython();
  };

  //reload the ipython page until it is ready
  function updateUrl(){
    $('#ipython-frame').attr('src', ipythonProc.running().url);
    $scope.isRunning = ipythonProc.isRunning();
    $scope.isWaiting = true;

    $scope.$apply();
    //try to update the iframe as long as the server is running but the document is not loaded
    if ($scope.isRunning && $('#ipython-main-app', frames['ipython-frame'].document).length === 0){
      $timeout(updateUrl, 200);
    } else {
      $scope.isWaiting = false;
    }
  }

  //register callbacks
  $scope.$on("serverStarting", function(id) {
    var title = "IPython Notebook";
    if (ipythonProc.running().ipyProfile) {
      title += " - " + ipythonProc.running().ipyProfile;
    }
    Page.setTitle(title);
    var timeout = $timeout(updateUrl, 200);
  });

  $scope.$on("serverStopping", function(id) {
    Page.setTitle("IPython");
    $scope.isRunning = false;
    $scope.$apply();
  });

  //Start the server if autostart is enabled
  if (serverConfig.autoStart()) {
    nwService.startIpython();
  }

  if ($scope.isRunning && $('#ipython-main-app', frames['ipython-frame'].document).length === 0) {
    var timeout = $timeout(updateUrl, 200);
  }
}

/**
 * Edit the Ipython config. For now, can only change the single default
 * Ipython server config. In the future, can add multiple configurations
 */
function EditIpythonConfig($scope, serverConfig, nwService, Page) {
  Page.setTitle("IPython Desktop preferences");
  $scope.configurations = serverConfig.all();
  $scope.autoStart = serverConfig.autoStart();
  $scope.defaultServer = serverConfig.defaultServerId();

  $scope.save = function (){
    serverConfig.all($scope.configurations);
    serverConfig.autoStart($scope.autoStart);
    window.location.hash = '/';
  };

  $scope.resetConf = function (){
    serverConfig.reset();
    $scope.conf = _.extend({}, serverConfig.get('defaultSrv'));
  };

  $scope.addServer = function (){
    //extend configurations with new default config
    serverConfig.newConf(function(conf) {
      $scope.configurations.push(conf);
      console.log($scope.configurations);
      $scope.$apply();
    });
  };

  $scope.setAsDefault = function(id){
      $scope.defaultServer = serverConfig.defaultServerId(id);
      $scope.configurations = serverConfig.all();
  };
}

/**
 * Set the page title, doesn't need to do anything part from inject the Page service
 * @param {[type]} $scope [description]
 * @param {[type]} Page   [description]
 */
function TitleCtrl($scope, Page) {
  $scope.$on("serverReady", function(id) {
    //console.log(id);
  });
}

app.factory('Page', function() {
   var title = 'IPython';
   return {
     title: function() { return title; },
     setTitle: function(newTitle) { 
        title = newTitle;
        document.title = title;
      }
   };
});

/**
 * Node webkit utilities service
 */
//FIXME this is a mess, use nice way to create object where we can refer to own methods
app.service('nwService', 
  function($rootScope, $q, $timeout, ipythonProc, serverConfig)  {

    // Expose gui and main window
    var gui = this.gui = require("nw.gui");
    var nwWin = this.nwWin = gui.Window.get();

    nwWin.on('close', function() {
      //TODO: confirm before exit
      //TODO: not sure what happens with multiple nwWins. might need to check if we are closing main nwWin only
      console.log('Closing down');
      if (ipythonProc.running() !== null) {
        ipythonProc.stop(ipythonProc.running().id);
      }
      nwWin.close(true); //have to explicitly close!
    });

    this.openWindow = gui.Window.open; // shourtcut to open new window

    function createMenuItems(menu, items) {

        _.each(items, function(i) {
          console.log("Creating item", i.label);

          // Shortcut to integrate menu with Angular event system when click represents an eventName
          if(_.isString(i.click)) {
              i.click = (function(menu, $rootScope, eventName) { 
                return function() { 
                  $rootScope.$broadcast(eventName, menu, this);
                };
              })(menu, $rootScope, i.click);
          }

          // Create a sub-menu if items are provided
          if(i.items) {
              i.submenu = new gui.Menu();
              createMenuItems(i.submenu, i.items);
          }

          // Append the menu item to the provided menu
          console.log("appending item %s to menu", i.label);
          menu.append(new gui.MenuItem(i));
        });
    }

    function createMenu(menuStructure) {
        // Create the top menu
        var menu = new gui.Menu(menuStructure);

        // Create sub-menu items if they're provided
        if(menuStructure && menuStructure.items) {
            console.log("Creating %d menu items for menu", menuStructure.items.length);
            createMenuItems(menu, menuStructure.items);
        }

        if(menu.type === 'menubar') {
            nwWin.menu = menu;
        }

        return menu;
    }

    this.startIpython = function () {
      if (!ipythonProc.isRunning()) {
        ipythonProc.start();
      }
      window.location.hash = '/';
    };

    this.stopIpython = function () {
      ipythonProc.stop();
      window.location.hash = '/';
      console.log('stopping');
    };

    this.connectLocal = function () {
      ipythonProc.connectLocal(ipythonProc.running());
    };

    //TODO conditionally enable/disable menus
    var menus = {
     type: "menubar",
     items:[{
         label: "Server",
         items:[{label: "Start",
                  click: "startIpython"
                },
                {label: "Stop",
                  click: "stopIpython"
                },
                // {label: "Connect",
                //   click: "connectLocal"
                // },
                {label: "Configure",
                  click: function(){
                    //gui.Window.open('config')
                    window.location.hash = '/config';
                  }
                }
            ]
          },
     {
       label: "View",
       items:[{label: "Refresh Page",
                click: function(){
                  //gui.Window.open('config')
                  //window.location.hash = '/config';
                  $('#ipython-frame').attr('src', ipythonProc.running().url);
                }
              }]}
     ]
    };
    
    createMenu(menus);
    
    //Register callbacks for menu button events
    $rootScope.$on("startIpython", this.startIpython);
    $rootScope.$on("stopIpython", this.stopIpython);
    $rootScope.$on("connectLocal", this.connectLocal);

});

/**
 * service to handle ipython server configuration and persistance
 * @return angular service
 */
app.factory('serverConfig', function() {
  var homeDir = process.env[(process.platform == 'win32') ? ' ' : 'HOME'];
  var confDir = path.join(homeDir, ".ipython-desktop");
  var serverConfDir = path.join(confDir, "servers");

  //Create the config dir, then the server config dir
  ensureExists(confDir, function() {
      ensureExists(serverConfDir);
  });

  //From http://stackoverflow.com/a/21196961
  function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0777;
    }
    else if (mask === undefined && cb === undefined){
      cb = function(){};
    }
    fs.mkdir(path, mask, function(err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
  }

  function defaultServerId(value){ 
    if (value !== undefined) {
      localStorage.defaultServer = value;
    }
    return localStorage.defaultServer;
  }

  function autoStart(value) {
      if (value !== undefined) {
        localStorage.autoStart = value;
      } else {
        return JSON.parse(localStorage.autoStart);
      }
  }

  //TODO - use user folder to save config file instead of localstorage
  //TODO: maybe have one file per configuration
  function saveServerConf(config){
    if (config.ipyProfile) {
      config.ipyProfile = config.ipyProfile.trim();        
    }
    if (config.ipythonOpts) {
      config.ipythonOpts = config.ipythonOpts.trim().split(" ");        
    }
    if (config.isDefault !== undefined) {
      //don't save default server to file
      delete config.isDefault;
    }

    config = _.pick(config, "id", "ipython", "type", "ipyProfile");
    var confFileName = path.join(serverConfDir, config.id + ".json");
    
    ensureExists(serverConfDir, function(){
      //Save conf as json file
      fs.writeFile(confFileName, JSON.stringify(config, null, 4), function(err) {
          if(err) {
            console.log(err);
          } else {
            console.log("JSON saved to " + confFileName);
          }
      }); 
    });
  }

  //read all server configs from the config directory
  //append them to list.
  function serverConf() {
    try {
      var files = fs.readdirSync(serverConfDir);
      var confList = [];
      
      for (var i = files.length - 1; i >= 0; i--) {
        var filename = files[i];

        if (path.extname(filename) === ".json"){
          var data = fs.readFileSync(path.join(serverConfDir,filename));
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
    child_process.exec("which ipython", function(err, stout, sterr) {
      if (err) {
        //if call to process failed, replace with generic system ipython
        //with no guarantee it exists
        //TODO: warn user instead.
        console.warn("could not find default ipython");
        callback("/usr/bin/ipython");
      }
      else {
        var ipython_bin = stout.trim().replace(/[\r\n]/g, "");
        callback(ipython_bin);        
      }
    });
  }

  function resetDefaultConf(){
    detectDefaultIpython(function(ipython_bin_loc){
      var defaultConf = {
                        'id': 'defaultSrv',
                        'name': 'IPython Default',
                        'ipython': ipython_bin_loc,
                        'type': 'local',
                        };
      saveServerConf(defaultConf);

        //TODO: decide where best to save these
      localStorage.defaultServer = 'defaultSrv';
      localStorage.autoStart = false;
    });  
  }

  function initConf() {
    if (serverConf() === undefined) {
      resetDefaultConf();
    }

    //TODO - put this also in user conf dir
    if (localStorage.defaultServer === undefined) {
      resetDefaultConf();
    }
  }

  function localServers() {
    var srv_list = serverConf();
      return _.where(srv_list, {type: 'local'});
  }

  function remoteServers() {
    var srv_list = serverConf();
      return _.where(srv_list, {type: 'remote'});
  }

  function all(configList) {
      if (configList !== undefined) {
        _.each(configList, saveServerConf);
      }
      return serverConf();
  }

  function get(id, callback) {
    return _.find(serverConf(), function(cnf){return cnf.id === id;});
  }

  //have to use async because of using exec. kinda a pain and pointless.
  function newConf(callback) {
    console.log(callback);
    detectDefaultIpython(function(ipython_bin_loc){
      var defaultConf = {
                    'id': shortId(),
                    'ipython': ipython_bin_loc,
                    'type': 'local',
                    };
      callback(defaultConf);
    });
  }

  //initialize the config on startup
  initConf();

  //TODO: can probably define functions as property of parent function and return "this"
  return {
    local: localServers,
    remote: remoteServers,
    all: all,
    get: get,
    newConf: newConf,
    save: saveServerConf,
    reset: resetDefaultConf,
    defaultServerId: defaultServerId,
    autoStart: autoStart
  };

});

//TODO: want to use wait() or similar to make sure desktop cannot close before
//processes finished. 
//TODO: make best effort to ensure processes close if parent crashes, e.g. open a pipe that will close
//a well behaved process should know it should terminate.
/**
 * Service to handle the running ipython processes and things like starting/stopping
 * Depends on rootScope and server config
 * @return ipython processes service
 */
app.factory('ipythonProc', function($rootScope, serverConfig)  {

  /**
   * Take a reference to the current running ipython server
   * (generally points to one stored in global obj)
   * @param  {[type]} ipyServer [description]
   * @return {[type]}           [description]
   */
  function connect(ipyServer) {
    var cmd_profile = ipyServer.conf.ipython + " profile locate";
    
    if(ipyServer.conf.ipyProfile){
      cmd_profile = cmd_profile + " " + ipyServer.conf.ipyProfile;
    }
    
    //set before async call so that it happens immediately  
    global.serverStatus = "serverReady";

    child_process.exec(cmd_profile, function(err, stout, sterr) {
      if (err !== null) {
        console.log('problem locating profile: ' + error);
        return; // skip the rest
      }

      var profile_dir = stout.trim().replace(/[\r\n]/g, "");
      var pid = runningServer().process.pid;

      var srv_json_path = path.join(profile_dir, "security", "nbserver-" + pid + ".json");

      var srv_info;
      var retryCount = 0;

      function readSrv(){
        fs.readFile(srv_json_path, function(err, data) {
          if (err && retryCount < 40) {
            retryCount += 1;
            //retry readSrv until it succeeds or give up after about 8s
            setTimeout(readSrv, 200);
          }
          else if(err && retryCount >= 10) {
            throw err; //TODO nice UI to say error in loading profile
          }
          else {
            srv_info = JSON.parse(data);
            ipyServer.url = srv_info.url;

            log(ipyServer.id + ' has been started at:' + ipyServer.url);
            
            // broadcast ready when we were able to read the server info
            $rootScope.$broadcast('serverReady', ipyServer.id, ipyServer);
          }
        });
      }
      
      readSrv();
    });
  }

  function runningServer() {
    return global.runningServer;
  }
  
  //start an ipython server with the given id
  function start(id) {
    if (id === undefined) {
      id = serverConfig.defaultServerId();

    }
    var cnf = serverConfig.get(id);
          console.log(cnf);
return;
    global.serverStatus = "serverStarting";

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
      
      //Note: upgrade this to handle multi server
      global.runningServer = {
        'id': cnf.id,
        'name': cnf.name,
        'process': ipython,
        'conf': cnf,
        'url': null
      };

      //Don't wait for the server to be ready to broadcast that we triggered it to start
      // - that way we can change the UI accordingly straight away
      ipython.stdout.on('data', function (data) {
         log(data.toString());
      });

      //connect to the stderr stream. Use it to know when ipython has actually started.
      ipython.stderr.on('data', function (data) {
        //TODO: could parse some of the messages for start/stop status
        log('stderr: ' + data);

        //The first time we get something from stderror we know the server has started
        //so then try to connect to it.
        //TODO: do this properly with events, with a state tracker that knows how to trigger or not events depends on last received
        if (global.serverStatus === "serverStarting") {
          connect(global.runningServer);
        }
      });

      //Broadcast server closed on process terminate
      ipython.on('close', function (code) {
        log('child process exited with code ' + code);
        global.serverStatus = null;
        $rootScope.$broadcast("serverStopped", id);
      });

    }
    else if (cnf.type == 'remote') {
      global.runningServer = {
        'id': cnf.id,
        'process': null,
        'config': cnf,
        'url': cnf.url
      };
    }

    //only broadcast after runningServer is set
    $rootScope.$broadcast("serverStarting", id, global.runningServer);

  }
  
  //Stop the ipython server with the given internal id.
  function stop(id) {
    if (id === undefined) {
      id = serverConfig.defaultServerId();
    }
    global.serverStatus = 'stopping';
    if(runningServer() !== null) {        
      if (runningServer().process !== undefined && runningServer().process.kill !== undefined) {
        runningServer().process.kill();
      }
              
      global.runningServer = null;
      global.connected = false;
      //TODO: correctly handle remote case
      $rootScope.$broadcast("serverStopping", id);
      log(serverConfig.get(id).id + ' has been shut down');
    }

  }

  function isRunning() {
    return global.runningServer === null ? false : true;
  }


  return {
    running: runningServer,
    connectLocal: connect,
    start: start,
    stop: stop,
    isRunning: isRunning,
  };
});
