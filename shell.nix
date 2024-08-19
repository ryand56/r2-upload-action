{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/521d48afa9ae596930a95325529df27fa7135ff5.tar.gz"; # Pinned from nixpkgs
    sha256 = "0a1pa5azw990narsfipdli1wng4nc3vhvrp00hb8v1qfchcq7dc9";
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
