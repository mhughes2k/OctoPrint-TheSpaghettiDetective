/*
 * View model for TheSpaghettiDetective Wizard
 *
 * Author: The Spaghetti Detective
 * License: AGPLv3
 */
$(function () {
    function TheSpaghettiDetectiveSettingsViewModel(parameters) {
        var self = this;

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        self.settingsViewModel = parameters[0];

        self.alertsShown = {};
        self.showDetailPage = ko.observable(false);
        self.streaming = ko.mapping.fromJS({ is_pro: false, is_pi_camera: false });
        self.errorStats = ko.mapping.fromJS({ server: { attempts: 0, error_count: 0, first: null, last: null }, webcam: { attempts: 0, error_count: 0, first: null, last: null }});

        self.onStartupComplete = function (plugin, data) {
            self.fetchPluginStatus();
        }

        self.fetchPluginStatus = function () {
            apiCommand({
                command: "get_plugin_status",
            })
            .done(function (data) {
                ko.mapping.fromJS(data.streaming_status, self.streaming);
                ko.mapping.fromJS(data.error_stats, self.errorStats);

                if (_.get(data, 'sentry_opt') === "out") {
                    var sentrynotice = new PNotify({
                        title: "The Spaghetti Detective",
                        text: "<p>Turn on bug reporting to help us make TSD plugin better?</p><p>The debugging info included in the report will be anonymized.</p>",
                        hide: false,
                        destroy: true,
                        confirm: {
                            confirm: true,
                        },
                    });
                    sentrynotice.get().on('pnotify.confirm', function () {
                        self.toggleSentryOpt();
                    });
                }
                _.get(data, 'alerts', []).forEach(function (alertMsg) {
                    self.displayAlert(alertMsg);
                })
            });
        }

        self.toggleSentryOpt = function (ev) {
            apiCommand({
                command: "toggle_sentry_opt",
            });
            return true;
        };

        self.selectPage = function(page) {
            self.showDetailPage(true);

            switch (page) {
                case 'troubleshooting':
                    $('li[data-page="advanced"]').removeClass('active');
                    $('#advanced').removeClass('active');
                    $('li[data-page="troubleshooting"]').addClass('active');
                    $('#troubleshooting').addClass('active');
                    break;
                case 'advanced':
                    $('li[data-page="troubleshooting"]').removeClass('active');
                    $('#troubleshooting').removeClass('active');
                    $('li[data-page="advanced"]').addClass('active');
                    $('#advanced').addClass('active');
                    break;
            }
        };

        self.returnToSelection = function() {
            self.showDetailPage(false);
        }

        $(function() {
            $('.settings-wrapper .toggle').click(function() {
                $(this).toggleClass('opened');
            })
        });

        /*** Plugin error alerts */

        self.onDataUpdaterPluginMessage = function (plugin, data) {
            if (plugin != "thespaghettidetective") {
                return;
            }

            if (data.new_alert) {
                self.fetchPluginStatus();
            }
        }

        self.displayAlert = function (alertMsg) {
            var ignoredItemPath = "ignored." + alertMsg.cause + "." + alertMsg.level;
            if (retrieveFromLocalStorage(ignoredItemPath, false)) {
                return;
            }

            var showItemPath = alertMsg.cause + "." + alertMsg.level;
            if (_.get(self.alertsShown, showItemPath, false)) {
                return;
            }
            _.set(self.alertsShown, showItemPath, true);

            var text = null;
            var msgType = "error";
            if (alertMsg.level === "warning") {
                msgType = "notice";
            }

            var buttons = [
                {
                    text: "Never show again",
                    click: function (notice) {
                        saveToLocalStorage(ignoredItemPath, true);
                        notice.remove();
                    }
                },
                {
                    text: "OK",
                    click: function (notice) {
                        notice.remove();
                    }
                },
                {
                    text: "Close",
                    addClass: "remove_button"
                },
            ]

            if (alertMsg.level === "error") {
                buttons.unshift(
                    {
                        text: "Details",
                        click: function (notice) {
                            self.showDiagnosticReportModal();
                            notice.remove();
                        }
                    }
                );
                if (alertMsg.cause === "server") {
                    text =
                        "The Spaghetti Detective failed to connect to the server. Please make sure OctoPrint has a reliable internet connection.";
                } else if (alertMsg.cause === "webcam") {
                    text =
                        'The Spaghetti Detective plugin failed to connect to the webcam. Please go to "Settings" -> "Webcam & Timelapse" and make sure the stream URL and snapshot URL are set correctly. Or follow <a href="https://www.thespaghettidetective.com/docs/webcam-connection-error-popup">this trouble-shooting guide</a>.';
                }
            }
            if (alertMsg.level === "warning") {
                if (alertMsg.cause === 'streaming') {
                    text =
                        '<p>Premium webcam streaming failed to start. The Spaghetti Detective has switched to basic streaming.</p><p><a href="https://www.thespaghettidetective.com/docs/webcam-switched-to-basic-streaming/">Learn more >>></a></p>';
                }
                if (alertMsg.cause === 'cpu') {
                    text =
                        '<p>Premium streaming uses excessive CPU. This may negatively impact your print quality. Consider switching "compatibility mode" to "auto" or "never", or disable premium streaming. <a href="https://www.thespaghettidetective.com/docs/streaming-compatibility-mode/#more-about-cpu-usage-in-compatibility-mode">Learn more >>></a></p>';
                }
            }

            if (text) {
                new PNotify({
                    title: "The Spaghetti Detective",
                    text: text,
                    type: msgType,
                    hide: false,
                    confirm: {
                        confirm: true,
                        buttons: buttons,
                    },
                    history: {
                        history: false
                    },
                    before_open: function (notice) {
                        notice
                            .get()
                            .find(".remove_button")
                            .remove();
                    }
                });
            }
        };

        self.showDiagnosticReportModal = function () {
            $('#diagnosticReportModal').modal();
        };
    }


    // Helper methods
    function apiCommand(data) {
        return $.ajax("api/plugin/thespaghettidetective", {
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(data)
        });
    }

    var LOCAL_STORAGE_KEY = 'plugin.tsd';

    function localStorageObject() {
        var retrievedObject = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!retrievedObject) {
            retrievedObject = '{}';
        }
        return JSON.parse(retrievedObject);
    }

    function retrieveFromLocalStorage(itemPath, defaultValue) {
        return _.get(localStorageObject(), itemPath, defaultValue);
    }

    function saveToLocalStorage(itemPath, value) {
        var retrievedObject = localStorageObject();
        _.set(retrievedObject, itemPath, value);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(retrievedObject));
    }


    /* view model class, parameters for constructor, container to bind to
     * Please see http://docs.octoprint.org/en/master/plugins/viewmodels.html#registering-custom-viewmodels for more details
     * and a full list of the available options.
     */
    OCTOPRINT_VIEWMODELS.push({
        construct: TheSpaghettiDetectiveSettingsViewModel,
        // ViewModels your plugin depends on, e.g. loginStateViewModel, settingsViewModel, ...
        dependencies: ["settingsViewModel"],
        // Elements to bind to, e.g. #settings_plugin_thespaghettidetective, #tab_plugin_thespaghettidetective, ...
        elements: [
            "#settings_plugin_thespaghettidetective",
        ]
    });

});