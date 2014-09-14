/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
//GOAL: easy set up, simple config
//GOAL: run without terminal faffing
//GOAL: clean UI without excess junk
//GOAL: customise keyboard since we don't conflict with browser shortcuts

//TODO: store id of server associated with window
//TODO:store refcount of windows connected to given server (poss close server if all windows shut)
//TODO: allow deleting servers
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
//TODO: add ipython console panel to see stderr output from ipython
var _ = require('underscore');
var gui = require('nw.gui');
var shell = require('nw.gui').Shell;
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var shortId = require('shortid');
var nwWin = gui.Window.get();
require('shelljs/global');

console.log(which);
$ = angular.element; //so we don't need jquery
global.runningServer = null;
// bit awkward, want to track if the server is starting up or
// shutting down and act differently while waiting for that to finish
global.serverStatus = null;
global.gui = gui;

console.log(process.mainModule);

process.mainModule.init();

var ipythonHandler = process.mainModule
/* App Module */
angular.module('ipython', ['ngRoute', 'mgcrea.ngStrap'])
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
      })
  //.service('nwService', ['$rootScope', '$timeout', NodeWebkitService])
  .service('nwService',NodeWebkitService)
  //.factory('serverConfig', ServerConfigService)
  //.factory('ipythonProc', ['$rootScope', 'serverConfig', IpythonProcService])
.factory('Page', PageService)
 ;
 /*
 * Set the page title, doesn't need to do anything part from inject the Page service
 * @param {[type]} $scope [description]
 * @param {[type]} Page   [description]
 */
function TitleCtrl($scope, Page) {
  $scope.$on("serverReady", function(id) {
    //console.log(id);
  });
}

function PageService() {
   var title = 'IPython';
   return {
     title: function() { return title; },
     setTitle: function(newTitle) { 
        title = newTitle;
        document.title = title;
      }
   };
}     
//  "node-remote": ["<local>","127.0.0.1","127.0.0.1:9000"],

// helper functions
function log(message) {
  var logTemplate = _.template('<tr><td><%=time %></td><td><%=msg %></td></tr>');

  var date = new Date();
  var time = date.toLocaleTimeString();
  $("#log").append(logTemplate({'time': time, msg: JSON.stringify(message)}));
  console.log(message);
}


//------
//Main UI page!
function StartPage($scope, $timeout, $location, nwService, Page) {
  $scope.isRunning = ipythonHandler.isRunning(ipythonHandler.defaultServerId());
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
    $('#ipython-frame').attr('src', ipythonHandler.runningServer(ipythonHandler.defaultServerId()).url);
    $scope.isRunning = ipythonProc.isRunning();
    $scope.isWaiting = true;

    $scope.$apply();
    //try to update the iframe as long as the server is running but the document is not loaded
    if ($scope.isRunning && ipythonHandler.runningServer(ipythonHandler.defaultServerId()).type === 'local' && $('#ipython-main-app', frames['ipython-frame'].document).length === 0){
      $timeout(updateUrl, 200);
    } else {
      $scope.isWaiting = false;
    }
  }

  //register callbacks
  $scope.$on("serverStarting", function(id) {
    var title = "IPython Notebook";
    if (ipythonHandler.runningServer(ipythonHandler.defaultServerId()).ipyProfile) {
      title += " - " + ipythonHandler.runningServer(ipythonHandler.defaultServerId()).ipyProfile;
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
  if (ipythonHandler.autoStart()) {
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
function EditIpythonConfig($scope, nwService, Page) {
  Page.setTitle("IPython Desktop preferences");
  $scope.configurations = ipythonHandler.servers();
  $scope.autoStart = ipythonHandler.autoStart();
  $scope.defaultServer = ipythonHandler.defaultServerId();

  $scope.save = function (){
    ipythonHandler.all($scope.configurations);
    ipythonHandler.autoStart($scope.autoStart);
    window.location.hash = '/';
  };

  $scope.resetConf = function (){
    ipythonHandler.reset();
    $scope.conf = _.extend({}, ipythonHandler.get('defaultSrv'));
  };

  $scope.addServer = function (){
    //extend configurations with new default config
    ipythonHandler.newServer(function(conf) {
      $scope.configurations.push(conf);
      console.log($scope.configurations);
      $scope.$apply();
    });
  };

  $scope.deleteServer = function (id){

  };

  $scope.setAsDefault = function(id){
      $scope.defaultServer = ipythonHandler.defaultServerId(id);
      $scope.configurations = ipythonHandler.servers();
  };
}



//FIXME this is a mess, use nice way to create object where we can refer to own methods
function NodeWebkitService($rootScope)  {

    // Expose gui and main window
    var gui = this.gui = require("nw.gui");
    var nwWin = this.nwWin = gui.Window.get();

    nwWin.on('close', function() {
      //TODO: confirm before exit
      //TODO: not sure what happens with multiple nwWins. might need to check if we are closing main nwWin only
      console.log('Closing down');
      ipythonHandler.cleanUp();
      nwWin.close(true); //have to explicitly close!
    });

    this.openWindow = gui.Window.open; // shourtcut to open new window
    //TODO: connect function belongs in UI part no background/universal tasks, since you want to connect a window to a process
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

    var srv_json_path = path.join(ipyServer.conf.ipythonConfDir, "security", "nbserver-" + ipyServer.pid + ".json");

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
          //Set the server's url based on info parsed from iPy's info file
          ipyServer.url = srv_info.url;

          log(ipyServer.id + ' has been started at:' + ipyServer.url);
          
          // broadcast ready when we were able to read the server info
          $rootScope.$broadcast('serverReady', ipyServer.id, ipyServer);
        }
      });
    }
    readSrv();
  }

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
      if (!ipythonHandler.isRunning()) {
        ipythonHandler.start();
      }
      window.location.hash = '/';
    };

    this.stopIpython = function () {
      ipythonHandler.stop();
      window.location.hash = '/';
      console.log('stopping');
    };

    this.connect = function () {
      connect(ipythonHandler.runningServer(ipythonHandler.defaultServerId()));
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
                  $('#ipython-frame').attr('src', ipythonHandler.runningServer(ipythonHandler.defaultServerId()).url);
                }
              }]}
     ]
    };
    
    createMenu(menus);
    
    //Register callbacks for menu button events
    $rootScope.$on("startIpython", this.startIpython);
    $rootScope.$on("stopIpython", this.stopIpython);
    $rootScope.$on("connectLocal", this.connect);

}
