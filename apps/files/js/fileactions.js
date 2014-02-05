/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global OC, FileList	*/
/* global trashBinApp */
var FileActions = {
	actions: {},
	defaults: {},
	icons: {},
	currentFile: null,
	register: function (mime, name, permissions, icon, action) {
		if (!FileActions.actions[mime]) {
			FileActions.actions[mime] = {};
		}
		if (!FileActions.actions[mime][name]) {
			FileActions.actions[mime][name] = {};
		}
		FileActions.actions[mime][name]['action'] = action;
		FileActions.actions[mime][name]['permissions'] = permissions;
		FileActions.icons[name] = icon;
	},
	setDefault: function (mime, name) {
		FileActions.defaults[mime] = name;
	},
	get: function (mime, type, permissions) {
		var actions = {};
		if (FileActions.actions.all) {
			actions = $.extend(actions, FileActions.actions.all);
		}
		if (type) {//type is 'dir' or 'file'
			if (FileActions.actions[type]) {
				actions = $.extend(actions, FileActions.actions[type]);
			}
		}
		if (mime) {
			var mimePart = mime.substr(0, mime.indexOf('/'));
			if (FileActions.actions[mimePart]) {
				actions = $.extend(actions, FileActions.actions[mimePart]);
			}
			if (FileActions.actions[mime]) {
				actions = $.extend(actions, FileActions.actions[mime]);
			}
		}
		var filteredActions = {};
		$.each(actions, function (name, action) {
			if (action.permissions & permissions) {
				filteredActions[name] = action.action;
			}
		});
		return filteredActions;
	},
	getDefault: function (mime, type, permissions) {
		var mimePart;
		if (mime) {
			mimePart = mime.substr(0, mime.indexOf('/'));
		}
		var name = false;
		if (mime && FileActions.defaults[mime]) {
			name = FileActions.defaults[mime];
		} else if (mime && FileActions.defaults[mimePart]) {
			name = FileActions.defaults[mimePart];
		} else if (type && FileActions.defaults[type]) {
			name = FileActions.defaults[type];
		} else {
			name = FileActions.defaults.all;
		}
		var actions = this.get(mime, type, permissions);
		return actions[name];
	},
	/**
	 * Display file actions for the given element
	 * @param parent "td" element of the file for which to display actions
	 * @param triggerEvent if true, triggers the fileActionsReady on the file
	 * list afterwards (false by default)
	 */
	display: function (parent, triggerEvent) {
		FileActions.currentFile = parent;
		var actions = FileActions.get(FileActions.getCurrentMimeType(), FileActions.getCurrentType(), FileActions.getCurrentPermissions());
		var file = FileActions.getCurrentFile();
		var nameLinks;
		if (FileList.findFileEl(file).data('renaming')) {
			return;
		}

		// recreate fileactions
		nameLinks = parent.children('a.name');
		nameLinks.find('.fileactions, .nametext .action').remove();
		nameLinks.append('<span class="fileactions" />');
		var defaultAction = FileActions.getDefault(FileActions.getCurrentMimeType(), FileActions.getCurrentType(), FileActions.getCurrentPermissions());

		var actionHandler = function (event) {
			event.stopPropagation();
			event.preventDefault();

			FileActions.currentFile = event.data.elem;
			var file = FileActions.getCurrentFile();

			event.data.actionFunc(file);
		};

		var addAction = function (name, action) {
			// NOTE: Temporary fix to prevent rename action in root of Shared directory
			if (name === 'Rename' && $('#dir').val() === '/Shared') {
				return true;
			}

			if ((name === 'Download' || action !== defaultAction) && name !== 'Delete') {
				var img = FileActions.icons[name],
					actionText = t('files', name),
					actionContainer = 'a.name>span.fileactions';
				if (img.call) {
					img = img(file);
				}
				var html = '<a href="#" class="action" data-action="' + name + '">';
				if (img) {
					html += '<img class ="svg" src="' + img + '" />';
				}
				if (name === 'Rename') {
					// rename has only an icon which appears behind
					// the file name
					actionText = '';
					actionContainer = 'a.name span.nametext';
				} else if (name === 'Versions') {
					// Moves the Versions Button inside
					// the date column
					actionText = '';
					actionContainer = 'td.date span.modified';
				} else {
					html += '<span> ' + actionText + '</span></a>';
				}

				var element = $(html);
				element.data('action', name);
				//alert(element);
				element.on('click', {a: null, elem: parent, actionFunc: actions[name]}, actionHandler);
				if (name === 'Versions') {
					parent.parent().children().children().last().append(element);
				} else {
					parent.find(actionContainer).append(element);
				}
			}

		};

		$.each(actions, function (name, action) {
			if (name !== 'Share') {
				addAction(name, action);
			}
		});
		if(actions.Share && !($('#dir').val() === '/' && file === 'Shared')){
			// t('files', 'Share')
			addAction('Share', actions.Share);
		}

		// remove the existing delete action
		parent.parent().children().last().find('.action.delete').remove();
		if (actions['Delete']) {
			var img = FileActions.icons['Delete'];
			var html;
			if (img.call) {
				img = img(file);
			}
			if (typeof trashBinApp !== 'undefined' && trashBinApp) {
				html = '<a href="#" original-title="' + t('files', 'Delete permanently') + '" class="action delete delete-icon" />';
			} else {
				html = '<a href="#" class="action delete delete-icon" />';
			}
			var element = $(html);
			element.data('action', actions['Delete']);
			element.on('click', {a: null, elem: parent, actionFunc: actions['Delete']}, actionHandler);
			parent.parent().children().last().append(element);
		}

		if (triggerEvent){
			$('#fileList').trigger(jQuery.Event("fileActionsReady"));
		}
	},
	getCurrentFile: function () {
		return FileActions.currentFile.parent().attr('data-file');
	},
	getCurrentMimeType: function () {
		return FileActions.currentFile.parent().attr('data-mime');
	},
	getCurrentType: function () {
		return FileActions.currentFile.parent().attr('data-type');
	},
	getCurrentPermissions: function () {
		return FileActions.currentFile.parent().data('permissions');
	}
};

$(document).ready(function () {
	var downloadScope;
	if ($('#allowZipDownload').val() == 1) {
		downloadScope = 'all';
	} else {
		downloadScope = 'file';
	}

	if (typeof disableDownloadActions == 'undefined' || !disableDownloadActions) {
		FileActions.register(downloadScope, 'Download', OC.PERMISSION_READ, function () {
			return OC.imagePath('core', 'actions/download');
		}, function (filename) {
			var url = FileList.getDownloadUrl(filename);
			if (url) {
				OC.redirect(url);
			}
		});
	}
	$('#fileList tr').each(function () {
		FileActions.display($(this).children('td.filename'));
	});
	
	$('#fileList').trigger(jQuery.Event("fileActionsReady"));

});

FileActions.register('all', 'Delete', OC.PERMISSION_DELETE, function () {
	return OC.imagePath('core', 'actions/delete');
}, function (filename) {
	FileList.do_delete(filename);
	$('.tipsy').remove();
});

// t('files', 'Rename')
FileActions.register('all', 'Rename', OC.PERMISSION_UPDATE, function () {
	return OC.imagePath('core', 'actions/rename');
}, function (filename) {
	FileList.rename(filename);
});

FileActions.register('dir', 'Open', OC.PERMISSION_READ, '', function (filename) {
	var dir = $('#dir').val() || '/';
	if (dir !== '/') {
		dir = dir + '/';
	}
	FileList.changeDirectory(dir + filename);
});

FileActions.setDefault('dir', 'Open');
