#!/usr/bin/env python3
"""Seed a PocketBase instance with the fixture the shared SDK conformance suite expects.

Idempotent: safe to run against a fresh or an already-seeded instance. Stdlib only.

Creates or repairs:
  * the `tasks` collection (title, status, priority, attachment, owner relation,
    created/updated autodate, public list/view, authenticated write)
  * a regular user (default alice@test.local) that owns nothing special but can sign in
  * batch enabled or disabled, to exercise the transaction paths (default: enabled)

Usage:
  python3 scripts/sdk-conformance/seed-pocketbase.py \
      --url http://127.0.0.1:8090 \
      --admin-email admin@example.test --admin-password '...' \
      --user-email alice@test.local --user-password '...' \
      [--batch enabled|disabled] [--bootstrap-bin /path/to/pocketbase --data-dir /path/to/pb_data]

Credentials may also come from IDB_ADMIN_EMAIL, IDB_ADMIN_PASSWORD, IDB_USER_EMAIL,
IDB_USER_PASSWORD. Never commit real credentials; CI generates throwaway ones per run.

--bootstrap-bin runs `pocketbase superuser upsert` first. Use it on a brand-new data dir,
because the REST API cannot create the first superuser.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

TASK_RULE_WRITE = "@request.auth.id != ''"


class Api:
    def __init__(self, base, token=None):
        self.base = base.rstrip('/')
        self.token = token

    def call(self, method, path, body=None, ok=(200, 201, 204), quiet=False):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header('content-type', 'application/json')
        if self.token:
            req.add_header('authorization', self.token)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read().decode() or 'null'
                status = res.status
        except urllib.error.HTTPError as err:
            raw = err.read().decode() or 'null'
            status = err.code
            if status not in ok:
                if quiet:
                    return status, json.loads(raw) if raw else None
                raise SystemExit(f'{method} {path} -> {status}: {raw[:400]}')
        return status, json.loads(raw)


def log(msg):
    print(f'[seed] {msg}', file=sys.stderr)


def bootstrap_superuser(bin_path, data_dir, email, password):
    cmd = [bin_path, 'superuser', 'upsert', email, password, f'--dir={data_dir}']
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    log('superuser upserted via CLI')


def auth_admin(api, email, password):
    _, body = api.call('POST', '/api/collections/_superusers/auth-with-password',
                       {'identity': email, 'password': password})
    api.token = body['token']


def tasks_schema(users_id):
    return [
        {'name': 'id', 'type': 'text', 'primaryKey': True, 'required': True, 'system': True,
         'autogeneratePattern': '[a-z0-9]{15}', 'min': 15, 'max': 15},
        {'name': 'title', 'type': 'text', 'max': 200},
        {'name': 'status', 'type': 'text', 'max': 32},
        {'name': 'priority', 'type': 'number'},
        {'name': 'attachment', 'type': 'file', 'maxSelect': 1, 'maxSize': 5 * 1024 * 1024},
        {'name': 'owner', 'type': 'relation', 'collectionId': users_id, 'maxSelect': 1,
         'cascadeDelete': False, 'minSelect': 0},
        {'name': 'created', 'type': 'autodate', 'onCreate': True, 'onUpdate': False},
        {'name': 'updated', 'type': 'autodate', 'onCreate': True, 'onUpdate': True},
    ]


def ensure_tasks(api):
    _, users = api.call('GET', '/api/collections/users')
    users_id = users['id']
    rules = {'listRule': '', 'viewRule': '', 'createRule': TASK_RULE_WRITE,
             'updateRule': TASK_RULE_WRITE, 'deleteRule': TASK_RULE_WRITE}
    status, existing = api.call('GET', '/api/collections/tasks', ok=(200, 404), quiet=True)
    if status == 404:
        api.call('POST', '/api/collections', {
            'name': 'tasks', 'type': 'base', **rules, 'fields': tasks_schema(users_id),
        })
        log('created collection tasks')
        return
    # Repair path: restore rules and any missing fields without dropping data.
    have = {f['name'] for f in existing['fields']}
    fields = list(existing['fields'])
    for want in tasks_schema(users_id):
        if want['name'] not in have:
            fields.append(want)
    api.call('PATCH', f"/api/collections/{existing['id']}", {**rules, 'fields': fields})
    log('tasks collection present; rules and fields verified')


def ensure_user(api, email, password):
    _, page = api.call('GET', '/api/collections/users/records?filter=' +
                       urllib.request.quote(f'email = "{email}"'))
    if page.get('totalItems', 0) > 0:
        log(f'user {email} exists')
        return
    api.call('POST', '/api/collections/users/records', {
        'email': email, 'password': password, 'passwordConfirm': password,
        'verified': True, 'name': email.split('@')[0],
    })
    log(f'user {email} created')


def set_batch(api, mode):
    enabled = mode == 'enabled'
    api.call('PATCH', '/api/settings', {'batch': {'enabled': enabled, 'maxRequests': 50}})
    log(f'batch {"enabled" if enabled else "disabled"}')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--url', default=os.environ.get('IDB_URL', 'http://127.0.0.1:8090'))
    p.add_argument('--admin-email', default=os.environ.get('IDB_ADMIN_EMAIL'))
    p.add_argument('--admin-password', default=os.environ.get('IDB_ADMIN_PASSWORD'))
    p.add_argument('--user-email', default=os.environ.get('IDB_USER_EMAIL', 'alice@test.local'))
    p.add_argument('--user-password', default=os.environ.get('IDB_USER_PASSWORD'))
    p.add_argument('--batch', choices=['enabled', 'disabled'], default='enabled')
    p.add_argument('--bootstrap-bin', help='pocketbase binary; runs `superuser upsert` first')
    p.add_argument('--data-dir', help='pb_data dir for --bootstrap-bin')
    args = p.parse_args(argv)

    missing = [n for n, v in [('--admin-email', args.admin_email), ('--admin-password', args.admin_password),
                              ('--user-password', args.user_password)] if not v]
    if missing:
        p.error('missing required values: ' + ', '.join(missing))
    if args.bootstrap_bin:
        if not args.data_dir:
            p.error('--bootstrap-bin needs --data-dir')
        bootstrap_superuser(args.bootstrap_bin, args.data_dir, args.admin_email, args.admin_password)

    api = Api(args.url)
    auth_admin(api, args.admin_email, args.admin_password)
    ensure_tasks(api)
    ensure_user(api, args.user_email, args.user_password)
    set_batch(api, args.batch)
    log('done')


if __name__ == '__main__':
    main()
