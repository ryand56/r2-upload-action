{
  system ? builtins.currentSystem or "x86_64-linux",
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/9387b3fcc0c23c86661636da63faabad4235a0a6.tar.gz"; # Pinned from nixpkgs
    sha256 = "0364mbq5s3yjj1bq5qhwwsllxmgsrjfydh6377wky4y0zap89apd";
  };

  pkgs = import nixpkgs {
    inherit system;
  };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    nixfmt

    node2nix
    nodejs
    nodePackages.pnpm
    yarn
  ];
}
