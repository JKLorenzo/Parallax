import 'package:parallax/managers/environment_manager.dart';

class Managers {
  late EnvironmentManager environment;

  Managers() {
    environment = EnvironmentManager(this);
  }

  init() async {}
}
