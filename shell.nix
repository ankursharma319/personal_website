{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/88eab1e431cabd0ed621428d8b40d425a07af39f.tar.gz") {}}:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodePackages.npm
    pkgs.nodejs
  ];
}
