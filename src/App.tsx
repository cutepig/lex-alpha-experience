import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';

const cls = (...classes: Array<string | undefined | null | false>) =>
  classes.filter(Boolean).join(' ');

const AUDIO_FADE_TIME = 1.0;

const AudioPlayer: React.FunctionComponent<{ audioContext: AudioContext }> = ({
  audioContext,
}) => {
  useEffect(() => {
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

    leftOscillatorNode.start();
    rightOscillatorNode.start();

    // Apparently FF doesn't implement this correctly, instead
    // of fading it just toggles to given value with delay :(
    gainNode.gain.linearRampToValueAtTime(
      0.5,
      audioContext.currentTime + AUDIO_FADE_TIME,
    );

    return () => {
      const when = audioContext.currentTime + AUDIO_FADE_TIME;
      gainNode.gain.linearRampToValueAtTime(0, when);
      leftOscillatorNode.stop(when);
      rightOscillatorNode.stop(when);
      setTimeout(() => gainNode.disconnect(), AUDIO_FADE_TIME * 1000);
    };
  }, []);

  return null;
};

const FlashPlayer: React.FunctionComponent = () => {
  const rootEl = useRef<HTMLDivElement>();
  const requestRef = React.useRef<number>();

  // Custom flash
  useEffect(() => {
    const startTime = Date.now();

    // eslint-disable-next-line
    requestRef.current = requestAnimationFrame(update);

    function update(currentTime) {
      if (rootEl.current) {
        const phase = Math.sin(
          (currentTime - startTime) * 0.001 * Math.PI * 2 * 10,
        );
        const level = 0.5 + phase * 0.5;
        // TODO: Configurable color
        rootEl.current.style.backgroundColor = `rgba(0, 255, 255, ${level})`;
      }

      requestRef.current = requestAnimationFrame(update);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return <div className="flash-player" ref={rootEl}></div>;
};

const MediaPanel: React.FunctionComponent = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContext = useMemo(() => new AudioContext(), []);

  // TODO: You know, very slowly pulsating background would be
  // nice when the user hasn't yet started the app?
  return (
    <div className={cls('media-panel', isPlaying && 'media-panel--is-playing')}>
      {isPlaying && <AudioPlayer audioContext={audioContext} />}

      <div className="media-panel-flash">{isPlaying && <FlashPlayer />}</div>

      <div className="media-panel-button">
        <button
          onClick={ev => {
            ev.currentTarget.focus();
            setIsPlaying(!isPlaying);
          }}
        >
          <i className={isPlaying ? 'icofont-pause' : 'icofont-play-alt-2'} />
        </button>
      </div>
    </div>
  );
};

const InfoPanel: React.FunctionComponent = () => (
  <div className="info-panel">
    <h1>Experience The Alpha</h1>
    <p>
      Mollit nostrud aliqua dolor dolor magna aliqua mollit. Ex mollit velit
      cillum labore laborum aliqua et esse. Ad cupidatat dolore ut laborum sit
      aute enim aliquip eu. Cillum cupidatat et nisi non duis. Consectetur
      adipisicing ullamco aliqua nulla ea commodo ad minim laborum ea cupidatat
      reprehenderit magna sunt. Est laboris consequat eu ad voluptate aliqua
      voluptate ea consectetur fugiat.
    </p>

    <p>
      Esse irure pariatur deserunt magna ad anim aliqua dolor nisi ipsum do. Ex
      incididunt officia consequat labore consectetur proident Lorem ad eiusmod
      in qui. Incididunt excepteur fugiat laboris aliquip laborum ex consequat
      consectetur fugiat est minim proident. Officia fugiat laborum eu irure
      fugiat laborum tempor commodo cupidatat.
    </p>

    <h2>Experience begins here</h2>
    <p className="icofont-simple-down" />
  </div>
);

export const App: React.FC = () => (
  <div className="app-screen">
    <InfoPanel />
    <MediaPanel />
  </div>
);
