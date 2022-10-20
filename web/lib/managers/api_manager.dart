import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:parallax/modules/managers.dart';

class APIManager {
  Managers managers;
  late String domain;

  APIManager(this.managers);

  void init() {
    domain = managers.environment.url();
  }

  Future<int?> getPing() async {
    try {
      final uri = Uri.parse('$domain/api/ping');
      final response = await http.get(uri);
      if (response.statusCode != 200) return null;
      return jsonDecode(response.body)['ping'];
    } catch (_) {
      return null;
    }
  }
}
