import 'package:flutter/material.dart';
import 'package:parallax/layout/responsive_layout_settings.dart';

class ResponsiveLayout extends StatelessWidget {
  final Widget mobileView;
  final Widget tabletView;
  final Widget desktopView;

  const ResponsiveLayout({
    super.key,
    required this.mobileView,
    required this.tabletView,
    required this.desktopView,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      if (constraints.maxWidth < ResponsiveLayoutSettings.mobileWidth) {
        return mobileView;
      } else if (constraints.maxWidth < ResponsiveLayoutSettings.tabletWidth) {
        return tabletView;
      } else {
        return desktopView;
      }
    });
  }
}
