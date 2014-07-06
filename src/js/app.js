/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
//Support multiple config profiles (even if you can only run one of them)
//TODO: create custom.js for ipython profile to interact with node-webkit 
//TODO: save config as human readable file in .ipython-desktop folder or something similar
// - idea: ipython desktop picks up available ipthons from configs in its folder, offers you a list of options
// that way, ipython or an ipython bundle could write itself in when it installs, creating a friendly way to pick
// up confs.
// - idea: alt/extension - use the ipython profile mechanism to get conf.
//TODO: save list of running processes as a file, so that when you restart you can pick them up again
//TODO: provide fault feedback, if any part of server launch fails, cancel whatever's been done and display message
var _ = require('underscore');
var gui = require('nw.gui');
var shell = require('nw.gui').Shell;
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var shortId = require('shortid');
var nwWin = gui.Window.get();

global.$ = $ = angular.element;
global.runningServer = null;
// bit awkward, want to track if the server is starting up or
// shutting down and act differently while waiting for that to finish
global.serverStatus = null;


/* App Module */
var app = angular.module('ipython', ['ngRoute', 'mgcrea.ngStrap'])
    .config(
      function($routeProvider, $locationProvider, $sceDelegateProvider) {
        //$locationProvider.html5Mode(true);
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
    Page.setTitle(ipythonProc.running().name);
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
function EditIpythonConfig($scope, serverConfig, nwService) {
  $scope.id = 'defaultSrv';
  $scope.conf = _.extend({}, serverConfig.get('defaultSrv')); // Make a simple clone
  $scope.autoStart = serverConfig.autoStart();

  $scope.save = function (){
    serverConfig.set($scope.id, $scope.conf);
    serverConfig.autoStart($scope.autoStart);
    //gui.Window.get().close();
    window.location.hash = '/';
  };

  $scope.resetConf = function (){
    serverConfig.reset();
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
    
    this.openWindow = gui.Window.open;

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
  
  //TODO - use user folder to save config file instead of localstorage
  function saveServerConf(confObject){
    localStorage.servers = JSON.stringify(confObject);
  }

  function serverConf() {
    return JSON.parse(localStorage.servers);
  }

  //Try to figure out the default IPython using "which" - FIXME - NO WINDOWS SUPPORT
  //calls fn handleExecName(path of ipython bin) when found
  function detectDefaultIpython(handleExecName){
    child_process.exec("which ipython", function(out, stout, sterr) {
      var ipython_bin = stout.trim().replace(/[\r\n]/g, "");
      handleExecName(ipython_bin);
    });
  }

  function resetDefaultConf(){
    detectDefaultIpython(function(ipython_bin_loc){
      var defaultConf = {
        'defaultSrv': {
                'name': 'IPython Default',
                'ipython': ipython_bin_loc,
                'type': 'local',
                }
        };
        saveServerConf(defaultConf);

        //TODO: decide where best to save these
        localStorage.defaultServer = 'defaultSrv';
        localStorage.autoStart = false;
      });  
  }

  function initConf() {
    if (localStorage.servers === undefined) {
      saveServerConf({});
    }
    if (localStorage.defaultServer === undefined) {
      resetDefaultConf();
    }
  }

  //initialize the config on startup (when serverConfig factory is first required)
  initConf();
  
  return {
    local: function() {
      var srv_list = serverConf();
      return _.where(srv_list, {type: 'local'});
    },
    
    remote: function() {
      var srv_list = serverConf();
      return _.where(srv_list, {type: 'remote'});
    },

    all: function() { return serverConf(); },
    
    get: function(id) {
      var cnf = serverConf()[id];
      cnf.id=id;
      return cnf;
    },
    //Set config options
    //TODO: validate options before saving.
    set: function(id, config) {      
      if (config.ipythonProfile) {
        config.ipythonProfile = config.ipythonProfile.trim();        
      }
      if (config.ipythonOpts) {
        config.ipythonOpts = config.ipythonOpts.trim().split(" ");        
      }

      var serverList = serverConf();
      serverList[id] = config;

      saveServerConf(serverList);
    },

    reset: resetDefaultConf,
    
    defaultServerId: function(value){ 
      if (value !== undefined) {
        localStorage.defaultServer = value;
      } else {
        return localStorage.defaultServer;
      }
    },
    
    autoStart: function(value) {
      if (value !== undefined) {
        localStorage.autoStart = value;
      } else {
        return JSON.parse(localStorage.autoStart);
      }
    }
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
    
    if(ipyServer.conf.ipythonProfile){
      cmd_profile = cmd_profile + " " + ipyServer.conf.ipythonProfile;
    }
    
    //set before async call so that it happens immediately  
    global.serverStatus = "serverReady";

    child_process.exec(cmd_profile, function(out, stout, sterr) {
      var profile_dir = stout.trim().replace(/[\r\n]/g, "");
      var pid = runningServer().process.pid;

      var srv_json_path = path.join(profile_dir, "security", "nbserver-" + pid + ".json");

      var srv_info;
      var retryCount = 0;

      function readSrv(){
        fs.readFile(srv_json_path, function(err, data) {
          if (err && retryCount < 10) {
            retryCount += 1;
            setTimeout(readSrv, 200);
          }
          else if(err && retryCount >= 10) {
            throw err; //TODO nice UI to say error in loading profile
          }
          else {
            srv_info = JSON.parse(data);
            ipyServer.url = srv_info.url;

            log(ipyServer.name + ' has been started at:' + ipyServer.url);
            
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

  return {
    running: runningServer,
    connectLocal: connect,
    
    //start an ipython server with the given id, where id is the name of an available ipython config
    start: function (id) {
      if (id === undefined) {
        id = serverConfig.defaultServerId();
      }
      var cnf = serverConfig.get(id);

      if (cnf.type == 'local') {
        //handle ipython command args
        var argList = ['notebook', '--no-browser'];
        
        if (cnf.ipythonProfile && cnf.ipythonProfile !== ""){
          argList.push("--profile=" + cnf.ipythonProfile);
        }

        if (cnf.ipythonOpts) {
          argList = argList.concat(cnf.ipythonOpts);
        }

        var ipython = child_process.spawn(cnf.ipython, argList);
        
        //upgrade this to handle mulit server
        global.runningServer = {
          'id': cnf.id,
          'name': cnf.name,
          'process': ipython,
          'conf': cnf,
          'url': null
        };

        global.serverStatus = "serverStarting";
        //Don't wait for the server to be ready to broadcast that we triggered it to start
        // - that way we can change the UI accordingly straight away
        ipython.stdout.on('data', function (data) {
           log(data.toString());
        });

        //connect to the stderr stream. Use it to know when ipython has actually started.
        ipython.stderr.on('data', function (data) {
          //TODO: could parse some of the messages for start/stop status, could also use to get the URL instead of
          //reading the process json.
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
      $rootScope.$broadcast("serverStarting", id, global.runningServer);

    },

    //Stop the ipython server with the given internal id.
    stop: function (id) {
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
        log(serverConfig.get(id).name + ' has been shut down');
      }

    },

    isRunning: function() {
      return global.runningServer === null ? false : true;
    },
  };
});

//leftover from multi-server support, bring back one day
    // stopAll: function() {
    //   _.each(global.ipythonProcesses, function (proc, id) {
    //     if (proc.kill !== undefined) {proc.kill();} // only kill subprocesses, do nothing for remotes.
    //     console.log("shutdown " + id);
    //   });
    //   console.log("All processes have been shutdown");
    // },

/*
  from seed project, example of how to handle native file dialog, might be handy

    openFileDialog = function(cfg) {
        cfg = cfg || {};
        var result = $q.defer();
        var $dlg = $('#fileDialog');
        if(!$dlg) {
            $dlg = $("body").append('<input style="display:none;" id="fileDialog" type="file" />');
        }

        if(cfg.accept) {
            $dlg.attr('accept', cfg.accept);
        }

        $dlg.one('change', function(evt) {
            result.resolve($(this).val());
            evt.preventDefault();
        });
        $dlg.one('cancel', function(evt) {
            console.log("Cancel was called");
            evt.preventDefault();
            result.resolve(false);
        });
        $dlg.one('close', function(evt) {
            console.log("Close was called");
            evt.preventDefault();
            result.resolve(false);
        });
        $dlg.trigger('click');
        return result.promise;
    };
 */
