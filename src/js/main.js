blob = "hi";


app.factory('serverConfig', function() {
  var homeDir = process.env[(process.platform == 'win32') ? ' ' : 'HOME'];
  var confDir = path.join(homeDir, ".ipython-desktop");
  var serverConfDir = path.join(confDir, "servers");

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

  //TODO - use user folder to save config file instead of localstorage
  //TODO: maybe have one file per configuration
  function saveServerConf(confObject){
    
    var confFileName = path.join(serverConfDir, confObject.id + ".json");
    
    ensureExists(serverConfDir, function(){
      //Save conf as json file
      fs.writeFile(confFileName, JSON.stringify(confObject, null, 4), function(err) {
          if(err) {
            console.log(err);
          } else {
            console.log("JSON saved to " + confFileName);
          }
      }); 
    });
    //localStorage.servers = JSON.stringify(confObject);
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
          confList.push(JSON.parse(data));
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
    console.log(serverConf());
    if (serverConf() === undefined) {
      resetDefaultConf();
    }

    //TODO - put this also in user conf dir
    if (localStorage.defaultServer === undefined) {
      resetDefaultConf();
    }
  }

  //initialize the config on startup
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
      var serverList = serverConf();

      return _.find(serverList, function(cnf){return cnf.id === id;});
    },
    //Set config options
    //TODO: validate options before saving.
    set: function(id, config) {      
      if (config.ipythonProfile) {
        config.ipythonProfile = config.ipyProfile.trim();        
      }
      if (config.ipythonOpts) {
        config.ipythonOpts = config.ipythonOpts.trim().split(" ");        
      }

      saveServerConf(config);
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