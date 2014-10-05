//console.log("loaded");

//console.log(process.mainModule.exports.requireNode);
//var gui = require('nw.gui');

//console.log(gui);



var unchanging_shortcuts = {
  'shift-enter' : {
      help    : 'run cell, select below',
      help_index : 'ba',
      handler : function (event) {
          IPython.notebook.execute_cell_and_select_below();
          return false;
      }
  },
  'ctrl-enter' : {
      help    : 'run cell',
      help_index : 'bb',
      handler : function (event) {
          IPython.notebook.execute_cell();
          return false;
      }
  },
  'alt-enter' : {
      help    : 'run cell, insert below',
      help_index : 'bc',
      handler : function (event) {
          IPython.notebook.execute_cell_and_insert_below();
          return false;
      }
  }
}

var shortcuts = {    
  //'esc' 
  //'ctrl-m'
  'cmd-mode' : {
      help    : 'command mode',
      help_index : 'aa',
      handler : function (event) {
          IPython.notebook.command_mode();
          return false;
      }
  },
  //'up' (edit mode)
  'line-select-up' : {
      help    : '',
      help_index : '',
      handler : function (event) {
          var index = IPython.notebook.get_selected_index();
          var cell = IPython.notebook.get_cell(index);
          if (cell && cell.at_top() && index !== 0) {
              event.preventDefault();
              IPython.notebook.command_mode();
              IPython.notebook.select_prev();
              IPython.notebook.edit_mode();
              var cm = IPython.notebook.get_selected_cell().code_mirror;
              cm.setCursor(cm.lastLine(), 0);
              return false;
          } else if (cell) {
              var cm = cell.code_mirror;
              cm.execCommand('goLineUp');
              return false;
          }
      }
  },
  //'down' (edit mode)
  'line-select-down': {
      help    : '',
      help_index : '',
      handler : function (event) {
          var index = IPython.notebook.get_selected_index();
          var cell = IPython.notebook.get_cell(index);
          if (cell.at_bottom() && index !== (IPython.notebook.ncells()-1)) {
              event.preventDefault();
              IPython.notebook.command_mode();
              IPython.notebook.select_next();
              IPython.notebook.edit_mode();
              var cm = IPython.notebook.get_selected_cell().code_mirror;
              cm.setCursor(0, 0);
              return false;
          } else {
              var cm = cell.code_mirror;
              cm.execCommand('goLineDown');
              return false;
          }
      }
  },
  //'ctrl-shift--'
  //'ctrl-shift-subtract'
  'cell-split': {
      help    : 'split cell',
      help_index : 'ea',
      handler : function (event) {
          IPython.notebook.split_cell();
          return false;
      }
  },


  //'enter' 
  'edit-mode': {
      help    : 'edit mode',
      help_index : 'aa',
      handler : function (event) {
          IPython.notebook.edit_mode();
          return false;
      }
  },
  //'up'
  'cell-select-prev' : {
      help    : 'select previous cell',
      help_index : 'da',
      handler : function (event) {
          var index = IPython.notebook.get_selected_index();
          if (index !== 0 && index !== null) {
              IPython.notebook.select_prev();
              IPython.notebook.focus_cell();
          }
          return false;
      }
  },
  //'down' 
  'cell-select-next' : {
      help    : 'select next cell',
      help_index : 'db',
      handler : function (event) {
          var index = IPython.notebook.get_selected_index();
          if (index !== (IPython.notebook.ncells()-1) && index !== null) {
              IPython.notebook.select_next();
              IPython.notebook.focus_cell();
          }
          return false;
      }
  },


  //'x'
  'cell-cut' : {
      help    : 'cut cell',
      help_index : 'ee',
      handler : function (event) {
          IPython.notebook.cut_cell();
          return false;
      }
  },
  //'c'
  'cell-copy' : {
      help    : 'copy cell',
      help_index : 'ef',
      handler : function (event) {
          IPython.notebook.copy_cell();
          return false;
      }
  },
  //'shift-v'
  'cell-paste-above' : {
      help    : 'paste cell above',
      help_index : 'eg',
      handler : function (event) {
          IPython.notebook.paste_cell_above();
          return false;
      }
  },
  //'v'
  'cell-paste-below' : {
      help    : 'paste cell below',
      help_index : 'eh',
      handler : function (event) {
          IPython.notebook.paste_cell_below();
          return false;
      }
  },
  //'d' (twice)
  'cell-delete' : {
      help    : 'delete cell (press twice)',
      help_index : 'ej',
      count: 2,
      handler : function (event) {
          IPython.notebook.delete_cell();
          return false;
      }
  },
  //'a' 
  'cell-insert-above' : {
      help    : 'insert cell above',
      help_index : 'ec',
      handler : function (event) {
          IPython.notebook.insert_cell_above();
          IPython.notebook.select_prev();
          IPython.notebook.focus_cell();
          return false;
      }
  },
  //'b'
  'cell-insert-below' : {
      help    : 'insert cell below',
      help_index : 'ed',
      handler : function (event) {
          IPython.notebook.insert_cell_below();
          IPython.notebook.select_next();
          IPython.notebook.focus_cell();
          return false;
      }
  },
  //'z'
  'cell-undelete' : {
      help    : 'undo last delete',
      help_index : 'ei',
      handler : function (event) {
          IPython.notebook.undelete_cell();
          return false;
      }
  },
  //'shift-m'
  'cell-merge-below' : {
      help    : 'merge cell below',
      help_index : 'ek',
      handler : function (event) {
          IPython.notebook.merge_cell_below();
          return false;
      }
  },
  //'y'
  'cell-to-code' : {
      help    : 'to code',
      help_index : 'ca',
      handler : function (event) {
          IPython.notebook.to_code();
          return false;
      }
  },
  //'m'
  'cell-to-markdown' : {
      help    : 'to markdown',
      help_index : 'cb',
      handler : function (event) {
          IPython.notebook.to_markdown();
          return false;
      }
  },
  //'r'
  'cell-to-raw' : {
      help    : 'to raw',
      help_index : 'cc',
      handler : function (event) {
          IPython.notebook.to_raw();
          return false;
      }
  },
  //'1'
  'cell-to-h1' : {
      help    : 'to heading 1',
      help_index : 'cd',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 1);
          return false;
      }
  },
  //'2'
  'cell-to-h2' : {
      help    : 'to heading 2',
      help_index : 'ce',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 2);
          return false;
      }
  },
  //'3'
  'cell-to-h3' : {
      help    : 'to heading 3',
      help_index : 'cf',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 3);
          return false;
      }
  },
  //'4'
  'cell-to-h4' : {
      help    : 'to heading 4',
      help_index : 'cg',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 4);
          return false;
      }
  },
  //'5'
  'cell-to-h5' : {
      help    : 'to heading 5',
      help_index : 'ch',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 5);
          return false;
      }
  },
  //'6'
  'cell-to-h6' : {
      help    : 'to heading 6',
      help_index : 'ci',
      handler : function (event) {
          IPython.notebook.to_heading(undefined, 6);
          return false;
      }
  },
  //'o' 
  'cell-output-toggle' : {
      help    : 'toggle output',
      help_index : 'gb',
      handler : function (event) {
          IPython.notebook.toggle_output();
          return false;
      }
  },
  //'shift-o' 
  'cell-output-scrolling': {
      help    : 'toggle output scrolling',
      help_index : 'gc',
      handler : function (event) {
          IPython.notebook.toggle_output_scroll();
          return false;
      }
  },
  //'s' 
  'notebook-save-checkpoint': {
      help    : 'save notebook',
      help_index : 'fa',
      handler : function (event) {
          IPython.notebook.save_checkpoint();
          return false;
      }
  },
  //'ctrl-j'
  'cell-move-down' : {
      help    : 'move cell down',
      help_index : 'eb',
      handler : function (event) {
          IPython.notebook.move_cell_down();
          return false;
      }
  },
  //'ctrl-k'
  'cell-move-up' : {
      help    : 'move cell up',
      help_index : 'ea',
      handler : function (event) {
          IPython.notebook.move_cell_up();
          return false;
      }
  },
  //'l'
  'line-numbers-toggle' : {
      help    : 'toggle line numbers',
      help_index : 'ga',
      handler : function (event) {
          IPython.notebook.cell_toggle_line_numbers();
          return false;
      }
  },
  //'i' (twice)
  'kernel-interrupt' : {
      help    : 'interrupt kernel (press twice)',
      help_index : 'ha',
      count: 2,
      handler : function (event) {
          IPython.notebook.kernel.interrupt();
          return false;
      }
  },
  //'0' (twice)
  'kernel-restart' : {
      help    : 'restart kernel (press twice)',
      help_index : 'hb',
      count: 2,
      handler : function (event) {
          IPython.notebook.restart_kernel();
          return false;
      }
  },
  //'h'
  'keyboard-shotcuts-show' : {
      help    : 'keyboard shortcuts',
      help_index : 'ge',
      handler : function (event) {
          IPython.quick_help.show_keyboard_shortcuts();
          return false;
      }
  },
  //'q'
  'pager-close' : {
      help    : 'close pager',
      help_index : 'gd',
      handler : function (event) {
          IPython.pager.collapse();
          return false;
      }
  }
}
