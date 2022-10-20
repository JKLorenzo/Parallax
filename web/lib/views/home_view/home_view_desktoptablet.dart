import 'package:flutter/material.dart';
import 'package:parallax/models/ping.dart';
import 'package:provider/provider.dart';

class HomeViewDesktopTablet extends StatelessWidget {
  const HomeViewDesktopTablet({super.key});

  final textStyle = const TextStyle(
    color: Colors.white70,
    fontSize: 14,
    fontWeight: FontWeight.bold,
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          backgroundBlendMode: BlendMode.darken,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.purple, Colors.blue, Colors.indigo],
          ),
        ),
        padding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.center,
          fit: StackFit.expand,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Image.asset('images/parallax.png'),
                ),
                const SizedBox(height: 40),
                Text(
                  'Parallax is a multi-purpose Discord bot that features passive role automations for gaming purposes.',
                  style: textStyle,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Text(
                  'It automatically creates and assigns roles based on the user\'s gaming activity.',
                  style: textStyle,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Text(
                  'Playing tracks from Deezer, YouTube, Spotify, and SoundCloud.',
                  style: textStyle,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Text(
                  'For personal use only.',
                  style: textStyle,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
            Positioned(
              bottom: 10,
              child: Text(
                'Current ping to the Discord Server: ${Provider.of<Ping>(context).ping} ms',
                style: const TextStyle(color: Colors.white60, fontSize: 12),
              ),
            )
          ],
        ),
      ),
    );
  }
}
