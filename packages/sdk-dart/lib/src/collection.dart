part of '../invisibledb.dart';

class Collection {
  final InvisibleDB _db;
  final String name;
  Collection(this._db, this.name);

  String get _path => '/api/collections/$name/records';

  Future<Map<String, dynamic>> getList({
    int? page,
    int? perPage,
    String? sort,
    String? filter,
    String? expand,
  }) {
    final q = <String, String>{};
    if (page != null) q['page'] = '$page';
    if (perPage != null) q['perPage'] = '$perPage';
    if (sort != null) q['sort'] = sort;
    if (filter != null) q['filter'] = filter;
    if (expand != null) q['expand'] = expand;
    return _db._req<Map<String, dynamic>>('GET', _path, query: q);
  }

  Future<Map<String, dynamic>> getOne(String id) =>
      _db._req<Map<String, dynamic>>('GET', '$_path/$id');

  Future<Map<String, dynamic>> create(Map<String, dynamic> data) =>
      _db._req<Map<String, dynamic>>('POST', _path, body: data);

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> data) =>
      _db._req<Map<String, dynamic>>('POST', '$_path/$id', body: data);

  Future<void> delete(String id) =>
      _db._req<void>('DELETE', '$_path/$id');
}
