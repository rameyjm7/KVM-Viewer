// VirtualKeyboard.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Keyboard from 'react-simple-keyboard';
import axios from 'axios';
import 'react-simple-keyboard/build/css/index.css';
import './VirtualKeyboard.css';

export default function VirtualKeyboard({ visible }) {
  const keyboard = useRef();

  // Modifier states
  const [capsOn,    setCapsOn]    = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [ctrlHeld,  setCtrlHeld]  = useState(false);

  // Highlight theme
  const [buttonTheme, setButtonTheme] = useState([]);

  const url = `http://${window.location.hostname}:5000/keypress`;

  // Layout definitions
  const layouts = {
    default: [
      "` 1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "{tab} q w e r t y u i o p [ ] \\",
      "{lock} a s d f g h j k l ; ' {enter}",
      "{ctrl} {shift} z x c v b n m , . / {shift}",
      ".com @ {space}"
    ],
    shift: [
      "~ ! @ # $ % ^ & * ( ) _ + {bksp}",
      "{tab} Q W E R T Y U I O P { } |",
      "{lock} A S D F G H J K L : \" {enter}",
      "{ctrl} {shift} Z X C V B N M < > ? {shift}",
      ".com @ {space}"
    ],
    caps: [
      "` 1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "{tab} Q W E R T Y U I O P [ ] \\",
      "{lock} A S D F G H J K L ; ' {enter}",
      "{ctrl} {shift} Z X C V B N M , . / {shift}",
      ".com @ {space}"
    ]
  };

  const layoutName = shiftHeld
    ? 'shift'
    : capsOn
      ? 'caps'
      : 'default';

  const flash = btn => {
    setButtonTheme(t => [...t, { class: 'hg-pressed', buttons: btn }]);
    setTimeout(() => {
      setButtonTheme(t => t.filter(x => x.buttons !== btn));
    }, 200);
  };

  const sendEvent = (keyName, action) => {
    axios.post(url, {
      key:   keyName,
      action,           // "down" or "up"
      ctrl:  ctrlHeld,
      shift: shiftHeld,
      caps:  capsOn
    }).catch(console.error);
  };

  const handleKeyDown = useCallback(button => {
    let raw = button.startsWith('{') && button.endsWith('}')
      ? button.slice(1, -1)
      : button;

    // map named tokens
    if (raw === 'space')    raw = 'Space';
    else if (raw === 'enter') raw = 'Enter';
    else if (raw === 'bksp')  raw = 'Backspace';
    else if (raw === 'tab')   raw = 'Tab';
    else if (/^[a-z]$/i.test(raw)) {
      // letters: apply case
      raw = (shiftHeld || capsOn)
        ? raw.toUpperCase()
        : raw.toLowerCase();
    }

    // modifiers
    if (button === '{shift}') {
      setShiftHeld(true); flash('{shift}');
      sendEvent('Shift','down');
      return;
    }
    if (button === '{ctrl}') {
      setCtrlHeld(true); flash('{ctrl}');
      sendEvent('Control','down');
      return;
    }
    if (button === '{lock}') {
      setCapsOn(c=>!c); flash('{lock}');
      sendEvent('CapsLock','down');
      sendEvent('CapsLock','up');
      return;
    }

    // non-modifier: tap down+up
    flash(button);
    sendEvent(raw,'down');
    setTimeout(() => sendEvent(raw,'up'), 50);
  }, [capsOn, shiftHeld, ctrlHeld]);

  const handleKeyUp = useCallback(button => {
    if (button === '{shift}') {
      setShiftHeld(false);
      sendEvent('Shift','up');
    } else if (button === '{ctrl}') {
      setCtrlHeld(false);
      sendEvent('Control','up');
    }
  }, []);

  // physical keyboard listeners
  useEffect(() => {
    const onDown = e => {
      if (e.repeat) return;
      let btn = e.key === ' ' ? '{space}' :
                e.key === 'Enter' ? '{enter}' :
                e.key === 'Backspace' ? '{bksp}' :
                e.key === 'Tab' ? '{tab}' :
                e.key === 'Shift' ? '{shift}' :
                e.key === 'Control' ? '{ctrl}' :
                e.key === 'CapsLock' ? '{lock}' :
                e.key.toLowerCase();

      const kb = keyboard.current;
      if (kb?.getButtonElement(btn)) {
        handleKeyDown(btn);
      }
    };
    const onUp = e => {
      let btn = e.key === ' ' ? '{space}' :
                e.key === 'Enter' ? '{enter}' :
                e.key === 'Backspace' ? '{bksp}' :
                e.key === 'Tab' ? '{tab}' :
                e.key === 'Shift' ? '{shift}' :
                e.key === 'Control' ? '{ctrl}' :
                e.key === 'CapsLock' ? '{lock}' :
                e.key.toLowerCase();

      const kb = keyboard.current;
      if (kb?.getButtonElement(btn)) {
        handleKeyUp(btn);
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <Keyboard
        keyboardRef={r => (keyboard.current = r)}
        theme="hg-theme-dark"
        layoutName={layoutName}
        layout={layouts}
        display={{
          '{bksp}':'⌫','{tab}':'Tab','{enter}':'Enter',
          '{shift}':'Shift','{lock}':'Caps','{ctrl}':'Ctrl','{space}':'Space'
        }}
        buttonTheme={buttonTheme}
        onKeyPress={handleKeyDown}
        onKeyReleased={handleKeyUp}
        physicalKeyboardHighlight={false}
      />
    </div>
  );
}
