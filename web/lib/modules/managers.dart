import 'package:parallax/managers/api_manager.dart';
import 'package:parallax/managers/environment_manager.dart';

class Managers {
  late APIManager api;
  late EnvironmentManager environment;

  Managers() {
    api = APIManager(this);
    environment = EnvironmentManager(this);
  }

  init() async {
    api.init();
  }
}
