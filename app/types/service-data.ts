/** Service call payload fields used by the embedded mock HA source. */
export interface HassServiceData {
  brightness?: number;
  color_temp?: number;
  effect?: string;
  temperature?: number;
  hvac_mode?: string;
  fan_mode?: string;
  preset_mode?: string;
  swing_mode?: string;
  position?: number;
  tilt_position?: number;
  volume_level?: number;
  is_volume_muted?: boolean;
  shuffle?: boolean;
  repeat?: string;
  source?: string;
  sound_mode?: string;
  percentage?: number;
  oscillating?: boolean;
  direction?: string;
  value?: number | string;
  option?: string;
}
