import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:parallax/modules/managers.dart';

class EnvironmentManager {
  Managers managers;

  EnvironmentManager(this.managers);

  bool isProduction() {
    return kReleaseMode;
  }

  int port() {
    return const int.fromEnvironment('PORT', defaultValue: 3000);
  }

  String url() {
    if (!isProduction()) return 'http://localhost:${port()}';

    const hasURL = bool.hasEnvironment('URL');
    if (hasURL == false) throw "Environment variable 'URL' not set.";

    return const String.fromEnvironment('URL');
  }
}
