{
  system ? builtins.currentSystem,
}:
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/6308c3b21396534d8aaeac46179c14c439a89b8a.tar.gz"; # Pinned from nixpkgs
    sha256 = "14qnx22pkl9v4r0lxnnz18f4ybxj8cv18hyf1klzap98hckg58y4";
  };

  pkgs = import nixpkgs {
    inherit system;
    config = { };
    overlays = [ ];
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
