import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';
import 'package:invisibledb/invisibledb.dart';

http.Client mockClient(http.Response Function(http.BaseRequest) handler) {
  return MockClient((req) async => handler(req));
}

http.Response jsonResp(Object body, [int status = 200]) {
  return http.Response(jsonEncode(body), status,
      headers: {'content-type': 'application/json'});
}

void main() {
  group('InvisibleDB', () {
    test('constructor requires baseUrl and apiKey', () {
      expect(() => InvisibleDB(baseUrl: '', apiKey: 'k'), throwsArgumentError);
      expect(() => InvisibleDB(baseUrl: 'https://x', apiKey: ''),
          throwsArgumentError);
    });

    test('strips trailing slashes from baseUrl', () {
      final db = InvisibleDB(
          baseUrl: 'https://acme.invisibledb.app///', apiKey: 'k');
      expect(db.baseUrl, 'https://acme.invisibledb.app');
      db.close();
    });

    test('health hits /api/health with Bearer key', () async {
      String? seenAuth;
      String? seenPath;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'idb_live_abc',
        client: mockClient((req) {
          seenAuth = req.headers['authorization'];
          seenPath = req.url.path;
          return jsonResp({'message': 'ok', 'data': {}});
        }),
      );
      final res = await db.health();
      expect(res['message'], 'ok');
      expect(seenAuth, 'Bearer idb_live_abc');
      expect(seenPath, '/api/health');
      db.close();
    });

    test('401 maps to invalid api key error', () async {
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'bad',
        client: mockClient((_) => jsonResp({'message': 'nope'}, 401)),
      );
      expect(() => db.collection('x').getOne('1'),
          throwsA(isA<InvisibleDBError>().having((e) => e.status, 'status', 401)));
      db.close();
    });

    test('fileUrl builds the direct file path', () {
      final db =
          InvisibleDB(baseUrl: 'https://acme.invisibledb.app', apiKey: 'k');
      expect(db.fileUrl('messages', 'rec1', 'a.png'),
          'https://acme.invisibledb.app/api/files/messages/rec1/a.png');
      db.close();
    });

    test('apiGet/apiPost/apiDelete escape hatch', () async {
      final seen = <String>[];
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient((req) {
          seen.add('${req.method} ${req.url.path}');
          return jsonResp({'ok': true});
        }),
      );
      await db.apiGet<Map<String, dynamic>>('/api/custom');
      await db.apiPost<Map<String, dynamic>>('/api/custom', body: {'a': 1});
      await db.apiDelete<Map<String, dynamic>>('/api/custom/1');
      expect(seen, ['GET /api/custom', 'POST /api/custom', 'DELETE /api/custom/1']);
      db.close();
    });
  });

  group('Collection', () {
    test('getList builds query params and sends Bearer key', () async {
      Uri? seenUri;
      String? seenAuth;
      String? seenMethod;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app/',
        apiKey: 'idb_live_abc',
        client: mockClient((req) {
          seenUri = req.url;
          seenAuth = req.headers['authorization'];
          seenMethod = req.method;
          return jsonResp({
            'page': 1,
            'perPage': 30,
            'totalItems': 1,
            'totalPages': 1,
            'items': [
              {'id': '1'}
            ]
          });
        }),
      );
      final res = await db
          .collection('messages')
          .getList(page: 2, perPage: 10, sort: '-created');
      expect((res['items'] as List).length, 1);
      expect(seenUri!.path, '/api/collections/messages/records');
      expect(seenUri!.queryParameters['page'], '2');
      expect(seenAuth, 'Bearer idb_live_abc');
      expect(seenMethod, 'GET');
      db.close();
    });

    test('getOne fetches single record', () async {
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient(
            (req) => jsonResp({'id': '1', 'text': 'hi'})),
      );
      final rec = await db.collection('messages').getOne('1');
      expect(rec['id'], '1');
      db.close();
    });

    test('create posts JSON body', () async {
      Map<String, dynamic>? seenBody;
      String? seenMethod;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient((req) {
          seenMethod = req.method;
          seenBody = jsonDecode((req as http.Request).body);
          return jsonResp({'id': '2', 'text': 'hi'});
        }),
      );
      final rec = await db.collection('messages').create({'text': 'hi'});
      expect(rec['id'], '2');
      expect(seenMethod, 'POST');
      expect(seenBody, {'text': 'hi'});
      db.close();
    });

    test('update posts to record id', () async {
      String? seenPath;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient((req) {
          seenPath = req.url.path;
          return jsonResp({'id': '1', 'text': 'updated'});
        }),
      );
      await db.collection('messages').update('1', {'text': 'updated'});
      expect(seenPath, '/api/collections/messages/records/1');
      db.close();
    });

    test('delete sends DELETE', () async {
      String? seenMethod;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient((req) {
          seenMethod = req.method;
          return http.Response('', 204);
        }),
      );
      await db.collection('messages').delete('1');
      expect(seenMethod, 'DELETE');
      db.close();
    });
  });

  group('VectorApi', () {
    test('query posts embedding and returns results', () async {
      Map<String, dynamic>? seenBody;
      final db = InvisibleDB(
        baseUrl: 'https://acme.invisibledb.app',
        apiKey: 'k',
        client: mockClient((req) {
          seenBody = jsonDecode((req as http.Request).body);
          return jsonResp({
            'results': [
              {'id': '1', 'score': 0.95}
            ]
          });
        }),
      );
      final results = await db.vector.query('docs', [0.1, 0.2, 0.3], limit: 5);
      expect(results.length, 1);
      expect(seenBody!['collection'], 'docs');
      expect(seenBody!['limit'], 5);
      expect((seenBody!['embedding'] as List).length, 3);
      db.close();
    });
  });
}
