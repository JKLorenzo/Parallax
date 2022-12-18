import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:parallax/modules/managers.dart';

class EnvironmentManager {
  Managers managers;

  EnvironmentManager(this.managers);

  bool isProduction() {
    return kReleaseMode;
  }
}
