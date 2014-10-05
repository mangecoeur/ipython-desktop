/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
//GOAL: easy set up, simple config
//GOAL: run without terminal faffing
//GOAL: clean UI without excess junk
//GOAL: customise keyboard since we don't conflict with browser shortcuts

//TODO: list all running servers on start page with connect button
//TODO: store id of server associated with window
//TODO:store refcount of windows connected to given server (poss close server if all windows shut)
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
//
//
//behaviour - do best to kill all own spawed processes. store pid of spawned servers to file. try to kill on shutdown
//thru process kill, then erase pid from running. but if on startup finds leftover pids, tries to force kill before starting.
var _ = require('underscore');
var gui = require('nw.gui');
// var shell = require('nw.gui').Shell;
var thisWindow = gui.Window.get();

$ = angular.element; //so we don't need jquery
// // bit awkward, want to track if the server is starting up or
// // shutting down and act differently while waiting for that to finish
// global.gui = gui;


//process.mainModule.init();
var MYPYTHON = process.mainModule.exports
MYPYTHON.setConsole(console);
//init();
/* App Module */
angular.module('ipython', ['ngRoute'])
    .config(
      function($routeProvider, $sceDelegateProvider) {
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
  .service('nwService', NodeWebkitService)
  //.factory('serverConfig', ServerConfigService)
  //.factory('ipythonProc', ['$rootScope', 'serverConfig', IpythonProcService])
.factory('Page', PageService);


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
function StartPage($scope, $timeout, nwService, Page, $rootScope) {
  //$scope.isRunning = MYPYTHON.isRunning(MYPYTHON.defaultId());
  $scope.status = 'stopped';

  //reload the ipython page until it is ready
  //
  function refreshServerView(serverId) {
    var srvId = serverId;
    var srv = MYPYTHON.runningServer(srvId)

    $timeout(updateUrl, 200);
    function updateUrl(){
      $('#ipython-frame').attr('src', srv.url);

      $scope.$apply();
      //try to update the iframe as long as the server is running but the document is not loaded
      var isRunning = MYPYTHON.isRunning(srvId)
      if (isRunning && srv.type === 'local' && $('#ipython-frame', frames['ipython-frame'].document).length === 0){
        $timeout(updateUrl, 500);
      } else {
        $scope.status = 'running';
      }
    }
  }


  $scope.startIpython = function() {
    $scope.status = 'waiting';

    nwService.startIpython();
  }
  
  $scope.stopIpython = function() {
    $scope.$apply();
    nwService.stopIpython();
  };

  //register callbacks
  $scope.$on("serverStarting", function(evt, id) {
    var title = "IPython Notebook";
    if (MYPYTHON.runningServer(id).ipyProfile) {
      title += " - " + MYPYTHON.runningServer(id).ipyProfile;
    }
    Page.setTitle(title);
  });

  $scope.$on("serverRunning", function(evt, id, srv) {
    var title = "IPython Notebook";
    if (srv.conf.ipyProfile) {
      title += " - " + srv.conf.ipyProfile.ipyProfile;
    }
    Page.setTitle(title);

    refreshServerView(srv.id);
  });

  $scope.$on("serverStopping", function(evt, id) {
    $('#ipython-frame').attr('src', 'about:blank');

    var frame = document.getElementById("ipython-frame"),
    frameDoc = frame.contentDocument || frame.contentWindow.document;
    frameDoc.removeChild(frameDoc.documentElement);
    $scope.status = 'waiting';
    $scope.$apply();
  });

  $scope.$on("serverStopped", function(evt, id) {
    Page.setTitle("IPython");
    $scope.status = 'stopped';
    $scope.$apply();
  });

  //Start the server if autostart is enabled
  if (MYPYTHON.autoStart()) {
    nwService.startIpython();
  }

  if ($scope.status == 'running' && $('#ipython-main-app', frames['ipython-frame'].document).length === 0) {
    refreshServerView(MYPYTHON.defaultId());
  }
}

/**
 * Edit the Ipython config. For now, can only change the single default
 * Ipython server config. In the future, can add multiple configurations
 */
function EditIpythonConfig($scope, nwService, Page) {
  Page.setTitle("IPython Desktop preferences");
  $scope.configurations = MYPYTHON.servers();
  $scope.autoStart = MYPYTHON.autoStart();
  $scope.defaultServer = MYPYTHON.defaultId();

  $scope.save = function (){
    //set server to the value of the configurations
    MYPYTHON.servers($scope.configurations);
    MYPYTHON.autoStart($scope.autoStart);
    window.location.hash = '/';
  };

  $scope.resetConf = function (){
    MYPYTHON.reset();
    $scope.configurations = MYPYTHON.servers();

  };

  $scope.addServer = function (){
    var conf = MYPYTHON.newServer() 
    $scope.configurations.push(conf);
    MYPYTHON.servers($scope.configurations);
    console.log($scope.configurations);
    
  };

  $scope.deleteServer = function (id){
    MYPYTHON.deleteServer(id, function(id){
      console.log(id);
      $scope.configurations = MYPYTHON.servers();
    });
  };

  $scope.setAsDefault = function(id){
      $scope.defaultServer = MYPYTHON.defaultId(id);
      $scope.configurations = MYPYTHON.servers();
  };
}



//FIXME this is a mess, use nice way to create object where we can refer to own methods
function NodeWebkitService($rootScope)  {

  // Expose gui and main window
  var gui = this.gui = require("nw.gui");
  var thisWindow = this.thisWindow = gui.Window.get();

  thisWindow.on('close', function() {
    //TODO: confirm before exit
    //TODO: not sure what happens with multiple thisWindows. might need to check if we are closing main thisWindow only
    console.log('Closing down');
    MYPYTHON.cleanUp();
    thisWindow.close(true); //have to explicitly close!
  });


  function createMenuItems(menu, items) {

      _.each(items, function(i) {
        //console.log("Creating item", i.label);

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
        //console.log("appending item %s to menu", i.label);
        menu.append(new gui.MenuItem(i));
      });
  }

  function createMenu(menuStructure) {
      // Create the top menu
      var menu = new gui.Menu(menuStructure);

      // Create sub-menu items if they're provided
      if(menuStructure && menuStructure.items) {
          //console.log("Creating %d menu items for menu", menuStructure.items.length);
          createMenuItems(menu, menuStructure.items);
      }

      if(menu.type === 'menubar') {
          thisWindow.menu = menu;
          thisWindow.menu.createMacBuiltin("IPython Desktop");
      }

      return menu;
  }

  this.startIpython = function () {
    var id = MYPYTHON.defaultId();
    thisWindow.serverId = id;
    if (!MYPYTHON.isRunning(id)) {
      MYPYTHON.startServer(id, function(srv) {
        $rootScope.$broadcast("serverRunning", srv.id, srv);
      },
      function (srv) {
        //$rootScope.$broadcast("serverStopped", srv.id);
      });
    }
    window.location.hash = '/';
  };

  this.stopIpython = function (evt) {
    var id = thisWindow.serverId;
    if (id === undefined) {
      id = MYPYTHON.defaultId();
    }
    console.log('stopping');

    $rootScope.$broadcast("serverStopping", id);
    //console.log(MYPYTHON.runningServer(id));
    //MYPYTHON.runningServer(id).process.kill();
    MYPYTHON.stop(id, function(){
       $rootScope.$broadcast("serverStopped", id);
    });
    window.location.hash = '/';
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
     items:[{label: "Refresh Server page",
              click: function(){
                //gui.Window.open('config')
                //window.location.hash = '/config';
                if (MYPYTHON.runningServer(MYPYTHON.defaultId())){
                  $('#ipython-frame').attr('src', MYPYTHON.runningServer(MYPYTHON.defaultId()).url);
                }
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




  // function localServers() {
  //   var srv_list = getServerConf();
  //     return _.where(srv_list, {type: 'local'});
  // }

  // function remoteServers() {
  //   var srv_list = getServerConf();
  //     return _.where(srv_list, {type: 'remote'});
  // }

