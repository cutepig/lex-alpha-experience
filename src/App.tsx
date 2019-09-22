import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
} from 'react';
import { Observable, animationFrameScheduler, interval } from 'rxjs';
import { observeOn, distinctUntilChanged } from 'rxjs/operators';
import { icons } from 'feather-icons';
import { IStore, createStore, Reducer } from './rxjsUtils';
import './App.css';

type Screen = 'start' | 'media';

interface IState {
  screen: Screen;
  isUiVisible: boolean;
  isPlaying: boolean;
  intensityLevel: number;
  volumeLevel: number;
}

type IReducer = Reducer<IState>;

interface IServices {
  store: IStore<IState>;
  audioContext: AudioContext;
}

const ServicesContext = createContext<IServices>(null as any);

interface IObserve<T> {
  obs: Observable<T>;
  children: (value: T) => React.ReactElement;
}

const OBSERVABLE_PENDING = Symbol('OBSERVABLE_PENDING');

function Observe<T>({ obs, children }: IObserve<T>): React.ReactElement {
  const [value, setValue] = useState<T>(OBSERVABLE_PENDING as any);
  useEffect(() => {
    const subscription = obs
      .pipe(observeOn(animationFrameScheduler))
      .subscribe(setValue);
    return () => subscription.unsubscribe();
  }, [obs]);

  if (value === (OBSERVABLE_PENDING as any)) {
    return null;
  }

  return children(value);
}

interface IFeather {
  name: string; // TODO: Define
}

const Feather: React.FunctionComponent<IFeather> = ({ name }) => (
  <span dangerouslySetInnerHTML={{ __html: icons[name].toSvg() }} />
);

const pauseMedia: IReducer = state => {
  state.screen = 'media';
  state.isPlaying = false;
};

const playMedia: IReducer = state => {
  state.screen = 'media';
  state.isPlaying = true;
};

const backToStartScreen: IReducer = state => {
  state.isPlaying = false;
  state.screen = 'start';
};

const StartScreen: React.FunctionComponent = () => {
  const { store } = useContext(ServicesContext);
  const { dispatch } = store;

  return (
    <div className="start-screen">
      <h1 className="start-screen-title">Welcome To Alpha Experience</h1>
      <button onClick={() => dispatch(playMedia)}>
        <Feather name="play-circle" />
      </button>
    </div>
  );
};

export function useObservable<T>(
  obs: Observable<T>,
  defaultValue?: T,
  optionalComparisonFn?: (x: T, y: T) => boolean,
) {
  const [state, setState] = useState(defaultValue);
  useEffect(() => {
    const subscription = obs
      .pipe(distinctUntilChanged(optionalComparisonFn))
      .subscribe(setState);
    return () => subscription.unsubscribe();
  }, [obs]);
  return state;
}

const AUDIO_FADE_TIME = 1.0;

const AudioPlayer: React.FunctionComponent = () => {
  const { store, audioContext } = useContext(ServicesContext);
  const state = useObservable(store.state$);

  useEffect(() => {
    if (!state) {
      return;
    }

    let prevState: IState = state;
    const leftOscillatorNode = audioContext.createOscillator();
    const rightOscillatorNode = audioContext.createOscillator();
    const leftStereoPannerNode = audioContext.createStereoPanner();
    const rightStereoPannerNode = audioContext.createStereoPanner();
    const gainNode = audioContext.createGain();

    leftOscillatorNode.type = 'sine';
    leftOscillatorNode.frequency.value = 100;
    rightOscillatorNode.type = 'sine';
    rightOscillatorNode.frequency.value = 110;
    leftStereoPannerNode.pan.value = -1;
    rightStereoPannerNode.pan.value = 1;
    gainNode.gain.value = 0;

    leftOscillatorNode.connect(leftStereoPannerNode);
    rightOscillatorNode.connect(rightStereoPannerNode);

    leftOscillatorNode.connect(gainNode);
    rightOscillatorNode.connect(gainNode);

    gainNode.connect(audioContext.destination);

    // Subscribe to parameter changes
    const subscription = store.state$.subscribe(newState => {
      if (newState.isPlaying) {
        if (newState.volumeLevel !== prevState.volumeLevel) {
          gainNode.gain.value = newState.volumeLevel;
        }
      }

      prevState = newState;
    });

    leftOscillatorNode.start();
    rightOscillatorNode.start();

    // Apparently FF doesn't implement this correctly, instead
    // of fading it just toggles to given value with delay :(
    gainNode.gain.linearRampToValueAtTime(
      state.volumeLevel,
      audioContext.currentTime + AUDIO_FADE_TIME,
    );

    return () => {
      const when = audioContext.currentTime + AUDIO_FADE_TIME;
      subscription.unsubscribe();
      gainNode.gain.linearRampToValueAtTime(0, when);
      leftOscillatorNode.stop(when);
      rightOscillatorNode.stop(when);
      setTimeout(() => gainNode.disconnect(), AUDIO_FADE_TIME * 1000);
    };
  }, [!state]);

  return null;
};

const FlashPlayer: React.FunctionComponent = () => {
  const { store } = useContext(ServicesContext);
  const rootEl = useRef<HTMLDivElement>();
  const requestRef = React.useRef<number>();
  const stateRef = useRef<IState>();

  // Custom flash
  useEffect(() => {
    const startTime = Date.now();

    const subscription = store.state$.subscribe(state => {
      stateRef.current = state;
    });

    // eslint-disable-next-line
    requestRef.current = requestAnimationFrame(update);

    function update(currentTime) {
      if (rootEl.current) {
        const phase = Math.sin(
          (currentTime - startTime) * 0.001 * Math.PI * 2 * 10,
        );
        const level =
          0.5 +
          phase *
            0.5 *
            (stateRef.current ? stateRef.current.intensityLevel : 0);
        // TODO: Configurable color
        rootEl.current.style.backgroundColor = `rgba(0, 255, 255, ${level})`;
      }

      requestRef.current = requestAnimationFrame(update);
    }

    return () => {
      subscription.unsubscribe();
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return <div className="flash-player" ref={rootEl}></div>;
};

const MediaScreen: React.FunctionComponent = () => {
  const { store } = useContext(ServicesContext);
  const { state$, dispatch } = store;

  return (
    <Observe obs={state$}>
      {state => (
        <div className="media-screen">
          {state.isPlaying && <FlashPlayer />}
          {state.isPlaying && <AudioPlayer />}

          <div className="media-screen-ui">
            <button onClick={() => dispatch(backToStartScreen)}>
              <Feather name="arrow-left" />
            </button>

            {state.isPlaying ? (
              // Pause button
              <button onClick={() => dispatch(pauseMedia)}>
                <Feather name="pause-circle" />
              </button>
            ) : (
              // Play button
              <button onClick={() => dispatch(playMedia)}>
                <Feather name="play-circle" />
              </button>
            )}
          </div>
        </div>
      )}
    </Observe>
  );
};

const AppScreen: React.FunctionComponent = () => {
  const { store } = useContext(ServicesContext);

  return (
    <div className="app-screen">
      <Observe obs={store.state$}>
        {({ screen }) =>
          screen === 'start' ? <StartScreen /> : <MediaScreen />
        }
      </Observe>
    </div>
  );
};

export const App: React.FC = () => {
  const store = createStore<IState>({
    screen: 'start',
    isUiVisible: false,
    isPlaying: false,
    volumeLevel: 0.5,
    intensityLevel: 0.5,
  });

  const services: IServices = {
    store,
    audioContext: new AudioContext(),
  };

  return (
    <ServicesContext.Provider value={services}>
      <AppScreen />
    </ServicesContext.Provider>
  );
};
