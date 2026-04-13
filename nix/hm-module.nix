# Home-manager module for Momentum speech-to-text
#
# Provides a systemd user service for autostart.
# Usage: imports = [ Momentum.homeManagerModules.default ];
#        services.Momentum.enable = true;
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.Momentum;
in
{
  options.services.Momentum = {
    enable = lib.mkEnableOption "Momentum speech-to-text user service";

    package = lib.mkOption {
      type = lib.types.package;
      defaultText = lib.literalExpression "Momentum.packages.\${system}.Momentum";
      description = "The Momentum package to use.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.user.services.Momentum = {
      Unit = {
        Description = "Momentum speech-to-text";
        After = [ "graphical-session.target" ];
        PartOf = [ "graphical-session.target" ];
      };
      Service = {
        ExecStart = "${cfg.package}/bin/Momentum";
        Restart = "on-failure";
        RestartSec = 5;
      };
      Install.WantedBy = [ "graphical-session.target" ];
    };
  };
}
