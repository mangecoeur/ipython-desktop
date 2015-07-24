Menu = require 'menu'
BrowserWindow = require 'browser-window'
app = require 'app'
fs = require 'fs-plus'
ipc = require 'ipc'
path = require 'path'
os = require 'os'
net = require 'net'
url = require 'url'

# Report crashes to our server.
require('crash-reporter').start();

{EventEmitter} = require 'events'
_ = require 'underscore-plus'
{spawn} = require 'child_process'

AppMenu = require './appmenu'
AppWindow = require './appwindow'

nbservers = require './nbservers.js'

notebookWindows = []

module.exports =
class Application
  _.extend @prototype, EventEmitter.prototype


  constructor: (options) ->
    {@resourcePath, @version, @devMode } = options

    @pkgJson = require '../../package.json'
    @windows = []

    @handleIPC()

    @openWithOptions(options)

    #Quit when all windows are closed (including for Mac - though this could change)
    app.on 'window-all-closed', ->
      if (process.platform != 'darwin')
        @appShutdown()

# Opens a new window based on the options provided.
  openWithOptions: (options) ->
    {devMode, test, exitWhenDone, specDirectory, logFile} = options

    if test
      appWindow = @runSpecs({exitWhenDone, @resourcePath, specDirectory, devMode, logFile})
    else
      appWindow = new AppWindow(options)
      @menu = new AppMenu(pkg: @pkgJson)

      @menu.attachToWindow(appWindow)
      @handleMenuItems(@menu)

    appWindow.show()
    @windows.push(appWindow)
    appWindow.on 'closed', =>
      @removeAppWindow(appWindow)

  handleMenuItems: (menu) ->
    menu.on 'application:quit', -> app.quit()

    menu.on 'window:reload', ->
      BrowserWindow.getFocusedWindow().reload()

    menu.on 'window:refresh-server', ->
      BrowserWindow.getFocusedWindow().webContents.send('refresh-server')

    menu.on 'window:toggle-full-screen', ->
      BrowserWindow.getFocusedWindow().toggleFullScreen()

    menu.on 'window:toggle-dev-tools', ->
      BrowserWindow.getFocusedWindow().toggleDevTools()

    menu.on 'application:run-specs', =>
      @openWithOptions(test: true)

  removeAppWindow: (appWindow)->
    @windows.splice(idx, 1) for w, idx in @windows when w is appWindow

  openServerWindow: (server) =>
    win = new BrowserWindow({ width: 800, height: 600, show: false });
    @windows.push(win);
    win.on 'closed', =>
      win = null

    server.on 'server:stopped', =>
      win.close();


    win.loadUrl(server.url);
    win.show();

  handleIPC: () ->
    ipc.on 'server:start', (event, serverId) ->
      if (!nbservers.isRunning(serverId))
        # Create server and open window when it's started
        srv = nbservers.startServer(serverId)

        srv.on 'server:started', =>
          @openServerWindow(srv)

      else if (nbservers.isRunning(serverId))
        srv = _.pick(nbservers.runningServer(serverId), 'id', 'name', 'conf', 'url', 'type');
        event.sender.send('server.started', srv); #don't bother with process

    ipc.on 'server:stop', (event, serverId) ->
      nbservers.stopServer(serverId, event.sender);

    ipc.on 'server:status', (event, serverId) ->
      if (serverId != undefined)
        result = nbservers.runningServer(serverId)
        result = _.pick(result, 'id', 'name', 'conf', 'url', 'type')

      else
        result = _.map nbservers.runningServers, (srv, srvId) =>
            return _.pick(srv, 'id', 'name', 'conf', 'url', 'type')

        event.sender.send('server:status', result)

    ipc.on 'notebook:new-window', (event, url) ->
      win = new BrowserWindow({ width: 800, height: 600, 'node-integration':false });
      win.loadUrl(url);
#      win.webContents.addEventListener 'new-window', (e) -> require('shell').openExternal(e.url)

      notebookWindows[e.url] = win;


  appShutdown: ->
    nbservers.stopAllServers()
    app.quit()


# Opens up a new {AtomWindow} to run specs within.
  #
  # options -
  #   :resourcePath - The path to include specs from.
  #   :specPath - The directory to load specs from.
  #   :logfile - The file path to log output to.
  runSpecs: ({exitWhenDone, resourcePath, specDirectory, logFile}) ->
    if resourcePath isnt @resourcePath and not fs.existsSync(resourcePath)
      resourcePath = @resourcePath

    try
      bootstrapScript = require.resolve(path.resolve(global.devResourcePath, 'spec', 'spec-bootstrap'))
    catch error
      bootstrapScript = require.resolve(path.resolve(__dirname, '..', '..', 'spec', 'spec-bootstrap'))

    isSpec = true
    devMode = true
    new AppWindow({bootstrapScript, exitWhenDone, resourcePath, isSpec, devMode, specDirectory, logFile})



