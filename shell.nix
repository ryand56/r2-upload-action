{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/4de4818c1ffa76d57787af936e8a23648bda6be4.tar.gz"; # Pinned from nixpkgs
    sha256 = "0l3b9jr5ydzqgvd10j12imc9jqb6jv5v2bdi1gyy5cwkwplfay67";
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
