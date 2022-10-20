import 'package:parallax/main.dart';

class Ping {
  int? value;

  Ping({this.value});

  String get ping {
    return value.toString();
  }

  static Stream<Ping> stream() async* {
    int ping;

    while (true) {
      ping = await managers.api.getPing();
      yield Ping(value: ping);
      await Future.delayed(const Duration(seconds: 5));
    }
  }
}
