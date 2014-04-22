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

global.$ = $ = angular.element;
global.ipythonProcesses = [];
/* App Module */
var app = angular.module('ipython', ['ngRoute', 'mgcrea.ngStrap'])
    .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
        $routeProvider
            .when('/',    {templateUrl: 'start.tpl.html', controller: StartPage})
            .when('/config',    {templateUrl: 'edit-servers.tpl.html', controller: EditIpythonConfig})

            .otherwise({redirectTo: '/config'});
        }]
);




//'use strict';


app.config(function($sceDelegateProvider) {
   $sceDelegateProvider.resourceUrlWhitelist([
       // Allow same origin resource loads.
       'self',
       // Allow loading from our assets domain.  Notice the difference between * and **.
       'http://127.0.0.1**'
  ]);
});

// helper functions
function log(message) {
  var logTemplate = _.template('<tr><td><%=time %></td><td><%=msg %></td></tr>');

  var date = new Date();
  var time = date.toLocaleTimeString();
  $("#log").append(logTemplate({'time': time, msg: JSON.stringify(message)}));
  console.log(message);
}

function getLocalstorage(name, arg1) {
  if (arg1 === undefined) {
    if (localStorage[name] !== undefined) {
      return JSON.parse(localStorage[name]);
    } else {
      return {};
    } 
  }
  else if(arg1 !== undefined){
    return getLocalstorage(name)[arg1];
  }
}

function setLocalstorage(name, arg1, arg2) {
  if (_.isObject(arg1) && arg2 === undefined) {
    localStorage[name] = JSON.stringify(arg1);
  }
  else {
      var currentData = getLocalstorage(name);
      currentData[arg1] = arg2;
      localStorage[name] = JSON.stringify(currentData);
  }
}

/**
 * Put some dummy data as a string into localstorage
 */
function dummyData() {
  localStorage.clear();
  //var remotes = {};
  setLocalstorage('remoteServers', 'aabbccddee', {
              'name': 'Python3 Fake remote server',
              'url': 'http://127.0.0.1:8888'
              });

  setLocalstorage('localServers', 'default', {
              'name': 'IPython Default',
              'port': '8888',
              'command': 'ipython notebook --no-browser',
              'virtualenv': null
              });
  
  localStorage.autoStart = 'default';
}

function StartPage($scope, $timeout, serverConfig, ipythonProc, nwService, Page) {
  $scope.conf = {running: false};
  var serverId = localStorage.autoStart;

  $scope.startIpython = function () {
    ipythonProc.start(serverId);
    $scope.conf = serverConfig.local.get(serverId);
    $scope.conf.running = true;
    Page.setTitle($scope.conf.name);
    $timeout(function(){
      //nwService.openWindow("http://127.0.0.1:" + $scope.conf.port);
      $scope.serverUrl = "http://127.0.0.1:" + $scope.conf.port;
    }, 400);
  };

  $scope.stopIpython = function () {
    ipythonProc.stop(serverId);
    $scope.conf.running = false;
    $scope.serverUrl = "";
    Page.setTitle("IPython");
    $timeout(function(){
      $scope.serverUrl = "";
    }, 400);

  };

  if (serverId !== null) {
    //$scope.startIpython();
  }


  var menus = {
   type: "menubar",
   items:[{
       label: "Server",
       items:[{label: "Start",
                click: $scope.startIpython
              },
              {label: "Stop",
                click: $scope.stopIpython
              }
              ]
   }]
  };

var myMenu = nwService.createMenu(menus);
//assign the myMenu to window menu
//win.menu = menubar;

  
/*
  _.each(serverConfig.local.list, function(conf, id) {
    if (conf.autoStart === true) {
      ipythonProc.start(id);
      $timeout(function(){
        nwService.openWindow("http://127.0.0.1:" + conf.port);
      }, 400);
    }
  });*/
}

function EditIpythonConfig($scope, serverConfig, ipythonProc, nwService) {
  $scope.window = nwService.window;

  $scope.localServers = serverConfig.local;
  $scope.remoteServers = serverConfig.remote;

  $scope.startIpython = function (id) {
    ipythonProc.start(id);
    var conf = $scope.localServers.list[id];
    conf.running = true;
    $scope.localServers.save();

    nwService.openWindow("http://127.0.0.1:" + conf.port);

  };

  $scope.stopIpython = function (id) {
    ipythonProc.stop(id);
    $scope.localServers.list[id].running = false;
    $scope.localServers.save();

    //$('#' + id + ' button.start').show();
    //$('#' + id + ' button.shutdown').hide();
  };
  
  $scope.handleEditRemote = function (el){
    var parent = $(el).closest('div.edit_remote_modal');
    var form = $(parent).find('form');
    var id = $(form).data('uid');

    var data = {};
    _.each($(form).serializeArray(), function(field) {
        data[field.name] = field.value;
    });

    serverConfig.remote.set(id, data);
  };

  $scope.handleEditLocal = function(el){
    var parent = $(el).closest('div.edit_local_modal');
    var form = $(parent).find('form');
    var id = $(form).data('uid');

    var data = {};
    _.each($(form).serializeArray(), function(field) {
        data[field.name] = field.value;
    });
    serverConfig.local.set(id, data);
    };

}

function EditVirtualEnvs($scope) {

}

/**
 * Set the page title, doesn't need to do anything part from inject the Page service
 * @param {[type]} $scope [description]
 * @param {[type]} Page   [description]
 */
function TitleCtrl($scope, Page) {

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
 * @param  {[type]} $rootScope  [description]
 * @param  {[type]} $q          [description]
 * @param  {[type]} ipythonProc [description]
 * @return {[type]}             [description]
 */
app.factory('nwService', ['$rootScope', '$q', 'ipythonProc', function($rootScope, $q, ipythonProc)  {

    // Expose gui and main window
    var gui = require("nw.gui");
    var window = gui.Window.get();

    window.on('close', function() {
      //TODO: confirm before exit
      //TODO: not sure what happens with multiple windows. might need to check if we are closing main window only
      ipythonProc.stopAll();
      this.close(true); //have to explicitly close!
    });

    function _createMenu(menuStructure) {

        // Create the top menu
        var menu = new gui.Menu(menuStructure);

        // Create sub-menu items if they're provided
        if(menuStructure && menuStructure.items) {

            console.log("Creating %d menu items for menu", menuStructure.items.length);
            _createMenuItems(menu, menuStructure.items);
        }

        if(menu.type === 'menubar') {
            this.window.menu = menu;
        }

        return menu;
    }
    function _createMenuItems(menu, items) {

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
                _createMenuItems(i.submenu, i.items);
            }

            // Append the menu item to the provided menu
            console.log("appending item %s to menu", i.label);
            menu.append(new gui.MenuItem(i));
        });
    }


    return {
    'gui': gui,
    'window': window,
    openWindow: gui.Window.open,
    /**
     * Create a context or window menu.
     * @param menuStructure The actual structure of the menu. This is a shortcut to avoid calling all append methods after creation.
     * Just provide an object with the following supported properties:
     * {
     *  root:{
     *      type: "context|menubar",
     *      items:[{
     *          label: "My Menu Label",
     *          type: "normal|separator|checkbox",
     *          enabled: true|false,
     *          tooltip: "This is my tooltip",
     *          icon: "path-to-icon"
     *          items:[{recursive}]
     *      }]
     *  }
     * }
     * @returns {gui.Menu}
     */
    createMenu: _createMenu,

    /**
     * Open the standard file dialog.
     *
     * @param cfg
     */
    openFileDialog: function(cfg) {
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
    },

    createMenuItems: _createMenuItems
  };

    
}]);


app.factory('serverConfig', function() {
  dummyData();
  function confObj(name) {
    return {
      list: getLocalstorage(name),

      get: function (id) {
          return getLocalstorage(name, id);
      },

      set: function(id, val) {
        setLocalstorage(id, val);
        list = getLocalstorage(name);
      },
      save: function() {   
        setLocalstorage(name, this.list);
        list = getLocalstorage(name);
      }
    };
  }

  return {
    local: confObj('localServers'),
    remote: confObj('remoteServers'),
  };

});


app.factory('ipythonProc', ['serverConfig', function(serverConfig)  {
  return {
    self: this,
    list: global.ipythonProcesses,
    start: function (id, callback) {
      var cnf = serverConfig.local.get(id); //ipython config

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
     //todo make sure port and command dont conflict, probably by defining command list instead of str
     var ipython = child_process.exec(cnf.command);
      ipython.stdout.on('data', function (data) {
        log(data.toString());
      });

      global.ipythonProcesses[id] = ipython;
      log(cnf.name + ' has been started on port:' + cnf.port);

      if (_.isFunction(callback)) {
        callback();
      }
      
    },

    stop: function (id, callback) {
      if(global.ipythonProcesses[id] !== undefined) {
        global.ipythonProcesses[id].kill();
        delete global.ipythonProcesses[id];
        log(serverConfig.local.get(id).name + ' has been shut down');
        
        if (_.isFunction(callback)) {
          callback();
        }        
      }

    },

    stopAll: function() {
      _.each(global.ipythonProcesses, function (proc, id) {
        proc.kill();
      });
      global.ipythonProcesses = [];
      log("All processes have been shutdown");
    }
  };
}]);
