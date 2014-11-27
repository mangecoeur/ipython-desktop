//Nodejs builtins
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');

//Third party modules
var _ = require('lodash');
var shell = require('shelljs');


var HOME_DIR = process.env[(process.platform == 'win32') ? ' ' : 'HOME'];
var BASE_CONF_DIR = path.join(HOME_DIR, ".ipython-desktop");
var SERVER_CONF_DIR = path.join(BASE_CONF_DIR, "servers");

var _DEFAULT_CONF = {
  'defaultServerId': 'defaultSrv',
  'autoStart': false
};


//FIXME: bit of a crap way to trigger setup...
setUp();

exports.preferences = preferences;
exports.servers = servers;
exports.getServer = getServer;
exports.newServer = newServer;
exports.saveServer = saveServer;
exports.deleteServer = deleteServer;
exports.reset = resetDefaultConf;
exports.defaultId = defaultServerId;
exports.autoStart = autoStart;


function setUp(){
  //create the config path
  shell.mkdir('-p', SERVER_CONF_DIR);

  if (servers() === undefined || servers().length === 0) {
    resetDefaultConf();
  }

  //FIXME: will set up default config if none found... this is confusing, fix it
  getSystemConfig();
}

function preferences(val){
  if (value !== undefined) {
    savePreferences(val);
  }
  return getSystemConfig();
}

function savePreferences(conf) {
  fs.writeFile(path.join(BASE_CONF_DIR, 'preferences.json'), JSON.stringify(conf, null, 4), function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log("preferences saved");
      }
  }); 
}

function getSystemConfig() {
  try 
  {
    var conf = JSON.parse(fs.readFileSync(path.join(BASE_CONF_DIR, 'preferences.json')));    return conf;
    
  } catch(e) {
    savePreferences(_DEFAULT_CONF);
    return _DEFAULT_CONF;
  }
}


function defaultServerId(value){ 
  var sysConf = getSystemConfig();
  if (value !== undefined) {
    sysConf.defaultServerId = value;
    savePreferences(sysConf);

  }
  return sysConf.defaultServerId;
}


function autoStart(value) {
  var sysConf = getSystemConfig();

  if (value !== undefined) {
    sysConf.autoStart = value;
    savePreferences(sysConf);

  }
  return sysConf.autoStart;
}


function saveServer(config){
    console.log(config);

  if (config.ipyProfile) {
    config.ipyProfile = config.ipyProfile.trim();        
  }
  if (config.ipythonOpts) {
    config.ipythonOpts = config.ipythonOpts.trim().split(" ");        
  }

  //set the location of the ipython profile configuration for when we want to get the server running info file.
  //avoids having to run the search when we are waiting for the server to start.
  config.ipythonConfDir = profileConfDir(config);
  //Ignore any extra fields, such as isDefault

  config = _.pick(config, "id", "ipython", "type", "ipyProfile", "ipythonConfDir");
  var confFileName = path.join(SERVER_CONF_DIR, config.id + ".json");

  //Save conf as json file
  fs.writeFile(confFileName, JSON.stringify(config, null, 4), function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log("JSON saved to " + confFileName);
      }
  }); 
}


function newServer() {
  ipython_bin_loc = detectDefaultIpython();
  defaultConf = {
                  'id': shortId(),
                  'ipython': ipython_bin_loc,
                  'type': 'local',
                  };
  return defaultConf;
}


function getServer(id) {
  return _.find(getServerConfList(), function(cnf){return cnf.id === id;});
}


function deleteServer(id){
  var config = getServer(id);
  var confFileName = path.join(SERVER_CONF_DIR, config.id + ".json");
  shell.rm('-f', confFileName); //delete with f, means ignore if not there
}


function profileConfDir(config){
  var cmd_profile = config.ipython + " profile locate";
  var profile_dir;
  if(config.ipyProfile){
    cmd_profile = cmd_profile + " " + config.ipyProfile;
  }
  
  try {
    result = shell.exec(cmd_profile, {async: false});
    profile_dir = result.output.trim().replace(/[\r\n]/g, "");
  } catch(err) {
    profile_dir = path.join(HOME_DIR, '.ipython');
    if(config.ipyProfile){
      profile_dir = path.join(profile_dir, "profile_" + config.ipyProfile);
    }
  }
  return profile_dir;

  // child_process.exec(cmd_profile, function(err, stout, sterr) {
  //   if (err !== null) {
  //     console.log('problem locating profile: ' + error);
  //     return; // skip the rest
  //   }

  //   var profile_dir = stout.trim().replace(/[\r\n]/g, "");
  //   callback(profile_dir);
  // }
}


//Try to figure out the default IPython using "which" - FIXME - NO WINDOWS SUPPORT
//calls fn handleExecName(path of ipython bin) when found
function detectDefaultIpython(callback){
  var ipython_bin;
  try {
   ipython_bin = shell.which('ipython');
  } 
  catch(err) {
    ipython_bin = "/usr/bin/ipython";
  }

  //FIXME get which working
  if (!ipython_bin || ipython_bin === '') {

    //ipython_bin ='/Users/jonathanchambers/anaconda/bin/ipython';
    ipython_bin = "/usr/bin/ipython";
    console.log("could not find default ipython");

  }
  console.log(ipython_bin);

  return ipython_bin;
}


function resetDefaultConf(){
  var ipython_bin_loc = detectDefaultIpython();
  var defaultConf = {
                      'id': 'defaultSrv',
                      'name': 'IPython Default',
                      'ipython': ipython_bin_loc,
                      'type': 'local',
                      'ipyProfile': ''
                      };
    saveServer(defaultConf);
}


function servers(configList) {
    if (configList !== undefined) { 
      _.each(configList, saveServer);
    }
    return getServerConfList();
}


//read all server configs from the config directory
//append them to list.
function getServerConfList() {

  //fill in empty vars, otherwise seems to cause issues in angular where it doesn't add them to to object
  var confTemplate = {
                      'id': null,
                      'name': null,
                      'ipython': null,
                      'type': null,
                      "ipythonConfDir": null,
                      'ipyProfile': null,
                      'isDefault': false
                      };

  try {
    var files = fs.readdirSync(SERVER_CONF_DIR);
    var confList = [];
    
    for (var i = files.length - 1; i >= 0; i--) {
      var filename = files[i];

      if (path.extname(filename) === ".json"){
        var data = fs.readFileSync(path.join(SERVER_CONF_DIR,filename));
        var conf = JSON.parse(data);
        if (conf.id == defaultServerId()) {
          conf.isDefault = true;
        }
        confList.push(_.defaults(conf, confTemplate));
      }
    }
    return confList;

  } catch(e) {
    return undefined;
  }
}


function saveServerConfList(configList) {
  if (configList !== undefined) {
    _.each(configList, saveServer);
  }
  return getServerConfList();
}