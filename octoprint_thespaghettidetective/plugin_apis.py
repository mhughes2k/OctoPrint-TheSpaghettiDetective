import flask

from .utils import server_request
from .lib.error_stats import error_stats
from .lib import alert_queue

def get_api_commands():
    return dict(
        verify_code=["code"],
        get_plugin_status=[],
        toggle_sentry_opt=[],
        test_server_connection=[],
    )

def on_api_command(plugin, command, data):
    try:
        if command == "verify_code":
            resp = server_request('GET', '/api/v1/onetimeverificationcodes/verify/?code=' + data["code"], plugin)
            succeeded = resp.ok
            printer = None
            if succeeded:
                printer = resp.json()['printer']
                plugin._settings.set(["auth_token"], printer['auth_token'], force=True)
                plugin._settings.save(force=True)

            return flask.jsonify({'succeeded': succeeded, 'printer': printer})

        if command == "get_plugin_status":
            results = dict(
                server_status=dict(
                    is_connected=plugin.ss and plugin.ss.connected(),
                    last_status_update_ts=plugin.last_status_update_ts,
                ),
                linked_printer=plugin.linked_printer,
                streaming_status=dict(
                    is_pi_camera=plugin.webcam_streamer and bool(plugin.webcam_streamer.pi_camera),
                    premium_streaming=plugin.webcam_streamer and not plugin.webcam_streamer.shutting_down),
                    error_stats=error_stats.as_dict(),
                    alerts=alert_queue.fetch_and_clear(),
                )
            if plugin._settings.get(["auth_token"]):     # Ask to opt in sentry only after wizard is done.
                sentry_opt = plugin._settings.get(["sentry_opt"])
                if sentry_opt == 'out':
                    plugin._settings.set(["sentry_opt"], 'asked')
                    plugin._settings.save(force=True)
                results['sentry_opt'] = sentry_opt

            return flask.jsonify(results)

        if command == "toggle_sentry_opt":
            plugin._settings.set(["sentry_opt"], 'out' if plugin._settings.get(["sentry_opt"]) == 'in' else 'in', force=True)
            plugin._settings.save(force=True)

        if command == "test_server_connection":
            resp = plugin.tsd_api_status()
            return flask.jsonify({'status_code': resp.status_code if resp is not None else None})

    except Exception as e:
        plugin.sentry.captureException()
        raise
