import 'package:flutter/material.dart';
import 'package:parallax/modules/managers.dart';
import 'package:parallax/views/home_view.dart';

final managers = Managers();

Future<void> main() async {
  await managers.init();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData.light(),
      initialRoute: 'home',
      routes: {
        'home': (_) => const HomeView(),
      },
    );
  }
}
