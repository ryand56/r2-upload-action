{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/c04d5652cfa9742b1d519688f65d1bbccea9eb7e.tar.gz"; # Pinned from nixpkgs
    sha256 = "0sgr1aka3fpihq2z6clkfbix1kly4bxlxgwy419z26lhc7zjnr9y";
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
