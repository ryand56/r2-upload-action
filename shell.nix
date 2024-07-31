{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://flakehub.com/f/NixOS/nixpkgs/0.1.*.tar.gz";
    sha256 = "1aabz2zbbf2l6b85v04cc64ff8hfp09g3hnj41iq45kcpb9r3qmx";
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
