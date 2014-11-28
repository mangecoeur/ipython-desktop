/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
//GOAL: easy set up, simple config
//GOAL: run without terminal faffing
//GOAL: clean UI without excess junk
//GOAL: customise keyboard since we don't conflict with browser shortcuts

//TODO: Pretty list running servers and add Connect button
//TODO: store id of server associated with window
//TODO: store refcount of windows connected to given server (poss close server if all windows shut)
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

//Third party modules
var _ = require('lodash');

//Atom-shell modules
var remote = require('remote');
var BrowserWindow = remote.require('browser-window');
var ipc = require('ipc');

//Homemade modules
var prefs = remote.require('./ipyd-preferences.js');


$ = angular.element; //so we don't need jquery


//server status for this window
var server = {};

//Global ref to webview, hope it doesn't get GCed
var nbServerView = null;


/* App Module */
angular.module('ipython', ['ui.bootstrap'])
    .config(
      function($sceDelegateProvider) {
        $sceDelegateProvider.resourceUrlWhitelist([
             // Allow same origin resource loads.
             'self',
             // Allow loading from our assets domain.  Notice the difference between * and **.
             'http://127.0.0.1**',
            'http://localhost**'
        ]);
      })
    .service('ipyServers', IpyServerService)
    .factory('Page', PageService)
    .controller('StartPage', StartPage)
    .controller('EditIpythonConfig', EditIpythonConfig);


 /*
 * Set the page title, doesn't need to do anything part from inject the Page service
 * @param {[type]} $scope [description]
 * @param {[type]} Page   [description]
 */
function TitleCtrl($scope, Page) {
  $scope.$on("serverReady", function(id) {
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
function StartPage($scope, $timeout, Page, $rootScope, $modal, ipyServers) {

  //the NB server for this view
  $scope.server = server;

  $scope.startIPython = function() {
    ipyServers.startIpython();
  };
  
  $scope.stopIPython = function() {
    ipyServers.stopIPython();
  };


  $scope.requestStatus = function () {
    ipyServers.serverStatus();
  };

  $scope.server.status = 'waiting';

  $scope.requestStatus();

  //FIXME: hack because with angular it's hard to figure out when things are loaded
  //TODO: maybe move away from angular magic to simpler jquery-only UI
  $scope.fixWebView = function(){
    document.getElementById('ipython-server-tab').appendChild(document.getElementById('ipython-frame'))
    //$('#ipython-server-tab').append($('#stupid-container'));
  };

  nbServerView = document.getElementById('ipython-frame'); //Webview that will hold the server
  //var notebookView = document.getElementById('ipython-notebook-frame');

  $scope.connectToIPython = function(srv) {
    nbServerView.setAttribute('src', srv.url);
  };

  $scope.reloadIPython = function () {
    nbServerView.reload();
  };



  //-----------------------------
  // register DOM event listeners
  //-----------------------------
  var nbWebViews = $scope.nbWebViews = {};
  var notebookTabs = $scope.notebookTabs = [];

  //Atom-shell tends to crash if you dont clean up web views
  function cleanupWebviews(){
    nbServerView.setAttribute('src', 'about:blank');
    for (var i in notebookTabs) {
      var tab = notebookTabs[i];
      console.log(tab);

      var nbView = document.getElementById('ipynb-' + tab.title)
      nbView.parentNode.removeChild(nbView);
    }
    for(var view in nbWebViews){
      view = null;
    }
    nbWebViews = $scope.nbWebViews = {};
    notebookTabs = $scope.notebookTabs = [];
  }

  window.onbeforeunload = function(e){
    cleanupWebviews();
    return true;
  }

  var notebookTabsJquery = [];

  function setupServerView(url){
    nbServerView = document.getElementById('ipython-frame');
    nbServerView.setAttribute('src', url);
    nbServerView.addEventListener('new-window', function(e) {
      //notebookView.setAttribute('src', e.url);
      //ipc.send('notebook.new.window', e.url);
      if (e.url.indexOf(".ipynb") >= 0) {
        var parts = e.url.split('notebooks/');
        var title = parts[1];

        if (!nbWebViews[title]) {

          var nbView = $('<webview>').attr('src', e.url);
          nbView.on('new-window', function(e) {
              require('shell').openExternal(e.url);
          });

          var nbTabPane = $('<div>')
              .attr('id', 'ipynb-' + title)
              .attr('role', 'tabpanel')
              .addClass('tab-pane')
              .addClass('')
              .attr('aria-labelledby', 'ipynb-' + title)
              .append(nbView);

          var nbTab = $('<li>')
                  .attr('role', 'presentation')
                  .append($('<a>')
                      .attr('role', 'tab')
                      .attr('data-toggle', 'tab')
                      .attr('href', '#' + 'ipynb-' + title)
                      .attr('aria-controls', 'ipynb-' + title)
                      .text(title)
          );

          notebookTabsJquery.push({tab: nbTab, tabPane: nbTabPane, title:title});

          $('#nb-tab-content').append(nbTabPane),
          $('#nb-tab-list').append(nbTab);

          $('#nb-tab-list').find('a').click(function (e) {
            e.preventDefault();
            $(this).tab('show');
            var id = $(this).attr('aria-controls');
            $('#nb-tab-content').find('.tab-pane').removeClass('active');
            $(document.getElementById(id)).addClass('active');

          });



          //store these, hope to prevent them being GCed if hidden
          notebookTabs.push({title: title, url: e.url, active: true});
          $scope.$apply();

          var nbView2 = document.getElementById('ipynb-' + title)
          nbView2.addEventListener('new-window', function(e) {
              require('shell').openExternal(e.url);
          });

          nbWebViews[title] = nbView2;
        }
      }
    });
  }
  //-----------------------
// register ipc event listeners
//-----------------------
//TODO: Server started should only get called once, but JS refuses to comply!
ipc.on('server.started', function(srv) {
  server.title = "IPython Notebook";
  if (!_.isEmpty(srv.conf.ipyProfile)) {
    server.title += " - " + srv.conf.ipyProfile.ipyProfile;
  }

  Page.setTitle(server.title);

  setupServerView(srv.url);
  server.status = 'started';
  $scope.$apply();

});

ipc.on('server.stopped', function(serverId) {
  $scope.server.status = 'stopped';
  Page.setTitle("IPython");
  cleanupWebviews();
  $scope.$apply();
});


ipc.on('server.status', function(srvlist) {
  var servers = srvlist;
  if (srvlist.length > 0) {
    server.status = 'started';
    //TODO: assumes only 1 server running. Could be relaxed.
    if ($('#ipython-frame').attr('src') != srvlist[0].url) {
        setupServerView(srvlist[0].url);
    }

  } else {
    server.status = 'stopped';
  }
});


  //-----------------------
  // register angular event listeners
  //-----------------------

  $rootScope.$on("serverStarting", function(evt, id) {
    $scope.server.status = 'waiting';
    Page.setTitle("IPython");
  });

  $rootScope.$on("serverStopping", function(evt, id) {
    $scope.server.status = 'waiting';
    nbServerView.setAttribute('src', 'about:blank');
    $scope.$apply();
  });



  //Start the server if autostart is enabled
  if (prefs.autoStart()) {
  }


  $scope.configure = function () {

    var modalInstance = $modal.open({
      templateUrl: 'tpl/edit-servers-modal.tpl.html',
      controller: 'EditIpythonConfig',
      size: 'lg',
      resolve: {
        items: function () {
          return $scope.items;
        }
      }
    });

    modalInstance.result.then(function (selectedItem) {
      $scope.selected = selectedItem;
    }, function () {
      //$log.info('Modal dismissed at: ' + new Date());
    });
  };
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
    var conf = prefs.newServer() ;
    $scope.configurations.push(conf);
    prefs.servers($scope.configurations);
    
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

  this.stopIPython = function (serverId) {
    if (serverId === undefined) {
      serverId = prefs.defaultId();
    }

    $rootScope.$broadcast("serverStopping", serverId);

    ipc.send('server.stop', serverId);

    window.location.hash = '/';
  };

  this.serverStatus = function(serverId) {
    ipc.send('server.status');
  };

  //this.connectToServer = function(serverId) {
  //
  //}
}