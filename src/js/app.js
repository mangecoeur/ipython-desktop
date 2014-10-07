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
var _ = require('lodash');
var remote = require('remote');
var prefs = remote.require('./ipyd-preferences.js')
var ipc = require('ipc');

$ = angular.element; //so we don't need jquery

/* App Module */
angular.module('ipython', ['ngRoute'])
    .config(
      function($routeProvider, $sceDelegateProvider) {
        $routeProvider
            .when('/',    {templateUrl: 'tpl/start.tpl.html', controller: StartPage})
            .when('/config',    {templateUrl: 'tpl/edit-servers.tpl.html', controller: EditIpythonConfig})

            .otherwise({redirectTo: '/'});
        
        $sceDelegateProvider.resourceUrlWhitelist([
             // Allow same origin resource loads.
             'self',
             // Allow loading from our assets domain.  Notice the difference between * and **.
             'http://127.0.0.1**'
        ]);
      })
  .service('ipyServers', IpyServerService)
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
function StartPage($scope, $timeout, Page, $rootScope, ipyServers) {
  $scope.startIpython = function() {
    ipyServers.startIpython();
  }
  
  $scope.stopIpython = function() {
    ipyServers.stopIpython();
  };

  $scope.status = 'stopped';

  function mangleIPythonUI() {
    $("#notebook_list div div a").click(function(){ 
      $(this).attr('href')
      var BrowserWindow = remote.require('browser-window');
      var win = new BrowserWindow({ width: 800, height: 600});
      win.loadUrl($(this).attr('href'));
     });
  }


  //reload the ipython page until it is ready
  //expect status = 'waiting'
  //TODO: dont like the way status is changed in a bunch of places...
  function refreshServerView(server) {
    $timeout(updateUrl, 200);
    function updateUrl(){
      $('#ipython-frame').attr('src', server.url);

      $scope.$apply();
      //try to update the iframe as long as the server is running but the document is not loaded
      if (server.type === 'local' && $('#ipython-frame', frames['ipython-frame'].document).length === 0){
        $timeout(updateUrl, 500);
      } else {
        $scope.status = 'running';

        mangleIPythonUI()
      }
    }
  }

  $scope.$on("serverStarting", function(evt, id) {
    $scope.status = 'waiting';
    Page.setTitle("IPython");
  });

  //register callbacks
  ipc.on('server-started', function(srv) {
    var title = "IPython Notebook";
    if (!_.isEmpty(srv.conf.ipyProfile)) {
      title += " - " + srv.conf.ipyProfile.ipyProfile;
    }
    Page.setTitle(title);

    // var BrowserWindow = remote.require('browser-window');
    // var win = new BrowserWindow({ width: 800, height: 600});
    // win.loadUrl(srv.url);
    // win.on('did-finish-load', function(){
    //   win.webContents.executeJavaScript("console.log('yo')")
    // });

    refreshServerView(srv);
  });

  ipc.on('server-stopped', function(code) {
    $scope.status = 'stopped';
    Page.setTitle("IPython");
    $scope.$apply();
  });


  $scope.$on("serverStopping", function(evt, id) {
    $scope.status = 'waiting';
    $('#ipython-frame').attr('src', 'about:blank');
    var frame = document.getElementById("ipython-frame"),
    frameDoc = frame.contentDocument || frame.contentWindow.document;
    frameDoc.removeChild(frameDoc.documentElement);
    $scope.$apply();
  });



  //Start the server if autostart is enabled
  if (prefs.autoStart()) {
  }

  if ($scope.status == 'running' && $('#ipython-main-app', frames['ipython-frame'].document).length === 0) {
    refreshServerView(prefs.defaultId());
  }
}

/**
 * Edit the Ipython config. For now, can only change the single default
 * Ipython server config. In the future, can add multiple configurations
 */
function EditIpythonConfig($scope, Page) {
  Page.setTitle("IPython Desktop preferences");
  $scope.configurations = prefs.servers();
  $scope.autoStart = prefs.autoStart();
  $scope.defaultServer = prefs.defaultId();

  $scope.save = function (){
    //set server to the value of the configurations
    prefs.servers($scope.configurations);
    prefs.autoStart($scope.autoStart);
    window.location.hash = '/';
  };

  $scope.resetConf = function (){
    prefs.reset();
    $scope.configurations = MYPYTHON.servers();

  };

  $scope.addServer = function (){
    var conf = prefs.newServer() 
    $scope.configurations.push(conf);
    prefs.servers($scope.configurations);
    console.log($scope.configurations);
    
  };

  $scope.deleteServer = function (id){
    prefs.deleteServer(id, function(id){
      console.log(id);
      $scope.configurations = prefs.servers();
    });
  };

  $scope.setAsDefault = function(id){
      $scope.defaultServer = prefs.defaultId(id);
      $scope.configurations = prefs.servers();
  };
}


// Service wrapper for mostly server related stuff in main.js
function IpyServerService($rootScope) {
  this.startIpython = function (serverId) {
    if (serverId === undefined) {
      serverId = prefs.defaultId();
    }

    $rootScope.$broadcast("serverStarting", serverId);

    ipc.send('server.start', serverId);
    window.location.hash = '/';
  };

  this.stopIpython = function (serverId) {
    if (serverId === undefined) {
      serverId = prefs.defaultId();
    }

    $rootScope.$broadcast("serverStopping", serverId);

    ipc.send('server.stop', serverId);

    window.location.hash = '/';
  };


}