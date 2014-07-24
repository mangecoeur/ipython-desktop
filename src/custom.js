var gui = require('nw.gui');



IPython.keyboard_manager.command_shortcuts.add_shortcut('ctrl+r', {
    help : 'run cell',
    help_index : 'zz',
    handler : function (event) {
        IPython.notebook.execute_cell();
        return false;
    }}
);
