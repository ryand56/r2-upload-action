{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://flakehub.com/f/NixOS/nixpkgs/0.1.0.tar.gz";
    sha256 = "12inzywn6w6ikfjicbzka0v9xd6gvsx4cr6mlc3jslm5ypvqdk44";
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
