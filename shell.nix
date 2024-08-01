{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://flakehub.com/f/NixOS/nixpkgs/0.1.0.tar.gz";
    sha256 = "0c72qyi7xm12cvasj5jwnq41sykfd67m4qy7d9kya2bbmcil2cpw";
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
