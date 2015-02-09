/**
 * Created by jonathanchambers on 28/11/14.
 */

//var BrowserWindow = remote.require('browser-window');

//mainWindow = new BrowserWindow({width: 800, height: 900, 'node-integration': 'all'});

requireAtom = require;

delete require;

console.log(requireAtom);
console.log(requireAtom('remote'));
