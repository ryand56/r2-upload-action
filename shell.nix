{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/b5b2fecd0cadd82ef107c9583018f381ae70f222.tar.gz"; # Pinned from nixpkgs
    sha256 = "0bj1mjz2m4m5ns7c0cxxvraw0rc84cd172pv6vyqrgiw7ld339lk";
  };

  pkgs = import nixpkgs {
    inherit system;
    config = { };
    overlays = [ ];
  };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    # Format using nixfmt
    nixfmt-rfc-style

    node2nix
    nodejs
    nodePackages.pnpm
    yarn
  ];
}
