/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */



var _ = require('underscore');
var gui = require('nw.gui');
var shell = require('nw.gui').Shell;
var child_process = require('child_process');
var shortId = require('shortid');
//var angular = require('angular');
var nwWin = gui.Window.get();

global.$ = $ = angular.element;
global.ipythonProcesses = [];
global.runningServer = false;


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
  $scope.isRunning = global.runningServer === false ? false : true;

  $scope.startIpython = nwService.startIpython;
  $scope.stopIpython = nwService.stopIpython;

  //reload the ipython page until it is ready
  function updateUrl(){ 
    $('#ipython-frame').attr('src', global.runningServer.url);
    $scope.isRunning = true;
    $scope.$apply();
    if ($('#ipython-main-app', frames['ipython-frame'].document).length === 0){
      $timeout(updateUrl, 200);
    }
  }

  //register callbacks
  $scope.$on("serverStarted", function(id) {
    Page.setTitle(global.runningServer.name);
    var timeout = $timeout(updateUrl, 200);

  });

  $scope.$on("serverStopped", function(id) {
    Page.setTitle("IPython");
    $scope.isRunning = false;
    $scope.$apply();
  });

  //Start the server if autostart is enabled
  if (serverConfig.autoStart()) {nwService.startIpython();}

  if ($scope.isRunning && $('#ipython-main-app', frames['ipython-frame'].document).length === 0) {
    var timeout = $timeout(updateUrl, 200);

  }


}

/**
 * Edit the Ipython config. For now, can only change the single default
 * Ipython server config. In the future, can add multiple configurations
 */
function EditIpythonConfig($scope, serverConfig, nwService) {
  $scope.id = 'default';
  $scope.conf = _.extend({}, serverConfig.get('default')); // Make a simple clone
  $scope.autoStart = serverConfig.autoStart();

  $scope.save = function (){
    serverConfig.set($scope.id, $scope.conf);
    serverConfig.autoStart($scope.autoStart);
    //gui.Window.get().close();
    window.location.hash = '/';

  };
 /*
 
  //All this stuff from initial multi server support. might reenable later
  $scope.servers = serverConfig.all();

  $scope.handleEdit = function (el){
    var parent = $(el).closest('div.edit_modal');
    var form = $(parent).find('form');
    var id = $(form).data('uid');

    var data = {};
    _.each($(form).serializeArray(), function(field) {
        data[field.name] = field.value;
    });

    serverConfig.set(id, data);
  };*/
}

function EditVirtualEnvs($scope) {

}

/**
 * Set the page title, doesn't need to do anything part from inject the Page service
 * @param {[type]} $scope [description]
 * @param {[type]} Page   [description]
 */
function TitleCtrl($scope, Page) {
  $scope.$on("serverStarted", function(id) {
    console.log(id);
  });
}


app.factory('Page', function() {
   var title = 'IPython';
   return {
     title: function() { return title; },
     setTitle: function(newTitle) { title = newTitle;
      document.title = title;
    }
   };
});

/**
 * Node webkit utilities service
 */
app.service('nwService', 
  function($rootScope, $q, $timeout, ipythonProc, serverConfig, Page)  {

    // Expose gui and main window
    var gui = this.gui = require("nw.gui");
    var nwWin = this.nwWin = gui.Window.get();
    
    nwWin.on('close', function() {
      //TODO: confirm before exit
      //TODO: not sure what happens with multiple nwWins. might need to check if we are closing main nwWin only
      console.log('Closing down');
      ipythonProc.stop(global.runningServer.id);
      nwWin.close(true); //have to explicitly close!
    });

    var createMenu = this.createMenu = function (menuStructure) {

        // Create the top menu
        var menu = new gui.Menu(menuStructure);

        // Create sub-menu items if they're provided
        if(menuStructure && menuStructure.items) {

            console.log("Creating %d menu items for menu", menuStructure.items.length);
            this.createMenuItems(menu, menuStructure.items);
        }

        if(menu.type === 'menubar') {
            nwWin.menu = menu;
        }

        return menu;
    };

    var createMenuItems = this.createMenuItems = function (menu, items) {

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
    };

  this.startIpython = function () {
    if (global.runningServer === false) {
      var serverId = serverConfig.defaultServerId();
      ipythonProc.start(serverId);
    }

    window.location.hash = '/';

  };

  this.stopIpython = function () {
    var serverId = serverConfig.defaultServerId();
    ipythonProc.stop(serverId);
    window.location.hash = '/';

    console.log('stopping');
  };


  //TODO conditionall enable/disable menus
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
                  $('#ipython-frame').attr('src', global.runningServer.url);
                }
              }]}

     ]
    };

    var myMenu = this.createMenu(menus);
    

    $rootScope.$on("startIpython", this.startIpython);
    $rootScope.$on("stopIpython", this.stopIpython);

    this.openWindow = gui.Window.open;

    /**
     * Open the standard file dialog.
     *
     * @param cfg
     */
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
});


app.factory('serverConfig', function() {
  /**
   * Put some dummy data as a string into localstorage
   */
    
  function storedConfigs() {
    return JSON.parse(localStorage.servers);
  }

  function init() {
    if (localStorage.servers === undefined) {
      localStorage.servers = JSON.stringify({});
    }
    if (localStorage.servers.default === undefined) {
      var dummy = {
        'default': {
                'name': 'IPython Default',
                'port': '8888',
                'command': 'ipython notebook --no-browser',
                'virtualenv': null,
                'type': 'local',

                }
        };
        localStorage.servers = JSON.stringify(dummy);
        localStorage.defaultServer = 'default';
        localStorage.autoStart = false;
      }
    }

  init();
  
  var serverList = storedConfigs();

  return {
    local: _.where(serverList, {type: 'local'}),
    remote: _.where(serverList, {type: 'remote'}),
    all: function() { return serverList; },
    get: function(id) {
      return serverList[id];
    },
    set: function(id, config) {
      serverList[id] = config;
      localStorage.servers = JSON.stringify(serverList);
      serverList = storedConfigs();
    },
    save: function() {
      localStorage.servers = JSON.stringify(serverList);
      serverList = storedConfigs();
    },
    defaultServerId: function(){ return localStorage.defaultServer; },
    autoStart: function(value) {
      if (value !== undefined) {
        localStorage.autoStart = value;
      } else {
        return JSON.parse(localStorage.autoStart);
      }

    }
  };

});


app.factory('ipythonProc', function($rootScope, serverConfig)  {
  return {
    self: this,
    list: global.ipythonProcesses,
    running: global.runningServer,
    start: function (id) {
      var cnf = serverConfig.get(id); //ipython config
      console.log(id);

      if (cnf.type == 'local') {
        //todo make sure port and command dont conflict, probably by defining command list instead of str
        var ipython = child_process.exec(cnf.command);
        ipython.stdout.on('data', function (data) {
           log(data.toString());
         });

        global.ipythonProcesses[id] = ipython;
        cnf.id=id;
        cnf.url =  "http://127.0.0.1:" + cnf.port;
        global.runningServer = cnf;

        log(cnf.name + ' has been started on port:' + cnf.port);

      } else if (cnf.type == 'remote') {
        global.ipythonProcesses[id] = cnf;
        cnf.id=id;
        global.runningServer = cnf;
      }

      $rootScope.$broadcast("serverStarted", id, cnf);
      
    },

    stop: function (id) {
      var proc = global.ipythonProcesses[id];
      if( proc !== undefined) {
        if (proc.kill !== undefined) {proc.kill();}
        delete global.ipythonProcesses[id];
        
        if (global.runningServer.type == 'local') {
          global.runningServer.url = null;
        }
        global.runningServer = false;

        log(serverConfig.get(id).name + ' has been shut down');
        
        $rootScope.$broadcast("serverStopped", id);
   
      }

    },

    stopAll: function() {
      _.each(global.ipythonProcesses, function (proc, id) {
        if (proc.kill !== undefined) {proc.kill();} // only kill subprocesses, do nothing for remotes.
        console.log("shutdown " + id);
      });
      //global.ipythonProcesses = [];
      console.log("All processes have been shutdown");
    }


          //TODO: for now, just define the command, so e.g. for venv use just prepend the right path
      //later can make this nicer
      /*
      var argarry = ['notebook', '--no-browser'];
      
      function pushIfValid(ojb, argname, list){
        if (ojb[argname] !== undefined && ojb[argname] !== null && ojb[argname] !== '' ) {
          argarry.push('--' + argname);
          argarry.push(ojb[argname]);
        }
        return argarry;
      }

      //TODO enable support for all ipython cmd options
      pushIfValid(cnf, 'profile', argarry);
      pushIfValid(cnf, 'port', argarry);
      
      var ipython = child_process.spawn('ipython', argarry);
      */
  };
});
