import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:web/providers/counter_provider.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Flutter Demo Home Page ${context.watch<CounterProvider>().count}',
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('You have pushed the button this many times:'),
            Text(
              '${context.watch<CounterProvider>().count}',
              style: Theme.of(context).textTheme.headline4,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: context.read<CounterProvider>().increment,
        tooltip: 'Increment',
        child: const Icon(Icons.add),
      ),
    );
  }
}
