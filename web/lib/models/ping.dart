import 'package:parallax/main.dart';

class Ping {
  int? value;

  Ping({this.value});

  static Stream<Ping> stream() async* {
    while (true) {
      yield Ping(value: await managers.api.getPing());
      await Future.delayed(const Duration(seconds: 5));
    }
  }

  @override
  String toString() {
    if (value == null) return 'Offline';
    return '$value ms';
  }
}
