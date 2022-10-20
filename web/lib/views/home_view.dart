import 'package:flutter/material.dart';
import 'package:parallax/layout/responsive_layout.dart';
import 'package:parallax/views/home_view/home_view_desktoptablet.dart';
import 'package:parallax/views/home_view/home_view_mobile.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return const ResponsiveLayout(
      mobileView: HomeViewMobile(),
      tabletView: HomeViewDesktopTablet(),
      desktopView: HomeViewDesktopTablet(),
    );
  }
}
