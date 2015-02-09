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
var _ = require('underscore-plus');

//Atom-shell modules
var remote = require('remote');
var ipc = require('ipc');

//Homemade modules
var prefs = remote.require('../ipyd-preferences.js');

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

//------
//Main UI page!
function StartPage($scope, Page, $rootScope, $modal, ipyServers) {

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

  nbServerView = document.getElementById('ipython-frame'); //Webview that will hold the server

  $scope.connectToIPython = function(srv) {
    nbServerView.setAttribute('src', srv.url);
  };

  $scope.reloadIPython = function () {
    nbServerView.reload();
  };



  //-----------------------------
  // register DOM event listeners
  //-----------------------------
  var notebookTabs = [];

  //Atom-shell tends to crash if you dont clean up web views
  function cleanupWebviews(){
    nbServerView.setAttribute('src', 'about:blank');

    for (var i=0; i<notebookTabs.length; i++) {
      var v = notebookTabs[i];
      v.tab.remove();
      v.tabPane.remove();
    }
    notebookTabs = [];
  }

  window.onbeforeunload = function(e){
    cleanupWebviews();
    return true;
  }


  /**
   * setup the server webviews. Uses jquery directly to avoid messy interactions
   * with angularjs magic
   * @param url
   */
  function setupServerView(url){
    nbServerView = document.getElementById('ipython-frame');
    nbServerView.setAttribute('src', url);
    
    // nbServerView.addEventListener('new-window', function(e) {
    //   //notebookView.setAttribute('src', e.url);
    //   //ipc.send('notebook.new.window', e.url);
    //   if (e.url.indexOf(".ipynb") >= 0) {
    //     var parts = e.url.split('notebooks/');
    //     var title = parts[1];

    //     if (!_.findWhere(notebookTabs, {'title': title})) {

    //       //TODO:maybe create new windows? -> send IPC to have main.js create+manage?
    //       //TODO: use templating to make this simpler
    //       var nbView = document.createElement('webview');
    //       nbView.setAttribute('nodeintegration', '');
    //       nbView.setAttribute('src', e.url);
    //       nbView.setAttribute('preload', 'preload.js');
    //       nbView.setAttribute('id', 'ipynb-' + title);

    //       //use raw dom because errors with jquery...
    //       nbView.addEventListener('new-window', function(ev) {
    //           require('shell').openExternal(ev.url);
    //       });


    //       //var tpl = _.template('<div role="tabpanel" aria-labelledby="ipynb-<%=title>" id="ipynb-<%=title>" class="tab-pane"></div>')
    //       //tpl({'title': title})
    //       var nbTabPane = $('<div>')
    //           .attr('id', 'tab-ipynb-' + title)
    //           .attr('role', 'tabpanel')
    //           .addClass('tab-pane')
    //           .addClass('')
    //           .attr('aria-labelledby', 'tab-ipynb-' + title)
    //           .append($(nbView));

    //       var nbTab = $('<li>')
    //               .attr('role', 'presentation')
    //               .append($('<a>')
    //                   .attr('role', 'tab')
    //                   .attr('data-toggle', 'tab')
    //                   .attr('href', '#' + 'tab-ipynb-' + title)
    //                   .attr('aria-controls', 'tab-ipynb-' + title)
    //                   .text(title)
    //       );

    //       notebookTabs.push({'tab': nbTab, tabPane: nbTabPane, title:title, url: e.url});

    //       $('#nb-tab-content').append(nbTabPane);
    //       var tabList = $('#nb-tab-list');
    //       tabList.append(nbTab);

    //       //(Re)Register handler for the tab change
    //       tabList.find('a').click(function (e) {
    //         e.preventDefault();
    //         $(this).tab('show');
    //         var id = $(this).attr('aria-controls');
    //         $('#nb-tab-content').find('.tab-pane').removeClass('active');
    //         $(document.getElementById(id)).addClass('active');
    //         document.title = $(this).text();
    //       });

    //       $scope.$apply();
    //     }
    //   }
    // });
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
    //window.location.hash = '/';
  };

  this.stopIPython = function (serverId) {
    if (serverId === undefined) {
      serverId = prefs.defaultId();
    }

    $rootScope.$broadcast("serverStopping", serverId);

    ipc.send('server.stop', serverId);

    //window.location.hash = '/';
  };

  this.serverStatus = function(serverId) {
    ipc.send('server.status');
  };

  //this.connectToServer = function(serverId) {
  //
  //}
}