{ pkgs }: {
  deps = [
    pkgs.cups
    pkgs.nodejs_20
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.postgresql
    # Puppeteer dependencies
    pkgs.chromium
    pkgs.glib
    pkgs.nss
    pkgs.nspr
    pkgs.atk
    pkgs.at-spi2-atk
    pkgs.gtk3
    pkgs.gdk-pixbuf
    pkgs.cairo
    pkgs.pango
    pkgs.dbus
    pkgs.xorg.libX11
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXdamage
    pkgs.xorg.libXext
    pkgs.xorg.libXfixes
    pkgs.xorg.libXrandr
    pkgs.xorg.libxcb
    pkgs.mesa
    pkgs.expat
    pkgs.alsa-lib
  ];
}