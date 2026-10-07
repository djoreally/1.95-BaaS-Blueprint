part of '../invisibledb.dart';

/// Semantic vector search (requires the :vec PocketBase build).
class VectorApi {
  final InvisibleDB _db;
  VectorApi(this._db);

  Future<List<dynamic>> query(
    String collection,
    List<double> embedding, {
    int limit = 10,
  }) async {
    final res = await _db._req<Map<String, dynamic>>(
      'POST',
      '/api/vector/query',
      body: {'collection': collection, 'embedding': embedding, 'limit': limit},
    );
    return (res['results'] as List).toList();
  }
}
