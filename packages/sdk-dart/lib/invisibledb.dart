/// InvisibleDB Dart SDK.
///
/// ```dart
/// import 'package:invisibledb/invisibledb.dart';
///
/// final db = InvisibleDB(
///   baseUrl: 'https://acme.invisibledb.app',
///   apiKey: 'idb_live_...', // server-side only — never ship in client builds
/// );
/// final messages = await db.collection('messages').getList();
/// ```
///
/// The apiKey is the single customer key. It travels as
/// `Authorization: Bearer <key>`; the gateway validates it and swaps in the
/// instance credential.
library invisibledb;

import 'dart:convert';
import 'package:http/http.dart' as http;

part 'src/collection.dart';
part 'src/vector.dart';

class InvisibleDBError implements Exception {
  final int status;
  final String message;
  InvisibleDBError(this.status, this.message);
  @override
  String toString() => 'InvisibleDB $status: $message';
}

class InvisibleDB {
  final String baseUrl;
  final String apiKey;
  final http.Client _client;

  InvisibleDB({
    required String baseUrl,
    required this.apiKey,
    http.Client? client,
  })  : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client() {
    if (baseUrl.isEmpty || apiKey.isEmpty) {
      throw ArgumentError('baseUrl and apiKey are required');
    }
  }

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        'authorization': 'Bearer $apiKey',
      };

  Future<T> _req<T>(String method, String path,
      {Map<String, dynamic>? body, Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    late http.Response res;
    if (method == 'GET') {
      res = await _client.get(uri, headers: _headers);
    } else if (method == 'DELETE') {
      res = await _client.delete(uri, headers: _headers);
    } else if (method == 'PATCH') {
      res = await _client.patch(uri,
          headers: _headers, body: body == null ? null : jsonEncode(body));
    } else {
      res = await _client.post(uri,
          headers: _headers, body: body == null ? null : jsonEncode(body));
    }
    if (res.statusCode == 401) {
      throw InvisibleDBError(401, 'invalid api key');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw InvisibleDBError(res.statusCode, res.body.substring(0, res.body.length.clamp(0, 300)));
    }
    if (res.statusCode == 204 || res.body.isEmpty) return null as T;
    return jsonDecode(res.body) as T;
  }

  Collection collection(String name) => Collection(this, name);

  /// Raw escape hatch: GET/POST/DELETE against any API path.
  Future<T> apiGet<T>(String path, {Map<String, String>? query}) =>
      _req<T>('GET', path, query: query);
  Future<T> apiPost<T>(String path, {Map<String, dynamic>? body}) =>
      _req<T>('POST', path, body: body);
  Future<T> apiDelete<T>(String path) => _req<T>('DELETE', path);

  /// File URL for a record's file field.
  String fileUrl(String collection, String recordId, String filename) =>
      '$baseUrl/api/files/$collection/$recordId/$filename';

  VectorApi get vector => VectorApi(this);

  /// Liveness probe for your instance.
  Future<Map<String, dynamic>> health() =>
      _req<Map<String, dynamic>>('GET', '/api/health');

  void close() => _client.close();
}
