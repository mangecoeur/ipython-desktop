# IPython Notebook Desktop

This is a proof of concept desktop interface for the IPython Notebook. 

## What's new
The latest revision improves ipython configuration and process handling. It will now try to automatically figure out the location of your ipython install and the url where the server is available when launched.

## Concept
It's well established that IPython is awesome.

Most IPython users end up using local installs of the IPython notebook in their browser. However this is somewhat clunky, mixing the browser interface and the notebook interface and generally requiring a trip to the command line to get the server running.

The IPython Notebook Desktop wraps the webapp in a more friendly interface, powered by node-webkit. You can configure a notebook to run to power the interface (optionally have it run on startup).

What this does **NOT** do is provide you with an IPython installation. This is deliberate, since people have different needs and tastes with regards to their Python installs. Some people want to use the Python bundled with their operating system, others use Python distributions like Canopy or Anaconda. With IPython Desktop the Python distribution and the interface are separate, but you must configure IPython desktop to use your IPython installation.

The IPython Notebook Desktop doesn't aim to make it easier to install a scientific python environment, but should be easy enough to get by itself. It could eventually be a candidate for bundling with existing packages or with IPython itself.


## Pretty pictures
IPython embedded

![Screenshot1](https://raw.githubusercontent.com/mangecoeur/ipython-desktop/master/assets/Screenshot1.png "Screenshot1")

Start Screen:

![Screenshot2](https://raw.githubusercontent.com/mangecoeur/ipython-desktop/master/assets/Screenshot2.png "Start screen")

Config Screen:

![Screenshot3](https://raw.githubusercontent.com/mangecoeur/ipython-desktop/master/assets/Screenshot3.png "Screenshot3")


## Get it!
[App bundle for Mac](https://github.com/mangecoeur/ipython-desktop/raw/master/apps/ipython-desktop.zip)

You also need to have IPython installed. My personal recommendation is the Anaconda python distribution if you are mainly doing science and engineering work.

**Coming sometime - binary bundles for each platform. Contributions welcome**

## Configuration

IPython desktop can either launch the IPython notebook server for you or connect to an existing URL. 

To launch a server you must specify the location of your IPython executable, by default this is pre-filled (using the output of the command `which ipython`). You can optionally specify a Profile to use (which will be used with --profile=...)


**IMPORTANT** - you must supply the full path to your IPython install otherwise it will fail to launch the ipython server

**WARNING:** ipython-desktop is by no means idiot proof at the moment. If you don't configure it correctly the page will simply fail to load without explanation. This should improve in future versions.


### URL only
If you set the "remote" option in the config you can simply type in the URL of your IPython server **including `http://` at the front!** handy if you just want a nicer interface for a remote system or just for testing.


## Building ipython-desktop
In theory, the following steps should work (on Mac):

Requirements 
- Xcode developer tools installed 
- `node` (nodejs) with `npm`, if you use Homebrew (and you should) just do `brew install node`.
- `grunt` and `grunt-cli` (`npm install -g grunt grunt-cli` normally you will have to use sudo)

Set up the project
In the terminal, `cd` into the source folder. Run `npm install`, `grunt nodewebkit`, `grunt install` to set up the dependencies for ipython desktop.

FINALLY you should be able to run `grunt run` and see you shiny new ipython-desktop app, ready to configure.

## Known Issues

- IMPORTANT - you must configure ipython desktop with the FULL PATH of your ipython executable
- Certain combinations of starting/stopping ipython servers and opening/closing windows might leave orphaned IPython processes (especially if you force quit the app)

## TODO
- Bundles for all OSes
- Add fault tolerance e.g. for missing or misconfigured Ipython
- More user friendly configuration of ipython
- better integration with ipython notebooks - start/stop events, clean shutdown
- Integration with Native menus!
- Try to find the current iPython install using "which iPython" -> Done!
- Try to auto-config profiles using "ipython profile locate"
- Get url/port of running ipython using json from profile folder

## Similar Work
- Canopy: Enthought provide their Canopy desktop interface with IPython notebook integration. However this ties you into the EPD distribution. The IPython Notebook Desktop aims to be a lighter, more versatile solution
- [IPython notebook](https://github.com/liyanage/ipython-notebook) Works in a similar vein, though is Mac only. It also differs in aim, since it bundles the essentials for scientific python computing. My aim with this project is to allow the interface to work with different Python installs, making it possible to use different python version and different virtual environments.
- [IPyApp](https://github.com/ptone/IPyApp) Another project that uses node-webkit to wrap IPython notebook, but embeds the full python executable environment in the app.



## Credits
IPython desktop is powered by Node Webkit and makes use of the angular-desktop-app template. Icon is [IPython faenza](http://gnome-look.org/content/show.php?content=162145)

## LICENCE
The policy of this project is to match the licence of the IPython notebook itself - whatever you can do with ipython, you can do with ipython desktop.

For the details, see:

[IPython Licence and copyright](http://ipython.org/ipython-doc/dev/about/license_and_copyright.html)
