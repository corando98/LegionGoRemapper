import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { debounce, get, merge } from 'lodash';
import type { RootState } from './store';
import { setCurrentGameId, setInitialState } from './extraActions';
import { extractCurrentGameId, getServerApi } from '../backend/utils';
import { ControllerType, RgbModes } from '../backend/constants';
import { Router } from 'decky-frontend-lib';

const DEFAULT_RGB_LIGHT_VALUES: RgbLight = {
  enabled: false,
  mode: RgbModes.SOLID,
  speed: 50,
  red: 255,
  green: 255,
  blue: 255,
  brightness: 50,
  hue: 50
};

enum Colors {
  RED = 'red',
  GREEN = 'green',
  BLUE = 'blue'
}

type RgbLight = {
  enabled: boolean;
  mode: RgbModes;
  speed: number;
  red: number;
  green: number;
  blue: number;
  brightness: number;
  hue: number;
};

type RgbProfile = { LEFT: RgbLight; RIGHT: RgbLight };

type RgbProfiles = {
  [gameId: string]: RgbProfile;
};

type RgbState = {
  rgbProfiles: RgbProfiles;
  perGameProfilesEnabled: boolean;
};

const initialState: RgbState = {
  rgbProfiles: {},
  perGameProfilesEnabled: false
};

const bootstrapRgbProfile = (state: RgbState, newGameId: string) => {
  if (!state.rgbProfiles) {
    // rgbProfiles don't exist yet, create it
    state.rgbProfiles = {};
  }
  if (
    // only initialize profile if perGameProfiles are enabled
    (!state.rgbProfiles[newGameId] && state.perGameProfilesEnabled) ||
    // always initialize default
    newGameId === 'default'
  ) {
    const defaultProfile = get(state, 'rgbProfiles.default', {}) as RgbProfile;
    const newRgbProfile = {
      LEFT: defaultProfile.LEFT || DEFAULT_RGB_LIGHT_VALUES,
      RIGHT: defaultProfile.RIGHT || DEFAULT_RGB_LIGHT_VALUES
    };

    state.rgbProfiles[newGameId] = newRgbProfile;
  }
};

export const rgbSlice = createSlice({
  name: 'rgb',
  initialState,
  reducers: {
    setPerGameProfilesEnabled: (state, action: PayloadAction<boolean>) => {
      const enabled = action.payload;
      state.perGameProfilesEnabled = enabled;
      if (enabled) {
        bootstrapRgbProfile(state, extractCurrentGameId());
      }
    },
    setRgbMode: (
      state,
      action: PayloadAction<{ controller: ControllerType; mode: RgbModes }>
    ) => {
      const { controller, mode } = action.payload;
      setStateValue({
        sliceState: state,
        controller,
        key: 'mode',
        value: mode
      });
    },
    setSpeed: (
      state,
      action: PayloadAction<{ controller: ControllerType; speed: number }>
    ) => {
      const { controller, speed } = action.payload;
      setStateValue({
        sliceState: state,
        controller,
        key: 'speed',
        value: speed
      });
    },
    updateRgbProfiles: (state, action: PayloadAction<RgbProfiles>) => {
      merge(state.rgbProfiles, action.payload);
    },
    setColor: (
      state,
      action: PayloadAction<{
        controller: ControllerType;
        color: Colors;
        value: number;
      }>
    ) => {
      const { controller, color, value } = action.payload;
      setStateValue({
        sliceState: state,
        controller,
        key: color,
        value
      });
    },
    setRgbColor: (
      state,
      action: PayloadAction<{
        controller: ControllerType;
        red: number;
        green: number;
        blue: number;
        hue: number;
      }>
    ) => {
      const { controller, red, green, blue, hue } = action.payload;
      const currentGameId = extractCurrentGameId();
      if (state.perGameProfilesEnabled) {
        state.rgbProfiles[currentGameId][controller].red = red;
        state.rgbProfiles[currentGameId][controller].green = green;
        state.rgbProfiles[currentGameId][controller].blue = blue;
        state.rgbProfiles[currentGameId][controller].hue = hue;
      } else {
        state.rgbProfiles['default'][controller].red = red;
        state.rgbProfiles['default'][controller].green = green;
        state.rgbProfiles['default'][controller].blue = blue;
        state.rgbProfiles['default'][controller].hue = hue;
      }
    },
    setEnabled: (
      state,
      action: PayloadAction<{
        controller: ControllerType;
        enabled: boolean;
      }>
    ) => {
      const { controller, enabled } = action.payload;

      setStateValue({
        sliceState: state,
        controller,
        key: 'enabled',
        value: enabled
      });
    },
    setBrightness: (
      state,
      action: PayloadAction<{
        controller: ControllerType;
        brightness: number;
      }>
    ) => {
      const { controller, brightness } = action.payload;

      setStateValue({
        sliceState: state,
        controller,
        key: 'brightness',
        value: brightness
      });
    },
    setHue: (
      state,
      action: PayloadAction<{
        controller: ControllerType;
        hue: number;
      }>
    ) => {
      const { controller, hue } = action.payload;
      const currentGameId = extractCurrentGameId();
      if (state.perGameProfilesEnabled) {
        state.rgbProfiles[currentGameId][controller].hue = hue;
      } else {
        state.rgbProfiles['default'][controller].hue = hue;
      }
      setStateValue({
        sliceState: state,
        controller,
        key: 'hue',
        value: hue
      });
    }
  },
  extraReducers: (builder) => {
    builder.addCase(setInitialState, (state, action) => {
      const rgbProfiles = action.payload.rgb as RgbProfiles;
      const perGameProfilesEnabled = Boolean(
        action.payload.rgbPerGameProfilesEnabled
      );

      state.rgbProfiles = rgbProfiles;
      state.perGameProfilesEnabled = perGameProfilesEnabled;
    });
    builder.addCase(setCurrentGameId, (state, action) => {
      /*
        currentGameIdChanged, check if exists in redux store.
        if not exists, bootstrap it on frontend
      */
      const newGameId = action.payload as string;
      bootstrapRgbProfile(state, newGameId);
    });
  }
});

// -------------
// selectors
// -------------

export const selectRgbInfo =
  (controller: ControllerType) => (state: RootState) => {
    const currentGameId = extractCurrentGameId();
    let rgbInfo;
    if (state.rgb.perGameProfilesEnabled) {
      rgbInfo = state.rgb.rgbProfiles[currentGameId][controller];
    } else {
      rgbInfo = state.rgb.rgbProfiles['default'][controller];
    }

    return rgbInfo;
  };

export const selectRgbMode =
  (controller: ControllerType) => (state: RootState) => {
    const currentGameId = extractCurrentGameId();
    let rgbMode;
    if (state.rgb.perGameProfilesEnabled) {
      rgbMode = state.rgb.rgbProfiles[currentGameId][controller].mode;
    } else {
      rgbMode = state.rgb.rgbProfiles['default'][controller].mode;
    }

    return rgbMode;
  };

export const selectPerGameProfilesEnabled = (state: RootState) => {
  return state.rgb.perGameProfilesEnabled;
};

export const selectRgbProfileDisplayName = (state: RootState) => {
  if (state.rgb.perGameProfilesEnabled) {
    return Router.MainRunningApp?.display_name || 'Default';
  } else {
    return 'Default';
  }
};

// -------------
// middleware
// -------------

const mutatingActionTypes = [
  rgbSlice.actions.updateRgbProfiles.type,
  rgbSlice.actions.setColor.type,
  rgbSlice.actions.setEnabled.type,
  rgbSlice.actions.setPerGameProfilesEnabled.type,
  rgbSlice.actions.setRgbMode.type,
  rgbSlice.actions.setRgbColor.type,
  rgbSlice.actions.setSpeed.type,
  rgbSlice.actions.setBrightness.type,
  rgbSlice.actions.setHue.type
];

// persist RGB settings to the backend
const saveRgbSettings = (store: any) => {
  const serverApi = getServerApi();

  const {
    rgb: { rgbProfiles, perGameProfilesEnabled }
  } = store.getState();
  const currentGameId = perGameProfilesEnabled
    ? extractCurrentGameId()
    : 'default';

  serverApi?.callPluginMethod('save_rgb_settings', {
    rgbProfiles,
    currentGameId
  });
};

const debouncedSaveRgbSettings = debounce(saveRgbSettings, 100);

export const saveRgbSettingsMiddleware =
  (store: any) => (next: any) => (action: any) => {
    const { type } = action;
    const serverApi = getServerApi();

    const result = next(action);

    if (mutatingActionTypes.includes(type)) {
      // save to backend
      debouncedSaveRgbSettings(store);
    }
    if (type === setInitialState.type || type === setCurrentGameId.type) {
      // tell backend to sync LEDs to current FE state
      const {
        rgb: { perGameProfilesEnabled }
      } = store.getState();
      const currentGameId = perGameProfilesEnabled
        ? extractCurrentGameId()
        : 'default';

      serverApi?.callPluginMethod('sync_rgb_settings', { currentGameId });
    }
    if (type === rgbSlice.actions.setPerGameProfilesEnabled.type) {
      serverApi?.callPluginMethod('save_rgb_per_game_profiles_enabled', {
        enabled: Boolean(action.payload)
      });
      if (action.payload) {
        serverApi?.callPluginMethod('sync_rgb_settings', {
          currentGameId: extractCurrentGameId()
        });
      } else {
        serverApi?.callPluginMethod('sync_rgb_settings', {
          currentGameId: 'default'
        });
      }
    }

    return result;
  };

// -------------
// Slice Util functions
// -------------

function setStateValue({
  sliceState,
  controller,
  key,
  value
}: {
  sliceState: RgbState;
  controller: ControllerType;
  key: string;
  value: any;
}) {
  if (sliceState.perGameProfilesEnabled) {
    const currentGameId = extractCurrentGameId();
    sliceState.rgbProfiles[currentGameId][controller][key] = value;
  } else {
    sliceState.rgbProfiles['default'][controller][key] = value;
  }
}
